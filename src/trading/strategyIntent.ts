import { DEFAULT_RISK_LIMITS } from './config';
import type { ExecutionPolicyInput } from './executionPolicy';
import { evaluateRisk } from './risk';
import type { ExecutionDecision, RiskDisposition } from './types';

export type IndependentStrategyIntentAction = 'OPEN_LONG' | 'CLOSE_LONG' | 'MAINTAIN';
export type IndependentIntentGate = 'RISK_CANDIDATE' | 'BLOCKED' | 'NOT_REQUIRED';

export interface IndependentStrategyIntent {
  schemaVersion: 1;
  id: string;
  source: 'SIGNAL_STATE_SHADOW_V1';
  executionAuthority: false;
  market: string;
  asOf: number;
  action: IndependentStrategyIntentAction;
  sideHint: 'BUY' | 'SELL' | null;
  requestedNotional: number;
  requestedQuantity: number;
  confidence: number;
  gate: IndependentIntentGate;
  blockedRiskDisposition: RiskDisposition;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  reasons: string[];
}

export interface IndependentRiskProjection {
  schemaVersion: 1;
  id: string;
  source: 'INDEPENDENT_INTENT_RISK_SHADOW_V1';
  executionAuthority: false;
  intentId: string;
  action: ExecutionDecision['action'];
  side: ExecutionDecision['side'];
  notional: number;
  quantity: number;
  confidence: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  riskDisposition: ExecutionDecision['riskDisposition'];
  riskReasons: string[];
  reasons: string[];
}

export interface IndependentPolicyParityReport {
  schemaVersion: 1;
  id: string;
  executionAuthority: false;
  status: 'PASS' | 'REJECT';
  actionParity: boolean;
  sideParity: boolean;
  notionalParity: boolean;
  quantityParity: boolean;
  protectionParity: boolean;
  riskDispositionParity: boolean;
  toleranceNotional: number;
  reasons: string[];
}

export interface IndependentPolicyShadowTrace {
  schemaVersion: 1;
  executionAuthority: false;
  intent: IndependentStrategyIntent;
  riskProjection: IndependentRiskProjection;
  parity: IndependentPolicyParityReport;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finiteNonNegative = (value: number) => Number.isFinite(value) && value > 0 ? value : 0;
const almostEqual = (left: number | null, right: number | null, tolerance: number) => {
  if (left == null || right == null) return left === right;
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
};

const intentId = (input: ExecutionPolicyInput) => {
  const market = input.liquidity.market.toUpperCase();
  const asOf = Number.isFinite(input.multiTimeframe.asOf) ? Math.trunc(input.multiTimeframe.asOf) : 0;
  return `sint-independent-v1-${market}-${asOf}`;
};

export const buildIndependentStrategyIntent = (input: ExecutionPolicyInput): IndependentStrategyIntent => {
  const { liquidity, multiTimeframe, oneHour, portfolio, position } = input;
  const market = liquidity.market.toUpperCase();
  const currentPrice = liquidity.tradePrice;
  if (!/^KRW-[A-Z0-9]+$/.test(market)) throw new Error(`Invalid independent intent market: ${market}`);
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) throw new Error('Independent intent requires a positive finite trade price.');
  if (!Number.isFinite(portfolio.equity) || portfolio.equity <= 0) throw new Error('Independent intent requires positive portfolio equity.');

  const common = {
    schemaVersion: 1 as const,
    id: intentId(input),
    source: 'SIGNAL_STATE_SHADOW_V1' as const,
    executionAuthority: false as const,
    market,
    asOf: multiTimeframe.asOf,
  };

