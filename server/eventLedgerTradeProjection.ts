import type { CanonicalEventInput, CanonicalEventType } from './eventLedger';

const asArray = <T = any>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const marketFromPayload = (payload: any) => payload?.market == null ? null : String(payload.market);

const reasonFromPayload = (payload: any) => {
  if (typeof payload?.reason === 'string' && payload.reason.trim()) return payload.reason;
  if (Array.isArray(payload?.reasons) && payload.reasons.length) return payload.reasons.map(String).join(' · ');
  return null;
};

const actionFromPayload = (payload: any) => {
  if (payload?.side != null) return String(payload.side);
  if (payload?.action != null) return String(payload.action);
  return null;
};

const canonicalTypeForLedgerEvent = (type: string): CanonicalEventType | null => {
  switch (type) {
    case 'MARKET_SNAPSHOT': return 'EVIDENCE';
    case 'SIGNAL': return 'STRATEGY';
    case 'RISK_PASS':
    case 'RISK_REJECT': return 'RISK';
    case 'ORDER_SUBMITTED': return 'ORDER';
    case 'ORDER_FILLED':
    case 'POSITION_UPDATED': return 'TRADE';
    case 'SYSTEM_HALT': return 'SYSTEM';
    default: return null;
  }
};

const executionAuthorityForLedgerEvent = (type: string) => [
  'RISK_PASS',
  'RISK_REJECT',
  'ORDER_SUBMITTED',
  'ORDER_FILLED',
  'POSITION_UPDATED',
  'SYSTEM_HALT',
].includes(type);

const authorityForLedgerEvent = (type: string) => {
  if (type === 'MARKET_SNAPSHOT') return 'market_observation';
  if (type === 'SIGNAL') return 'strategy_observation';
  if (type === 'RISK_PASS' || type === 'RISK_REJECT') return 'deterministic_risk';
  if (type === 'SYSTEM_HALT') return 'system_guard';
  return 'paper_execution';
};

const severityForLedgerEvent = (type: string): CanonicalEventInput['severity'] => {
  if (type === 'SYSTEM_HALT') return 'CRITICAL';
  if (type === 'RISK_REJECT') return 'WARN';
  return 'INFO';
};

const summaryForLedgerEvent = (type: string, market: string | null, payload: any) => {
  const target = market ?? 'Paper runtime';
  const action = actionFromPayload(payload);
  switch (type) {
    case 'MARKET_SNAPSHOT':
      return `${target} market snapshot recorded${Number.isFinite(Number(payload?.price)) ? ` at ${Number(payload.price)}` : ''}.`;
    case 'SIGNAL':
      return `${target} strategy signal recorded${action ? ` · ${action}` : ''}.`;
    case 'RISK_PASS':
      return `${target} deterministic risk gate passed.`;
    case 'RISK_REJECT':
      return `${target} deterministic risk gate rejected the candidate.`;
    case 'ORDER_SUBMITTED':
      return `${target} order submitted${action ? ` · ${action}` : ''}.`;
    case 'ORDER_FILLED':
      return `${target} order filled${action ? ` · ${action}` : ''}.`;
    case 'POSITION_UPDATED':
      return `${target} Paper position state updated.`;
    case 'SYSTEM_HALT':
      return `${target} Paper runtime halt recorded.`;
    default:
      return `${target} Paper ledger event recorded.`;
  }
};

