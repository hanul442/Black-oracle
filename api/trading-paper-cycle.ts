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
  const requestStartedAt = Date.now();
  const timings: Record<string, number> = {};

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
  let buildRuntimePreimage: any;
  let initializeFreshQualificationRuntime: any;
  let restoreRuntimeCheckpoint: any;
  let restoreRuntimePreimage: any;
  let saveRuntimeCheckpoint: any;

  const importStartedAt = Date.now();
  try {
    // @ts-ignore build-generated module is replaced by esbuild before deployment packaging.
    const runtimeModule: any = await import('../server/trading/runtime-bundle.mjs');

    paperLoopController = runtimeModule.paperLoopController;
    claimTradingCycleLease = runtimeModule.claimTradingCycleLease;
    releaseTradingCycleLease = runtimeModule.releaseTradingCycleLease;
    buildRuntimePreimage = runtimeModule.buildRuntimePreimage;
    initializeFreshQualificationRuntime = runtimeModule.initializeFreshQualificationRuntime;
    restoreRuntimeCheckpoint = runtimeModule.restoreRuntimeCheckpoint;
    restoreRuntimePreimage = runtimeModule.restoreRuntimePreimage;
    saveRuntimeCheckpoint = runtimeModule.saveRuntimeCheckpoint;

    if (
      !paperLoopController ||
      typeof claimTradingCycleLease !== 'function' ||
      typeof releaseTradingCycleLease !== 'function' ||
      typeof buildRuntimePreimage !== 'function' ||
      typeof initializeFreshQualificationRuntime !== 'function' ||
      typeof restoreRuntimeCheckpoint !== 'function' ||
      typeof restoreRuntimePreimage !== 'function' ||
      typeof saveRuntimeCheckpoint !== 'function'
    ) {
      throw new Error('Trading runtime bundle is missing required exports.');
    }
  } catch (error) {
    timings.importMs = Date.now() - importStartedAt;
    console.error('Scheduled Paper cycle module initialization failed:', error);
    return json(response, 500, {
      success: false,
      phase: 'startup-import',
      timings: { ...timings, totalMs: Date.now() - requestStartedAt },
      error: errorMessage(error),
    });
  }
  timings.importMs = Date.now() - importStartedAt;

  const runtimeId = process.env.TRADING_RUNTIME_ID?.trim() || 'black-oracle-paper';
  const owner = `scheduled-worker-${globalThis.crypto.randomUUID()}`;
  let leaseAcquired = false;
  let runtimeLoaded = false;
  let qualificationBootstrapInProgress = false;
  let cycleCheckpointCommitted = false;
  let responseStatus = 500;
  let responseBody: Record<string, unknown> = {
    success: false,
    runtimeId,
    phase: 'startup',
    error: 'Paper cycle did not complete.',
  };

  try {
    const leaseStartedAt = Date.now();
    leaseAcquired = await claimTradingCycleLease(runtimeId, owner, 840);
    timings.leaseMs = Date.now() - leaseStartedAt;

    if (!leaseAcquired) {
      responseStatus = 409;
      responseBody = {
        success: false,
        skipped: true,
        reason: 'Another Paper cycle currently owns the runtime lease.',
        runtimeId,
      };
    } else {
      const restoreStartedAt = Date.now();
      const restore = await restoreRuntimeCheckpoint(false);
      timings.restoreMs = Date.now() - restoreStartedAt;
      runtimeLoaded = true;

      if (!restore.restored && restore.profile?.qualificationId) {
        qualificationBootstrapInProgress = true;
        const bootstrapStartedAt = Date.now();
        const initialized = await initializeFreshQualificationRuntime();
        timings.qualificationBootstrapMs = Date.now() - bootstrapStartedAt;
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
        const cyclePreimage = buildRuntimePreimage('scheduled-paper-cycle-preimage');

        const cycleStartedAt = Date.now();
        const cycle = await paperLoopController.runCycle();
        timings.cycleMs = Date.now() - cycleStartedAt;
        const afterSession = paperLoopController.status().session;

        // Preserve frozen S1R2 strategy/risk semantics. The only new behavior is:
        // if the durable checkpoint cannot commit, restore the exact pre-cycle
        // in-memory state so the process cannot diverge from recovery state.
        let saved: any;
        const checkpointStartedAt = Date.now();
        try {
          saved = await saveRuntimeCheckpoint('scheduled-paper-cycle');
          cycleCheckpointCommitted = true;
        } catch (persistenceError) {
          timings.checkpointMs = Date.now() - checkpointStartedAt;
          try {
            restoreRuntimePreimage(cyclePreimage, false);
          } catch (rollbackError) {
            throw new Error(
              `Paper cycle checkpoint commit failed and exact rollback also failed. `
              + `Persistence: ${errorMessage(persistenceError)} Rollback: ${errorMessage(rollbackError)}`,
            );
          }
          throw new Error(`Paper cycle rolled back because checkpoint persistence failed: ${errorMessage(persistenceError)}`);
        }
        timings.checkpointMs = Date.now() - checkpointStartedAt;

        console.info('S1R2 Paper checkpoint committed', JSON.stringify({
          runtimeId,
          timings,
          persistence: saved?.persistence ?? null,
        }));

        let councilAi: Awaited<ReturnType<typeof runCostGatedAiCouncilForCycle>> = {
          advisoryOnly: true,
          executionAuthority: false,
          eligibleCount: 0,
          reviewedCount: 0,
          skippedCount: 0,
          reviews: [],
        };
        const councilStartedAt = Date.now();
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
        timings.councilMs = Date.now() - councilStartedAt;

        let eventLedger: Record<string, unknown> = { persisted: false, attempted: 0 };
        const ledgerStartedAt = Date.now();
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
        timings.canonicalLedgerMs = Date.now() - ledgerStartedAt;

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
          atomicity: {
            checkpointCommitted: true,
            rollbackRequired: false,
          },
          councilAi,
          eventLedger,
        };
      }
    }
  } catch (error) {
    // If the cycle did not commit, exact rollback already restored the durable
    // preimage. Do NOT attempt an error checkpoint because that would reintroduce
    // a second failing write and could obscure the original persistence failure.
    if (runtimeLoaded && !qualificationBootstrapInProgress && cycleCheckpointCommitted) {
      const errorCheckpointStartedAt = Date.now();
      try {
        await saveRuntimeCheckpoint('scheduled-paper-cycle-error');
      } catch (checkpointError) {
        console.error('Failed to checkpoint after post-commit scheduled Paper cycle error:', checkpointError);
      } finally {
        timings.errorCheckpointMs = Date.now() - errorCheckpointStartedAt;
      }
    }

    const message = errorMessage(error);
    console.error('Scheduled Paper cycle failed:', error);
    responseStatus = 500;
    responseBody = {
      success: false,
      runtimeId,
      phase: qualificationBootstrapInProgress ? 'qualification-bootstrap' : runtimeLoaded ? 'cycle' : 'startup',
      atomicity: {
        checkpointCommitted: cycleCheckpointCommitted,
        rolledBackToPreimage: runtimeLoaded && !cycleCheckpointCommitted,
      },
      error: message,
    };
  }

  if (leaseAcquired) {
    const cleanupStartedAt = Date.now();
    try {
      const released = await releaseTradingCycleLease(runtimeId, owner);
      if (!released) throw new Error('Runtime lease release returned false.');
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
        responseBody = { ...responseBody, cleanupError };
      }
    } finally {
      timings.cleanupMs = Date.now() - cleanupStartedAt;
    }
  }

  timings.totalMs = Date.now() - requestStartedAt;
  responseBody = { ...responseBody, timings };
  console.info('S1R2 Paper cycle request finished', JSON.stringify({
    runtimeId,
    status: responseStatus,
    success: responseBody.success === true,
    timings,
  }));

  return json(response, responseStatus, responseBody);
}