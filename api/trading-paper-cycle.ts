import { randomUUID } from 'node:crypto';
import { paperLoopController } from '../server/trading/paperLoop';
import { claimTradingCycleLease, releaseTradingCycleLease } from '../server/trading/runtimeLease';
import { restoreRuntimeCheckpoint, saveRuntimeCheckpoint } from '../server/trading/runtimeState';

const json = (response: any, status: number, body: Record<string, unknown>) =>
  response.status(status).json(body);

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.authorization !== `Bearer ${cronSecret}`) {
    return json(response, 401, { success: false, error: 'Unauthorized cron invocation.' });
  }

  if ((process.env.TRADING_PERSISTENCE_BACKEND ?? '').toLowerCase() !== 'supabase') {
    return json(response, 503, {
      success: false,
      error: 'Scheduled Paper cycles require TRADING_PERSISTENCE_BACKEND=supabase.',
    });
  }

  const runtimeId = process.env.TRADING_RUNTIME_ID?.trim() || 'black-oracle-paper';
  const owner = `vercel-cron-${randomUUID()}`;
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
    const saved = await saveRuntimeCheckpoint('vercel-cron-cycle');

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
        await saveRuntimeCheckpoint('vercel-cron-error');
      } catch (checkpointError) {
        console.error('Failed to checkpoint after scheduled Paper cycle error:', checkpointError);
      }
    }

    return json(response, 500, {
      success: false,
      runtimeId,
      error: error instanceof Error ? error.message : 'Unknown scheduled Paper cycle error.',
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
