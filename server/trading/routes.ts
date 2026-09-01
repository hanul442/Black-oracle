import type { Express, Request, Response } from 'express';
import { SUPPORTED_UPBIT_MINUTE_UNITS, type SupportedUpbitMinuteUnit } from '../../src/trading/config';
import type { EvidenceDirection, EvidenceSourceType, TradingEvidence } from '../../src/trading/evidence';
import { buildTradingSnapshot } from '../../src/trading/snapshot';
import { tradingEvidenceStore } from './evidenceStore';
import { buildMarketMultiTimeframe } from './multiTimeframe';
import { paperLoopController } from './paperLoop';
import { paperTradingSession } from './paperSession';
import { buildKrwLiquidityUniverse } from './universe';
import { getMinuteCandles, listKrwMarkets } from './upbitPublic';

const parseUnit = (value: unknown, fallback: SupportedUpbitMinuteUnit): SupportedUpbitMinuteUnit => {
  const parsed = Number(value ?? fallback);
  if (!SUPPORTED_UPBIT_MINUTE_UNITS.includes(parsed as SupportedUpbitMinuteUnit)) {
    throw new Error(`unit must be one of: ${SUPPORTED_UPBIT_MINUTE_UNITS.join(', ')}`);
  }
  return parsed as SupportedUpbitMinuteUnit;
};

const parseCount = (value: unknown, fallback = 200) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) throw new Error('count must be an integer between 1 and 200');
  return parsed;
};

const parseLimit = (value: unknown, fallback = 12) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) throw new Error('limit must be an integer between 1 and 20');
  return parsed;
};

const parseOptionalEventScore = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < -100 || parsed > 100) throw new Error('eventScore must be between -100 and 100');
  return parsed;
};

const parseInitialCash = (value: unknown, fallback = 1_000_000) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed < 100_000 || parsed > 1_000_000_000) {
    throw new Error('initialCash must be between 100,000 and 1,000,000,000 KRW');
  }
  return parsed;
};

const parseLoopConfig = (body: Record<string, unknown> | undefined) => {
  const intervalMinutes = Number(body?.intervalMinutes ?? 15);
  const maxMarkets = Number(body?.maxMarkets ?? 6);
  const maxOpenPositions = Number(body?.maxOpenPositions ?? 4);
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 240) {
    throw new Error('intervalMinutes must be between 5 and 240.');
  }
  return {
    intervalMs: Math.round(intervalMinutes * 60_000),
    maxMarkets,
    maxOpenPositions,
  };
};

const parseEvidenceDirection = (value: unknown): EvidenceDirection => {
  const normalized = String(value ?? 'NEUTRAL').toUpperCase();
  if (!['BULLISH', 'BEARISH', 'NEUTRAL'].includes(normalized)) {
    throw new Error('Evidence direction must be BULLISH, BEARISH, or NEUTRAL.');
  }
  return normalized as EvidenceDirection;
};

const parseEvidenceSourceType = (value: unknown): EvidenceSourceType => {
  const normalized = String(value ?? 'SYSTEM').toUpperCase();
  if (!['PRIMARY', 'NEWS', 'MACRO', 'ONCHAIN', 'MARKET', 'ANALYST', 'SYSTEM'].includes(normalized)) {
    throw new Error('Evidence sourceType is invalid.');
  }
  return normalized as EvidenceSourceType;
};

const buildEvidenceFromBody = (body: Record<string, unknown> | undefined): TradingEvidence => {
  const now = Date.now();
  const observedAt = Number(body?.observedAt ?? now);
  const expiresAt = Number(body?.expiresAt ?? observedAt + 6 * 60 * 60 * 1000);
  const id = String(body?.id ?? globalThis.crypto?.randomUUID?.() ?? `evidence-${now}-${Math.random().toString(36).slice(2)}`);
  return {
    id,
    market: String(body?.market ?? '').toUpperCase(),
    title: String(body?.title ?? ''),
    direction: parseEvidenceDirection(body?.direction),
    strength: Number(body?.strength ?? 50),
    reliability: Number(body?.reliability ?? 0.6),
    sourceType: parseEvidenceSourceType(body?.sourceType),
    source: body?.source ? String(body.source) : undefined,
    observedAt,
    expiresAt,
    contradictionOf: body?.contradictionOf ? String(body.contradictionOf) : undefined,
    tags: Array.isArray(body?.tags) ? body.tags.map(String).slice(0, 20) : undefined,
  };
};

const resolvedEventScore = (market: string, manualScore?: number) => {
  const evidence = tradingEvidenceStore.aggregate(market);
  return {
    evidence,
    eventScore: manualScore ?? (evidence.activeCount > 0 ? evidence.score : undefined),
    source: manualScore !== undefined ? 'MANUAL_OVERRIDE' as const : evidence.activeCount > 0 ? 'EVIDENCE' as const : 'NONE' as const,
  };
};

const handleRouteError = (error: unknown, res: Response) => {
  const message = error instanceof Error ? error.message : 'Unknown trading gateway error.';
  const isInputError = /must|allowed|unsupported|requires|limited|invalid|insufficient|cannot|already/i.test(message);
  return res.status(isInputError ? 400 : 502).json({ success: false, error: message });
};

