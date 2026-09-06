import { verifyFirebaseUser } from '../server/auth/firebaseUser.js';
import { tradingCheckpointStore } from '../server/trading/persistence.js';
import { claimTradingCycleLease, releaseTradingCycleLease } from '../server/trading/runtimeLease.js';
import {
  appendIntegrityEvent,
  buildIncidentTransitionEvent,
  deriveIntegrityIncidents,
  normalizeIntegrityLedgerCheckpoint,
  summarizeIntegrityLedger,
} from '../src/trading/integrityLedger.js';

const json = (response: any, status: number, body: Record<string, unknown>) => response.status(status).json(body);
const runtimeId = () => process.env.TRADING_RUNTIME_ID?.trim() || 'black-oracle-paper';

export default async function handler(request: any, response: any) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  if (String(process.env.TRADING_PERSISTENCE_BACKEND ?? '').toLowerCase() !== 'supabase') {
    return json(response, 503, { success: false, error: 'Incident lifecycle requires Supabase trading persistence.' });
  }

  const user = await verifyFirebaseUser(request.headers.authorization).catch(() => null);
  if (!user) return json(response, 401, { success: false, error: 'Verified Firebase user authorization is required.' });

  if (request.method === 'GET') {
    try {
      const checkpoint = await tradingCheckpointStore.load();
      if (!checkpoint) return json(response, 200, { success: true, available: false, incidents: [] });
      const integrity = normalizeIntegrityLedgerCheckpoint((checkpoint as any).integrity ?? null);
      const summary = summarizeIntegrityLedger(integrity, Date.now(), 14);
      return json(response, 200, {
        success: true,
        available: Boolean(integrity),
        integrity: {
          startedAt: summary.startedAt,
          coverageDays: summary.coverageDays,
          coverageComplete: summary.coverageComplete,
          totalIncidents: summary.totalIncidents,
          unresolvedCriticalIncidents: summary.unresolvedCriticalIncidents,
          reasons: summary.reasons,
        },
        incidents: summary.incidents,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown incident read error.';
      return json(response, 500, { success: false, error: message });
    }
  }

  const incidentId = String(request.body?.incidentId ?? '').trim();
  const action = String(request.body?.action ?? '').trim().toUpperCase();
  const note = String(request.body?.note ?? '').trim().slice(0, 2_000);
  if (!incidentId || !['ACKNOWLEDGE', 'RESOLVE'].includes(action)) {
    return json(response, 400, { success: false, error: 'incidentId and action ACKNOWLEDGE or RESOLVE are required.' });
  }

  const owner = `incident-api-${globalThis.crypto.randomUUID()}`;
  let leaseAcquired = false;
  try {
    leaseAcquired = await claimTradingCycleLease(runtimeId(), owner, 45);
    if (!leaseAcquired) return json(response, 409, { success: false, error: 'Trading runtime is busy; incident transition was not written.' });

    const checkpoint = await tradingCheckpointStore.load();
    if (!checkpoint) return json(response, 404, { success: false, error: 'Trading checkpoint was not found.' });
    const integrity = normalizeIntegrityLedgerCheckpoint((checkpoint as any).integrity ?? null);
    if (!integrity) return json(response, 409, { success: false, error: 'Integrity observability has not started.' });

    const incident = deriveIntegrityIncidents(integrity).find((item) => item.incidentId === incidentId);
    if (!incident) return json(response, 404, { success: false, error: 'Incident was not found.' });

    const event = buildIncidentTransitionEvent({
      incident,
      type: action === 'ACKNOWLEDGE' ? 'INCIDENT_ACKNOWLEDGED' : 'INCIDENT_RESOLVED',
      actor: user.uid,
      note,
    });
    const nextIntegrity = appendIntegrityEvent(integrity, event);
    const nextCheckpoint = {
      ...checkpoint,
      savedAt: Date.now(),
      reason: action === 'ACKNOWLEDGE' ? 'integrity-incident-acknowledged' : 'integrity-incident-resolved',
      integrity: nextIntegrity,
    };
    await tradingCheckpointStore.save(nextCheckpoint);
    const updated = deriveIntegrityIncidents(nextIntegrity).find((item) => item.incidentId === incidentId)!;

    return json(response, 200, {
      success: true,
      incident: updated,
      integrity: summarizeIntegrityLedger(nextIntegrity, Date.now(), 14),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown incident transition error.';
    return json(response, /already|Only an unacknowledged/i.test(message) ? 409 : 500, { success: false, error: message });
  } finally {
    if (leaseAcquired) {
      try {
        await releaseTradingCycleLease(runtimeId(), owner);
      } catch (error) {
        console.error('Failed to release incident transition lease:', error);
      }
    }
  }
}
