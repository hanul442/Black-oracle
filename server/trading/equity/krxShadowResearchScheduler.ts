import { appendCanonicalEvents } from '../../eventLedger';
import { buildKrxShadowResearchCanonicalEvents } from './krxShadowResearchEvents';
import { runKrxShadowResearchCycle, type KrxShadowResearchCycleResult } from './krxShadowResearchLoop';

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
  lastTradingDate: string | null;
  lastNominationReadyCount: number | null;
  lastError: string | null;
}

class KrxShadowResearchScheduler {
  private timer: NodeJS.Timeout | null = null;
  private startTimer: NodeJS.Timeout | null = null;
  private inFlight = false;
  private lastStartedAt = 0;
  private lastFinishedAt = 0;
  private lastCycle: KrxShadowResearchCycleResult | null = null;
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
    return {
      enabled: this.enabled(),
      running: this.timer !== null || this.startTimer !== null || this.inFlight,
      runtimeId: runtimeId(),
      cadenceMs: this.cadenceMs(),
      lastStartedAt: this.lastStartedAt || null,
      lastFinishedAt: this.lastFinishedAt || null,
      lastTradingDate: this.lastCycle?.tradingDate ?? null,
      lastNominationReadyCount: this.lastCycle?.nominationReadyCount ?? null,
      lastError: this.lastError,
    };
  }

  async runNow() {
    if (!this.enabled() || this.inFlight) return this.status();
    this.inFlight = true;
    this.lastStartedAt = Date.now();
    try {
      const cycle = await runKrxShadowResearchCycle();
      this.lastCycle = cycle;
      this.lastFinishedAt = Date.now();
      this.lastError = null;
      const id = runtimeId();
      const events = buildKrxShadowResearchCanonicalEvents(cycle, id);
      await appendCanonicalEvents(events);
      console.info(`Black Oracle KRX account-free research: ${cycle.tradingDate} · ${cycle.committeeCandidates.length} candidate(s) · ${cycle.nominationReadyCount} nomination-ready · executionAuthority=false.`);
    } catch (error) {
      this.lastFinishedAt = Date.now();
      this.lastError = error instanceof Error ? error.message : String(error);
      console.warn(`Black Oracle KRX account-free research failed: ${this.lastError}`);
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