export const registerTradingRoutes = (app: Express) => {
  app.get('/api/trading/markets', async (_req: Request, res: Response) => {
    try {
      const markets = await listKrwMarkets();
      return res.json({ success: true, markets });
    } catch (error) {
      return handleRouteError(error, res);
    }
  });

  app.get('/api/trading/universe', async (req: Request, res: Response) => {
    try {
      const limit = parseLimit(req.query.limit, 12);
      const universe = await buildKrwLiquidityUniverse(limit, 30);
      return res.json({
        success: true,
        limit,
        eligibleCount: universe.filter((item) => item.eligible).length,
        universe,
      });
    } catch (error) {
      return handleRouteError(error, res);
    }
  });

  app.get('/api/trading/candles', async (req: Request, res: Response) => {
    try {
      const market = String(req.query.market ?? 'KRW-BTC').toUpperCase();
      const unit = parseUnit(req.query.unit, 15);
      const count = parseCount(req.query.count, 200);
      const candles = await getMinuteCandles(market, unit, count);
      return res.json({ success: true, market, unit, count: candles.length, candles });
    } catch (error) {
      return handleRouteError(error, res);
    }
  });

  app.get('/api/trading/snapshot', async (req: Request, res: Response) => {
    try {
      const market = String(req.query.market ?? 'KRW-BTC').toUpperCase();
      const manualScore = parseOptionalEventScore(req.query.eventScore);
      const resolved = resolvedEventScore(market, manualScore);
      const unit = parseUnit(req.query.unit, 60);
      const candles = await getMinuteCandles(market, unit, 200);
      const snapshot = buildTradingSnapshot(candles, resolved.eventScore);
      return res.json({ success: true, snapshot, evidence: resolved.evidence, eventScoreSource: resolved.source });
    } catch (error) {
      return handleRouteError(error, res);
    }
  });

  app.get('/api/trading/multitimeframe', async (req: Request, res: Response) => {
    try {
      const market = String(req.query.market ?? 'KRW-BTC').toUpperCase();
      const manualScore = parseOptionalEventScore(req.query.eventScore);
      const resolved = resolvedEventScore(market, manualScore);
      const multiTimeframe = await buildMarketMultiTimeframe(market, resolved.eventScore);
      return res.json({ success: true, multiTimeframe, evidence: resolved.evidence, eventScoreSource: resolved.source });
    } catch (error) {
      return handleRouteError(error, res);
    }
  });

  app.get('/api/trading/evidence', (req: Request, res: Response) => {
    try {
      const market = req.query.market ? String(req.query.market).toUpperCase() : undefined;
      const includeExpired = String(req.query.includeExpired ?? 'false') === 'true';
      const items = tradingEvidenceStore.list(market, includeExpired);
      const aggregate = market ? tradingEvidenceStore.aggregate(market) : null;
      return res.json({ success: true, items, aggregate });
    } catch (error) {
      return handleRouteError(error, res);
    }
  });

  app.post('/api/trading/evidence', (req: Request, res: Response) => {
    try {
      const evidence = tradingEvidenceStore.upsert(buildEvidenceFromBody(req.body));
      return res.status(201).json({ success: true, evidence, aggregate: tradingEvidenceStore.aggregate(evidence.market) });
    } catch (error) {
      return handleRouteError(error, res);
    }
  });

  app.delete('/api/trading/evidence/:id', (req: Request, res: Response) => {
    const removed = tradingEvidenceStore.remove(String(req.params.id));
    return res.json({ success: true, removed });
  });

  app.post('/api/trading/evidence/clear', (_req: Request, res: Response) => {
    tradingEvidenceStore.clear();
    return res.json({ success: true });
  });

  app.get('/api/trading/paper/state', (_req: Request, res: Response) => {
    return res.json({ success: true, ...paperTradingSession.state() });
  });

  app.get('/api/trading/paper/performance', (_req: Request, res: Response) => {
    return res.json({ success: true, performance: paperTradingSession.performance() });
  });

  app.post('/api/trading/paper/reset', (req: Request, res: Response) => {
    try {
      paperLoopController.stop();
      const initialCash = parseInitialCash(req.body?.initialCash, 1_000_000);
      return res.json({ success: true, ...paperTradingSession.reset(initialCash) });
    } catch (error) {
      return handleRouteError(error, res);
    }
  });

  app.post('/api/trading/paper/step', async (req: Request, res: Response) => {
    try {
      const market = String(req.body?.market ?? 'KRW-BTC').toUpperCase();
      const manualScore = parseOptionalEventScore(req.body?.eventScore);
      const resolved = resolvedEventScore(market, manualScore);
      const result = await paperTradingSession.step(market, resolved.eventScore);
      return res.json({ ...result, evidence: resolved.evidence, eventScoreSource: resolved.source });
    } catch (error) {
      return handleRouteError(error, res);
    }
  });

  app.get('/api/trading/paper/loop/status', (_req: Request, res: Response) => {
    return res.json({ success: true, ...paperLoopController.status() });
  });

  app.post('/api/trading/paper/loop/start', async (req: Request, res: Response) => {
    try {
      const config = parseLoopConfig(req.body);
      const status = paperLoopController.start(config);
      const runImmediately = req.body?.runImmediately !== false;
      const firstCycle = runImmediately && !status.cycleInProgress ? await paperLoopController.runCycle() : null;
      return res.json({ success: true, status: paperLoopController.status(), firstCycle });
    } catch (error) {
      return handleRouteError(error, res);
    }
  });

  app.post('/api/trading/paper/loop/stop', (_req: Request, res: Response) => {
    return res.json({ success: true, ...paperLoopController.stop() });
  });

  app.post('/api/trading/paper/loop/cycle', async (_req: Request, res: Response) => {
    try {
      const cycle = await paperLoopController.runCycle();
      return res.json({ success: true, cycle, performance: paperTradingSession.performance() });
    } catch (error) {
      return handleRouteError(error, res);
    }
  });
};