  if (position) {
    const positionNotional = finiteNonNegative(currentPrice * position.quantity);
    if (position.stopLossPrice && currentPrice <= position.stopLossPrice) {
      return { ...common, action: 'CLOSE_LONG', sideHint: 'SELL', requestedNotional: positionNotional, requestedQuantity: position.quantity, confidence: 1, gate: 'NOT_REQUIRED', blockedRiskDisposition: 'NOT_EVALUATED', stopLossPrice: position.stopLossPrice, takeProfitPrice: position.takeProfitPrice, reasons: ['Protective stop-loss was reached.'] };
    }
    if (position.takeProfitPrice && currentPrice >= position.takeProfitPrice) {
      return { ...common, action: 'CLOSE_LONG', sideHint: 'SELL', requestedNotional: positionNotional, requestedQuantity: position.quantity, confidence: 1, gate: 'NOT_REQUIRED', blockedRiskDisposition: 'NOT_EVALUATED', stopLossPrice: position.stopLossPrice, takeProfitPrice: position.takeProfitPrice, reasons: ['Protective take-profit was reached.'] };
    }
    if (multiTimeframe.action === 'SELL' || multiTimeframe.directionalScore <= -20) {
      return { ...common, action: 'CLOSE_LONG', sideHint: 'SELL', requestedNotional: positionNotional, requestedQuantity: position.quantity, confidence: multiTimeframe.confidence, gate: 'NOT_REQUIRED', blockedRiskDisposition: 'NOT_EVALUATED', stopLossPrice: position.stopLossPrice, takeProfitPrice: position.takeProfitPrice, reasons: ['Multi-timeframe direction reversed against the existing long spot position.'] };
    }
    return { ...common, action: 'MAINTAIN', sideHint: null, requestedNotional: 0, requestedQuantity: 0, confidence: multiTimeframe.confidence, gate: 'NOT_REQUIRED', blockedRiskDisposition: 'NOT_EVALUATED', stopLossPrice: position.stopLossPrice, takeProfitPrice: position.takeProfitPrice, reasons: ['Existing position remains inside its protective levels and no exit signal is active.'] };
  }

  if (input.newEntryAllowed === false) {
    const reasons = input.newEntryBlockReasons?.length ? input.newEntryBlockReasons.slice() : ['Paper portfolio open-position limit rejected a new entry.'];
    return { ...common, action: 'MAINTAIN', sideHint: null, requestedNotional: 0, requestedQuantity: 0, confidence: multiTimeframe.confidence, gate: 'BLOCKED', blockedRiskDisposition: 'REJECT', stopLossPrice: null, takeProfitPrice: null, reasons: ['Portfolio-level deterministic risk policy rejected a new entry.', ...reasons] };
  }

  if (!liquidity.eligible) {
    return { ...common, action: 'MAINTAIN', sideHint: null, requestedNotional: 0, requestedQuantity: 0, confidence: 0, gate: 'BLOCKED', blockedRiskDisposition: 'NOT_EVALUATED', stopLossPrice: null, takeProfitPrice: null, reasons: ['Liquidity gate rejected this market.', ...liquidity.reasons] };
  }

  if (multiTimeframe.action !== 'BUY' || multiTimeframe.confidence < 0.62) {
    return { ...common, action: 'MAINTAIN', sideHint: null, requestedNotional: 0, requestedQuantity: 0, confidence: multiTimeframe.confidence, gate: 'BLOCKED', blockedRiskDisposition: 'NOT_EVALUATED', stopLossPrice: null, takeProfitPrice: null, reasons: ['A new spot entry requires BUY consensus with at least 62% confidence.'] };
  }

  const conviction = clamp((multiTimeframe.directionalScore - 20) / 50, 0.35, 1);
  const requestedNotional = portfolio.equity * DEFAULT_RISK_LIMITS.maxPositionPct * conviction * multiTimeframe.positionRiskMultiplier;
  const stopDistancePct = clamp(oneHour.indicators.atrPct * 1.8, 0.012, 0.04);
  return {
    ...common,
    action: 'OPEN_LONG',
    sideHint: 'BUY',
    requestedNotional,
    requestedQuantity: 0,
    confidence: multiTimeframe.confidence,
    gate: 'RISK_CANDIDATE',
    blockedRiskDisposition: 'NOT_EVALUATED',
    stopLossPrice: currentPrice * (1 - stopDistancePct),
    takeProfitPrice: currentPrice * (1 + stopDistancePct * 2),
    reasons: ['Liquidity and multi-timeframe entry conditions passed; candidate requires deterministic risk evaluation.'],
  };
};

