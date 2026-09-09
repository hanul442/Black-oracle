import { runCostGatedAiCouncilForCycle } from '../server/trading/aiCouncilCostGate';
import { appendCanonicalEvents, buildPaperCycleCanonicalEvents } from '../server/eventLedger';
import { buildEvidenceAndEquityCanonicalEvents } from '../server/eventLedgerEvidenceProjection';
import { buildNarsCanonicalAuditEvents } from '../server/eventLedgerNarsAudit';
import { buildTradingSessionDeltaCanonicalEvents } from '../server/eventLedgerTradeProjection';

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
  let initializeFreshQualificationRuntime: any;
  let restoreRuntimeCheckpoint: any;
  let saveRuntimeCheckpoint: any;

  try {
    // The full Paper runtime is bundled during the build step so Railway's Node ESM
    // loader never has to resolve the runtime's extensionless TypeScript imports.
    // Keep this import as an explicit `any` boundary because the generated bundle on
    // disk may lag the source entrypoint during pre-build TypeScript validation.
    // @ts-ignore build-generated module is replaced by esbuild before deployment packaging.
    const runtimeModule: any = await import('../server/trading/runtime-bundle.mjs');

    paperLoopController = runtimeModule.paperLoopController;
    claimTradingCycleLease = runtimeModule.claimTradingCycleLease;
    releaseTradingCycleLease = runtimeModule.releaseTradingCycleLease;
    initializeFreshQualificationRuntime = runtimeModule.initializeFreshQualificationRuntime;
    restoreRuntimeCheckpoint = runtimeModule.restoreRuntimeCheckpoint;
    saveRuntimeCheckpoint = runtimeModule.saveRuntimeCheckpoint;

    if (
      !paperLoopController ||
      typeof claimTradingCycleLease !== 'function' ||
      typeof releaseTradingCycleLease !== 'function' ||
      typeof initializeFreshQualificationRuntime !== 'function' ||
      typeof restoreRuntimeCheckpoint !== 'function' ||
      typeof saveRuntimeCheckpoint !== 'function'
    ) {
      throw new Error('Trading runtime bundle is missing required exports.');
    }
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
  let runtimeLoaded = false;
  let qualificationBootstrapInProgress = false;
  let responseStatus = 500;
  let responseBody: Record<string, unknown> = {
    success: false,
    runtimeId,
    phase: 'startup',
    error: 'Paper cycle did not complete.',
  };

  try {
    leaseAcquired = await claimTradingCycleLease(runtimeId, owner, 840);
    if (!leaseAcquired) {
      responseStatus = 409;
      responseBody = {
        success: false,
        skipped: true,
        reason: 'Another Paper cycle currently owns the runtime lease.',
        runtimeId,
      };
    } else {
      const restore = await restoreRuntimeCheckpoint(false);
      runtimeLoaded = true;

      if (!restore.restored && restore.profile?.qualificationId) {
        qualificationBootstrapInProgress = true;
        const initialized = await initializeFreshQualificationRuntime();
        qualificationBootstrapInProgress = false;
        responseStatus = 200;
        responseBody = {
          success: true,
          runtimeId,
          initializedOnly: true,
          reason: 'Fresh qualification checkpoint initialized; no trading cycle executed.',
          profile: restore.profile,
          checkpoint: {
            savedAt: initialized.checkpoint?.savedAt ?? null,
            reason: initialized.checkpoint?.reason ?? null,
            initialEquityKrw: initialized.checkpoint?.session?.portfolio?.initialEquity ?? null,
            positions: initialized.checkpoint?.session?.portfolio?.positions?.length ?? null,
            closedTrades: initialized.checkpoint?.session?.closedTrades?.length ?? null,
            cycleCount: initialized.checkpoint?.loop?.cycleCount ?? null,
          },
          compatibility: initialized.compatibility ?? null,
          persistence: initialized.persistence ?? null,
        };
      } else {
        const beforeSession = paperLoopController.status().session;
        const cycle = await paperLoopController.runCycle();
        const afterSession = paperLoopController.status().session;

        // Trading state is persisted BEFORE any AI review or event-ledger projection.
        // Neither the AI Council nor observability can alter this cycle's execution outcome.
        const saved = await saveRuntimeCheckpoint('scheduled-paper-cycle');

        let councilAi: Awaited<ReturnType<typeof runCostGatedAiCouncilForCycle>> = {
          advisoryOnly: true,
          executionAuthority: false,
          eligibleCount: 0,
          reviewedCount: 0,
          skippedCount: 0,
          reviews: [],
        };
        try {
          councilAi = await runCostGatedAiCouncilForCycle(cycle, runtimeId, 2);
        } catch (councilError) {
          console.error('Operational AI Council review failed after Paper checkpoint:', councilError);
          councilAi = {
            advisoryOnly: true,
            executionAuthority: false,
            eligibleCount: 0,
            reviewedCount: 0,
            skippedCount: 1,
            reviews: [],
          };
        }

        let eventLedger: Record<string, unknown> = { persisted: false, attempted: 0 };
        try {
          const narsAuditEvents = await buildNarsCanonicalAuditEvents(cycle, runtimeId);
          const events = [
            ...buildPaperCycleCanonicalEvents(cycle, runtimeId, councilAi),
            ...buildEvidenceAndEquityCanonicalEvents(cycle, runtimeId),
            ...buildTradingSessionDeltaCanonicalEvents(beforeSession, afterSession, runtimeId),
            ...narsAuditEvents,
          ];
          eventLedger = await appendCanonicalEvents(events);
        } catch (ledgerError) {
          console.error('Canonical event ledger append failed after completed Paper cycle:', ledgerError);
          eventLedger = {
            persisted: false,
            attempted: 0,
            error: errorMessage(ledgerError),
          };
        }

        responseStatus = 200;
        responseBody = {
          success: true,
          runtimeId,
          restore: {
            restored: restore.restored,
            savedAt: restore.savedAt,
            reason: restore.reason,
            compatibility: restore.compatibility ?? null,
          },
          cycle,
          persistence: saved.persistence,
          councilAi,
          eventLedger,
        };
      }
    }
  } catch (error) {
    if (runtimeLoaded && !qualificationBootstrapInProgress) {
      try {
        await saveRuntimeCheckpoint('scheduled-paper-cycle-error');
      } catch (checkpointError) {
        console.error('Failed to checkpoint after scheduled Paper cycle error:', checkpointError);
      }
    }

    const message = errorMessage(error);
    console.error('Scheduled Paper cycle failed:', error);
    responseStatus = 500;
    responseBody = {
      success: false,
      runtimeId,
      phase: qualificationBootstrapInProgress ? 'qualification-bootstrap' : runtimeLoaded ? 'cycle' : 'startup',
      error: message,
    };
  }

  if (leaseAcquired) {
    try {
      const released = await releaseTradingCycleLease(runtimeId, owner);
      if (!released) {
        throw new Error('Runtime lease release returned false.');
      }
    } catch (releaseError) {
      const cleanupError = errorMessage(releaseError);
      console.error('Failed to release scheduled Paper cycle lease:', releaseError);

      if (responseStatus === 200) {
        responseStatus = 500;
        responseBody = {
          success: false,
          runtimeId,
          phase: 'cleanup',
          cycleCompleted: responseBody.initializedOnly !== true,
          initializedOnly: responseBody.initializedOnly === true,
          error: cleanupError,
        };
      } else {
        responseBody = {
          ...responseBody,
          cleanupError,
        };
      }
    }
  }

  return json(response, responseStatus, responseBody);
}