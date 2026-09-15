import { appendCanonicalEvents } from '../../eventLedger';
import { buildKrxShadowResearchCanonicalEvents } from './krxShadowResearchEvents';
import { runKrxShadowResearchCycle, type KrxShadowResearchCycleResult } from './krxShadowResearchLoop';
import { classifyKrxResearchTruth, snapshotKrxResearchTruth } from './krxResearchTruth';

const DEFAULT_CADENCE_MS = 60 * 60_000;
const START_DELAY_MS = 15_000;

const kisConfigured = () => Boolean(String(process.env.KIS_APP_KEY ?? '').trim() && String(process.env.KIS_APP_SECRET ?? '').trim());
const runtimeId = () => String(process.env.TRADING_RUNTIME_ID ?? '').trim();
const eligibleRuntime = (id: string) => /(?:s2-shadow|v9-multiasset)/i.test(id);

export interface KrxShadowResearchSchedulerStatus {
  enabled: boolean;
  running: boolean;
  runtimeId: string;
  cadenceMs: number;
  lastStartedAt: number | null;
  lastFinishedAt: number | null;
  lastSuccessfulAt: number | null;
  lastTradingDate: string | null;
  lastSource: string | null;
  lastDisposition: string | null;
  lastDiscoveredCount: number | null;
  lastVolumePrefilteredCount: number | null;
  lastProfiledCount: number | null;
  lastEligibleCount: number | null;
  lastCommitteeCandidateCount: number | null;
  lastNominationReadyCount: number | null;
  lastCanonicalEventCount: number | null;
  lastError: string | null;
}

class KrxShadowResearchScheduler {
  private timer: NodeJS.Timeout | null = null;
  private startTimer: NodeJS.Timeout | null = null;
  private inFlight = false;
  private lastStartedAt = 0;
  private lastFinishedAt = 0;
  private lastSuccessfulAt = 0;
  private lastCycle: KrxShadowResearchCycleResult | null = null;
  private lastCanonicalEventCount: number | null = null;
  private lastError: string | null = null;

  private cadenceMs() {
    const configured = Number(process.env.KRX_RESEARCH_CADENCE_MS ?? DEFAULT_CADENCE_MS);
    return Number.isFinite(configured) ? Math.max(30 * 60_000, Math.trunc(configured)) : DEFAULT_CADENCE_MS;
  }

  enabled() {
    const id = runtimeId();
    const explicit = String(process.env.BO_ENABLE_KRX_ACCOUNT_FREE_RESEARCH ?? 'true').trim().toLowerCase();
    return explicit !== 'false' && eligibleRuntime(id) && !kisConfigured();
  }

  status(): KrxShadowResearchSchedulerStatus {
    const truth = this.lastCycle ? snapshotKrxResearchTruth(this.lastCycle) : null;
    return {
      enabled: this.enabled(),
      running: this.timer !== null || this.startTimer !== null || this.inFlight,
      runtimeId: runtimeId(),
      cadenceMs: this.cadenceMs(),
      lastStartedAt: this.lastStartedAt || null,
      lastFinishedAt: this.lastFinishedAt || null,
      lastSuccessfulAt: this.lastSuccessfulAt || null,
      lastTradingDate: this.lastCycle?.tradingDate ?? null,
      lastSource: truth?.source ?? null,
      lastDisposition: truth ? classifyKrxResearchTruth(truth) : null,
      lastDiscoveredCount: truth?.discovered ?? null,
      lastVolumePrefilteredCount: truth?.volumePrefiltered ?? null,
      lastProfiledCount: truth?.profiled ?? null,
      lastEligibleCount: truth?.eligible ?? null,
      lastCommitteeCandidateCount: truth?.committeeCandidateCount ?? null,
      lastNominationReadyCount: truth?.nominationReadyCount ?? null,
      lastCanonicalEventCount: this.lastCanonicalEventCount,
      lastError: this.lastError,
    };
  }

  async runNow() {
    if (!this.enabled() || this.inFlight) return this.status();
    this.inFlight = true;
    this.lastStartedAt = Date.now();
    let phase: 'RESEARCH_CYCLE' | 'CANONICAL_APPEND' = 'RESEARCH_CYCLE';
    try {
      const cycle = await runKrxShadowResearchCycle();
      const id = runtimeId();
      const events = buildKrxShadowResearchCanonicalEvents(cycle, id);
      phase = 'CANONICAL_APPEND';
      await appendCanonicalEvents(events);

      // Only promote a cycle into scheduler truth after its canonical events commit.
      // A successful provider read followed by a failed append must not look like
      // the latest successfully observed canonical KRX state.
      this.lastCycle = cycle;
      this.lastCanonicalEventCount = events.length;
      this.lastSuccessfulAt = Date.now();
      this.lastFinishedAt = this.lastSuccessfulAt;
      this.lastError = null;

      const truth = snapshotKrxResearchTruth(cycle);
      const disposition = classifyKrxResearchTruth(truth);
      console.info(
        `Black Oracle KRX account-free research: ${cycle.tradingDate} · source=${truth.source} · disposition=${disposition}`
        + ` · universe ${truth.discovered} discovered / ${truth.volumePrefiltered} volume-prefiltered / ${truth.profiled} profiled / ${truth.eligible} eligible`
        + ` · Committee ${truth.committeeCandidateCount} candidate(s) / ${truth.nominationReadyCount} nomination-ready`
        + ` · canonicalEvents=${events.length} · executionAuthority=false.`,
      );
    } catch (error) {
      this.lastFinishedAt = Date.now();
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = `${phase}: ${message}`;
      console.warn(`Black Oracle KRX account-free research failed [${phase}]: ${message}`);
    } finally {
      this.inFlight = false;
    }
    return this.status();
  }

  start() {
    if (!this.enabled() || this.timer || this.startTimer) return this.status();
    this.startTimer = setTimeout(() => {
      this.startTimer = null;
      void this.runNow();
    }, START_DELAY_MS);
    this.startTimer.unref?.();
    this.timer = setInterval(() => {
      void this.runNow();
    }, this.cadenceMs());
    this.timer.unref?.();
    return this.status();
  }

  stop() {
    if (this.startTimer) clearTimeout(this.startTimer);
    if (this.timer) clearInterval(this.timer);
    this.startTimer = null;
    this.timer = null;
    return this.status();
  }
}

export const krxShadowResearchScheduler = new KrxShadowResearchScheduler();
krxShadowResearchScheduler.start();