export const applyIndependentIntentRisk = (
  intent: IndependentStrategyIntent,
  input: ExecutionPolicyInput,
): IndependentRiskProjection => {
  const projectionId = `irisk-v1-${intent.id.replace(/^sint-independent-v1-/, '')}`;
  const common = { schemaVersion: 1 as const, id: projectionId, source: 'INDEPENDENT_INTENT_RISK_SHADOW_V1' as const, executionAuthority: false as const, intentId: intent.id, confidence: intent.confidence };

  if (intent.action === 'CLOSE_LONG') {
    return { ...common, action: 'EXIT', side: 'SELL', notional: intent.requestedNotional, quantity: intent.requestedQuantity, stopLossPrice: intent.stopLossPrice, takeProfitPrice: intent.takeProfitPrice, riskDisposition: 'NOT_EVALUATED', riskReasons: [], reasons: intent.reasons.slice() };
  }

  if (intent.action === 'MAINTAIN') {
    return { ...common, action: 'HOLD', side: null, notional: 0, quantity: 0, stopLossPrice: intent.stopLossPrice, takeProfitPrice: intent.takeProfitPrice, riskDisposition: intent.blockedRiskDisposition, riskReasons: intent.blockedRiskDisposition === 'REJECT' ? intent.reasons.slice(1) : [], reasons: intent.reasons.slice() };
  }

  const estimatedSlippageBps = Math.max(8, input.liquidity.spreadBps / 2 + 5);
  const risk = evaluateRisk({
    equity: input.portfolio.equity,
    requestedNotional: intent.requestedNotional,
    dailyPnlPct: input.portfolio.dailyPnlPct,
    totalDrawdownPct: input.portfolio.drawdownPct,
    estimatedSlippageBps,
    marketDataAgeMs: input.marketDataAgeMs ?? 0,
    feedConnected: input.feedConnected ?? true,
    ledgerInSync: input.ledgerInSync ?? true,
    duplicateOrderDetected: input.duplicateOrderDetected ?? false,
  });

  if (risk.status === 'REJECT') {
    return { ...common, action: 'HOLD', side: null, notional: 0, quantity: 0, stopLossPrice: null, takeProfitPrice: null, riskDisposition: 'REJECT', riskReasons: risk.reasons.slice(), reasons: ['Deterministic risk gate rejected the candidate.', ...risk.reasons] };
  }

  return { ...common, action: 'ENTER', side: 'BUY', notional: risk.approvedNotional, quantity: 0, stopLossPrice: intent.stopLossPrice, takeProfitPrice: intent.takeProfitPrice, riskDisposition: 'APPROVE', riskReasons: risk.reasons.slice(), reasons: ['Liquidity, multi-timeframe consensus, confidence, and deterministic risk gates all passed.'] };
};

export const compareIndependentProjectionToLegacy = (
  projection: IndependentRiskProjection,
  legacy: ExecutionDecision,
  equity: number,
): IndependentPolicyParityReport => {
  const toleranceNotional = Math.max(1e-6, Math.abs(equity) * 1e-9);
  const tolerancePrice = Math.max(1e-8, Math.sqrt(Math.max(1, Math.abs(equity))) * 1e-9);
  const actionParity = projection.action === legacy.action;
  const sideParity = projection.side === legacy.side;
  const notionalParity = Math.abs(projection.notional - legacy.notional) <= toleranceNotional;
  const quantityParity = Math.abs(projection.quantity - legacy.quantity) <= 1e-9;
  const protectionParity = almostEqual(projection.stopLossPrice, legacy.stopLossPrice, tolerancePrice) && almostEqual(projection.takeProfitPrice, legacy.takeProfitPrice, tolerancePrice);
  const riskDispositionParity = projection.riskDisposition === legacy.riskDisposition;
  const status = actionParity && sideParity && notionalParity && quantityParity && protectionParity && riskDispositionParity ? 'PASS' : 'REJECT';
  const reasons = [
    `action ${projection.action}/${legacy.action}: ${actionParity ? 'PASS' : 'FAIL'}`,
    `side ${projection.side ?? 'NONE'}/${legacy.side ?? 'NONE'}: ${sideParity ? 'PASS' : 'FAIL'}`,
    `notional ${projection.notional}/${legacy.notional}: ${notionalParity ? 'PASS' : 'FAIL'}`,
    `quantity ${projection.quantity}/${legacy.quantity}: ${quantityParity ? 'PASS' : 'FAIL'}`,
    `protection: ${protectionParity ? 'PASS' : 'FAIL'}`,
    `risk disposition ${projection.riskDisposition}/${legacy.riskDisposition}: ${riskDispositionParity ? 'PASS' : 'FAIL'}`,
  ];
  return { schemaVersion: 1, id: `iparity-v1-${projection.id.replace(/^irisk-v1-/, '')}`, executionAuthority: false, status, actionParity, sideParity, notionalParity, quantityParity, protectionParity, riskDispositionParity, toleranceNotional, reasons };
};

export const buildIndependentPolicyShadow = (
  input: ExecutionPolicyInput,
  legacyDecision: ExecutionDecision,
): IndependentPolicyShadowTrace => {
  const intent = buildIndependentStrategyIntent(input);
  const riskProjection = applyIndependentIntentRisk(intent, input);
  const parity = compareIndependentProjectionToLegacy(riskProjection, legacyDecision, input.portfolio.equity);
  return { schemaVersion: 1, executionAuthority: false, intent, riskProjection, parity };
};
