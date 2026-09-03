const json = (response: any, status: number, body: Record<string, unknown>) =>
  response.status(status).json(body);

const isAuthorizedScheduler = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Bearer ')) return false;

  const presented = authorization.slice('Bearer '.length);
  const accepted = [process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return accepted.some((secret) => secret === presented);
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown scheduled Paper cycle error.';

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }

  if (!isAuthorizedScheduler(request.headers.authorization)) {
    return json(response, 401, { success: false, error: 'Unauthorized scheduled invocation.' });
  }

  if ((process.env.TRADING_PERSISTENCE_BACKEND ?? '').toLowerCase() !== 'supabase') {
    return json(response, 503, {
      success: false,
      error: 'Scheduled Paper cycles require TRADING_PERSISTENCE_BACKEND=supabase.',
    });
  }

  let paperLoopController: any;
  let claimTradingCycleLease: any;
  let releaseTradingCycleLease: any;
  let restoreRuntimeCheckpoint: any;
  let saveRuntimeCheckpoint: any;

  try {
    const [paperLoopModule, leaseModule, runtimeStateModule] = await Promise.all([
      import('../server/trading/paperLoop'),
      import('../server/trading/runtimeLease'),
      import('../server/trading/runtimeState'),
    ]);

    paperLoopController = paperLoopModule.paperLoopController;
    claimTradingCycleLease = leaseModule.claimTradingCycleLease;
    releaseTradingCycleLease = leaseModule.releaseTradingCycleLease;
    restoreRuntimeCheckpoint = runtimeStateModule.restoreRuntimeCheckpoint;
    saveRuntimeCheckpoint = runtimeStateModule.saveRuntimeCheckpoint;
  } catch (error) {
    console.error('Scheduled Paper cycle module initialization failed:', error);
    return json(response, 500, {
      success: false,
      phase: 'startup-import',
      error: errorMessage(error),
    });
  }

  const runtimeId = process.env.TRADING_RUNTIME_ID?.trim() || 'black-oracle-paper';
  const owner = `scheduled-worker-${globalThis.crypto.randomUUID()}`;
  let leaseAcquired = false;
  let runtimeRestored = false;

  try {
    leaseAcquired = await claimTradingCycleLease(runtimeId, owner, 840);
    if (!leaseAcquired) {
      return json(response, 409, {
        success: false,
        skipped: true,
        reason: 'Another Paper cycle currently owns the runtime lease.',
        runtimeId,
      });
    }

    const restore = await restoreRuntimeCheckpoint(false);
    runtimeRestored = true;
    const cycle = await paperLoopController.runCycle();
    const saved = await saveRuntimeCheckpoint('scheduled-paper-cycle');

    return json(response, 200, {
      success: true,
      runtimeId,
      restore: {
        restored: restore.restored,
        savedAt: restore.savedAt,
        reason: restore.reason,
      },
      cycle,
      persistence: saved.persistence,
    });
  } catch (error) {
    if (runtimeRestored) {
      try {
        await saveRuntimeCheckpoint('scheduled-paper-cycle-error');
      } catch (checkpointError) {
        console.error('Failed to checkpoint after scheduled Paper cycle error:', checkpointError);
      }
    }

    const message = errorMessage(error);
    console.error('Scheduled Paper cycle failed:', error);
    return json(response, 500, {
      success: false,
      runtimeId,
      phase: runtimeRestored ? 'cycle' : 'startup',
      error: message,
    });
  } finally {
    if (leaseAcquired) {
      try {
        await releaseTradingCycleLease(runtimeId, owner);
      } catch (releaseError) {
        console.error('Failed to release scheduled Paper cycle lease:', releaseError);
      }
    }
  }
}
