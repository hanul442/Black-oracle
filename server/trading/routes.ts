import type { Express, Request, Response } from 'express';
import { SUPPORTED_UPBIT_MINUTE_UNITS, type SupportedUpbitMinuteUnit } from '../../src/trading/config';
import { buildTradingSnapshot } from '../../src/trading/snapshot';
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

const handleRouteError = (error: unknown, res: Response) => {
  const message = error instanceof Error ? error.message : 'Unknown trading gateway error.';
  const isInputError = /must|allowed|unsupported|requires|limited/i.test(message);
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
      const unit = parseUnit(req.query.unit, 60);
      const eventScore = parseOptionalEventScore(req.query.eventScore);
      const candles = await getMinuteCandles(market, unit, 200);
      const snapshot = buildTradingSnapshot(candles, eventScore);
      return res.json({ success: true, snapshot });
    } catch (error) {
      return handleRouteError(error, res);
    }
  });
};