export const buildTradingSessionDeltaCanonicalEvents = (
  beforeSession: any,
  afterSession: any,
  runtimeId: string,
): CanonicalEventInput[] => {
  const events: CanonicalEventInput[] = [];
  const beforeLedgerIds = new Set(asArray(beforeSession?.ledger).map((item: any) => String(item?.id ?? '')));
  const newLedgerEvents = asArray(afterSession?.ledger).filter((item: any) => !beforeLedgerIds.has(String(item?.id ?? '')));

  for (const item of newLedgerEvents) {
    const type = String(item?.type ?? '');
    const eventType = canonicalTypeForLedgerEvent(type);
    if (!eventType) continue;
    const payload = item?.payload ?? {};
    const timestamp = Number(item?.timestamp ?? Date.now());
    const market = marketFromPayload(payload);
    const action = actionFromPayload(payload);
    const itemId = String(item?.id ?? `${timestamp}:${type}`);
    const reason = reasonFromPayload(payload);

    events.push({
      eventKey: `${runtimeId}:paper-ledger:${itemId}`,
      occurredAt: timestamp,
      runtimeId,
      eventType,
      eventName: type,
      market,
      strategyVersion: item?.strategyVersion == null ? null : String(item.strategyVersion),
      action,
      summary: summaryForLedgerEvent(type, market, payload),
      reason: reason ?? (type === 'ORDER_SUBMITTED' || type === 'ORDER_FILLED'
        ? 'Recorded directly from the Paper execution ledger.'
        : 'Archived from the Paper session ledger without retrospective reinterpretation.'),
      severity: severityForLedgerEvent(type),
      authority: authorityForLedgerEvent(type),
      executionAuthority: executionAuthorityForLedgerEvent(type),
      source: 'paper_trading_ledger',
      trace: {
        ledgerEventId: item?.id ?? null,
        ledgerType: type,
        sequence: item?.sequence ?? null,
        strategyVersion: item?.strategyVersion ?? null,
        payload,
      },
      links: {
        orderId: payload?.orderId ?? payload?.id ?? null,
        ledgerEventId: item?.id ?? null,
      },
    });
  }

  const beforeTradeIds = new Set(asArray(beforeSession?.closedTrades).map((trade: any) => String(trade?.id ?? '')));
  const newClosedTrades = asArray(afterSession?.closedTrades).filter((trade: any) => !beforeTradeIds.has(String(trade?.id ?? '')));
  for (const trade of newClosedTrades) {
    const tradeId = String(trade?.id ?? `${trade?.market ?? 'UNKNOWN'}:${trade?.closedAt ?? Date.now()}`);
    const netPnl = Number(trade?.netPnl ?? 0);
    events.push({
      eventKey: `${runtimeId}:paper-outcome:${tradeId}`,
      occurredAt: Number(trade?.closedAt ?? Date.now()),
      runtimeId,
      eventType: 'OUTCOME',
      eventName: 'PAPER_TRADE_CLOSED_OUTCOME',
      market: trade?.market == null ? null : String(trade.market),
      strategyVersion: trade?.strategyVersion == null ? null : String(trade.strategyVersion),
      action: 'CLOSED',
      summary: `${String(trade?.market ?? 'Paper')} trade closed with net PnL ${netPnl.toFixed(2)} and return ${(Number(trade?.returnPct ?? 0) * 100).toFixed(2)}%.`,
      reason: trade?.exitReason == null ? 'Closed trade recorded by Paper runtime.' : String(trade.exitReason),
      severity: netPnl < 0 ? 'WARN' : 'INFO',
      authority: 'observed_outcome',
      executionAuthority: false,
      source: 'paper_closed_trades',
      trace: {
        tradeId,
        openedAt: trade?.openedAt ?? null,
        closedAt: trade?.closedAt ?? null,
        entryPrice: trade?.entryPrice ?? null,
        exitPrice: trade?.exitPrice ?? null,
        quantity: trade?.quantity ?? null,
        grossPnl: trade?.grossPnl ?? null,
        fees: trade?.fees ?? null,
        netPnl,
        returnPct: trade?.returnPct ?? null,
        exitReason: trade?.exitReason ?? null,
        entryOracleTradeScore: trade?.entryOracleTradeScore ?? null,
        exitOracleTradeScore: trade?.exitOracleTradeScore ?? null,
        entryAudit: trade?.entryAudit ?? null,
      },
      links: { tradeId },
    });
  }

  return events;
};

export const buildTradingSessionRetryCanonicalEvents = (
  session: any,
  runtimeId: string,
  maxLedgerEvents = 256,
): CanonicalEventInput[] => {
  const ledger = asArray(session?.ledger);
  const bounded = ledger.slice(-Math.max(1, Math.trunc(maxLedgerEvents)));
  return buildTradingSessionDeltaCanonicalEvents(
    { ledger: [], closedTrades: asArray(session?.closedTrades) },
    { ledger: bounded, closedTrades: asArray(session?.closedTrades) },
    runtimeId,
  );
};
