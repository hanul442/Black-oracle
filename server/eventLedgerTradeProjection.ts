import type { CanonicalEventInput } from './eventLedger';

const asArray = <T = any>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const marketFromPayload = (payload: any) => payload?.market == null ? null : String(payload.market);

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
    if (type !== 'ORDER_SUBMITTED' && type !== 'ORDER_FILLED') continue;
    const payload = item?.payload ?? {};
    const timestamp = Number(item?.timestamp ?? Date.now());
    const market = marketFromPayload(payload);
    const action = payload?.side == null ? null : String(payload.side);
    events.push({
      eventKey: `${runtimeId}:paper-ledger:${String(item?.id ?? `${timestamp}:${type}`)}`,
      occurredAt: timestamp,
      runtimeId,
      eventType: type === 'ORDER_SUBMITTED' ? 'ORDER' : 'TRADE',
      eventName: type,
      market,
      strategyVersion: item?.strategyVersion == null ? null : String(item.strategyVersion),
      action,
      summary: `${market ?? 'Paper'} ${type === 'ORDER_SUBMITTED' ? 'order submitted' : 'order filled'}${action ? ` · ${action}` : ''}.`,
      reason: payload?.reason == null ? 'Recorded directly from the Paper execution ledger.' : String(payload.reason),
      severity: 'INFO',
      authority: 'paper_execution',
      executionAuthority: true,
      source: 'paper_trading_ledger',
      trace: {
        ledgerEventId: item?.id ?? null,
        sequence: item?.sequence ?? null,
        strategyVersion: item?.strategyVersion ?? null,
        payload,
      },
      links: {
        orderId: payload?.orderId ?? payload?.id ?? null,
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
