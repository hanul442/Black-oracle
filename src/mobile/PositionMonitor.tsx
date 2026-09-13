import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Database,
  RefreshCw,
  ShieldCheck,
  Target,
  XCircle,
} from 'lucide-react';
import type { ClosedTrade, DecisionTapeItem, OpenPosition, OperationsPayload, TradeMap } from './v2/types';
import { actionKo, cn, dateTime, reasonKo, regimeKo, timeAgo } from './v2/types';
import {
  formatKrw,
  formatPercent,
  formatQuantity,
  positionFinancials,
  type MarkedOpenPosition,
} from './v2/financial';

const green = '#16845b';
const red = '#d14b55';
const amber = '#a46b17';
const blue = '#3767d6';
const ink = '#111318';
const card = 'rounded-[24px] border border-[#e7e9ed] bg-white';
const ENTRY_DECISION_WINDOW_MS = 5 * 60_000;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const Metric = ({ label, value, accent, note }: { label: string; value: React.ReactNode; accent?: string; note?: React.ReactNode }) => (
  <div className="min-w-0">
    <div className="text-[9px] font-medium text-[#969ca4]">{label}</div>
    <div className="mt-1 truncate text-[15px] font-semibold tabular-nums tracking-[-0.02em]" style={{ color: accent ?? ink }}>{value}</div>
    {note && <div className="mt-1 text-[9px] leading-4 text-[#a0a5ac]">{note}</div>}
  </div>
);

const Pill = ({ children, color = '#737b86' }: { children: React.ReactNode; color?: string }) => (
  <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold" style={{ color, borderColor: `${color}28`, background: `${color}0b` }}>{children}</span>
);

type OperationsWithCheckpoint = OperationsPayload & {
  checkpoint?: { savedAt?: number | null };
};

type EntryAuditView = {
  timestamp?: number;
  eventScore?: number | null;
  regime?: string;
  regimeConfidence?: number;
  tradeMap?: TradeMap | null;
  microstructure?: null | {
    direction?: string;
    confidence?: number;
    pressureScore?: number | null;
    valueAreaLow?: number | null;
    valueAreaHigh?: number | null;
  };
  challenger?: null | {
    alignment?: string;
    confidence?: number;
    reasons?: string[];
  };
  technicalEvidence?: null | {
    rawSignalCount?: number;
    independentFamilyCount?: number;
    directionalScore?: number;
    confidence?: number;
  };
};

type PriceLevel = {
  key: string;
  label: string;
  value: number;
  color: string;
  emphasis?: boolean;
};

type DecisionLink = {
  decision: DecisionTapeItem | null;
  deltaMs: number | null;
};

const tone = (value: string | null | undefined) => {
  const text = String(value ?? '').toUpperCase();
  if (['ENTER', 'BUY', 'LONG', 'PASS', 'APPROVE', 'AGREE', 'SUCCESS', 'EXECUTED'].includes(text)) return green;
  if (['EXIT', 'SELL', 'SHORT', 'REJECT', 'FAIL', 'ERROR', 'DISSENT', 'CONFLICTS'].includes(text)) return red;
  return amber;
};

const auditOf = (trade: ClosedTrade): EntryAuditView | null => (
  trade.entryAudit && typeof trade.entryAudit === 'object' ? trade.entryAudit as EntryAuditView : null
);

const latestDecisionFor = (operations: OperationsPayload | null, market: string) => (
  (operations?.decisionTape ?? [])
    .filter((item) => item.market?.toUpperCase() === market.toUpperCase())
    .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null
);

const entryDecisionForTrade = (operations: OperationsPayload | null, trade: ClosedTrade): DecisionLink => {
  const candidates = (operations?.decisionTape ?? [])
    .filter((item) => item.market?.toUpperCase() === trade.market.toUpperCase())
    .map((decision) => ({ decision, deltaMs: Math.abs(decision.timestamp - trade.openedAt) }))
    .sort((a, b) => a.deltaMs - b.deltaMs);
  const nearest = candidates[0];
  if (!nearest || nearest.deltaMs > ENTRY_DECISION_WINDOW_MS) return { decision: null, deltaMs: nearest?.deltaMs ?? null };
  return nearest;
};

const priceLocation = (position: OpenPosition, current: number | null) => {
  if (!finite(current)) return '현재가 미확인';
  const stop = position.stopLossPrice;
  const entry = finite(position.averageCost) ? position.averageCost : position.entryPrice;
  const tp1 = position.takeProfit1Price ?? position.takeProfitPrice;
  const tp2 = position.takeProfit2Price;
  if (finite(stop) && current <= stop) return '손절선 하회';
  if (finite(entry) && current < entry) return '진입가 아래';
  if (finite(tp1) && current < tp1) return '진입가 → TP1';
  if (finite(tp2) && current < tp2) return 'TP1 → TP2';
  if (finite(tp2) && current >= tp2) return 'TP2 상회';
  if (finite(tp1) && current >= tp1) return 'TP1 상회';
  return '보유 구간';
};

const targetDistance = (current: number | null, target: number | null | undefined) => (
  finite(current) && current > 0 && finite(target) ? (target - current) / current : null
);

const durationText = (openedAt: number, closedAt: number) => {
  const minutes = Math.max(0, Math.round((closedAt - openedAt) / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}분`;
  return `${hours}시간 ${rest}분`;
};

const DecisionStep = ({ label, value, detail }: { label: string; value: string; detail?: string }) => (
  <div className="rounded-[17px] border border-[#eceef1] bg-[#fafbfc] px-3 py-3">
    <div className="text-[8px] font-semibold tracking-[0.08em] text-[#a0a5ac]">{label}</div>
    <div className="mt-1 text-[11px] font-semibold" style={{ color: tone(value) }}>{value}</div>
    {detail && <div className="mt-1 line-clamp-2 text-[8px] leading-4 text-[#959ca4]">{detail}</div>}
  </div>
);

const PriceTrack = ({ position, decision }: { position: OpenPosition; decision: DecisionTapeItem | null }) => {
  const marked = position as MarkedOpenPosition;
  const current = finite(marked.markPrice) ? marked.markPrice : null;
  const entry = finite(position.averageCost) ? position.averageCost : position.entryPrice;
  const stop = position.stopLossPrice;
  const tp1 = position.takeProfit1Price ?? position.takeProfitPrice;
  const tp2 = position.takeProfit2Price;
  const valueLow = decision?.microstructure?.valueAreaLow;
  const valueHigh = decision?.microstructure?.valueAreaHigh;
  const valueArea = finite(valueLow) && finite(valueHigh) && valueHigh >= valueLow
    ? { low: valueLow, high: valueHigh }
    : null;

  const levels = [
    finite(stop) ? { key: 'stop', label: 'SL', value: stop, color: red } : null,
    finite(entry) ? { key: 'entry', label: 'ENTRY', value: entry, color: ink } : null,
    finite(current) ? { key: 'current', label: 'NOW', value: current, color: blue, emphasis: true } : null,
    finite(tp1) ? { key: 'tp1', label: 'TP1', value: tp1, color: green } : null,
    finite(tp2) ? { key: 'tp2', label: 'TP2', value: tp2, color: green } : null,
  ].filter(Boolean) as PriceLevel[];

  const rangeValues = [...levels.map((item) => item.value), ...(valueArea ? [valueArea.low, valueArea.high] : [])];
  if (rangeValues.length < 2) return <div className="rounded-[18px] bg-[#f7f8fa] p-4 text-[10px] leading-5 text-[#8d939b]">가격 지도를 그릴 데이터가 충분하지 않습니다.</div>;
  const rawMin = Math.min(...rangeValues);
  const rawMax = Math.max(...rangeValues);
  const rawRange = Math.max(rawMax - rawMin, Math.max(Math.abs(rawMax), 1) * 0.002);
  const min = rawMin - rawRange * 0.06;
  const max = rawMax + rawRange * 0.06;
  const range = max - min;
  const leftOf = (value: number) => ((value - min) / range) * 100;

  return <div className="rounded-[20px] border border-[#eceef1] bg-[#fafbfc] p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[10px] font-semibold text-[#3a3f46]">Active protection map</div>
        <div className="mt-1 text-[9px] text-[#969ca4]">현재 포지션 SL/TP가 권위값입니다. Value Area는 최신 관찰값입니다.</div>
      </div>
      <Pill color={finite(current) && finite(stop) && current <= stop ? red : blue}>{priceLocation(position, current)}</Pill>
    </div>
    <div className="relative mx-2 mt-5 h-20">
      <div className="absolute left-0 right-0 top-10 h-[2px] rounded-full bg-[#dfe2e6]" />
      {valueArea && <div
        className="absolute top-[34px] h-3 rounded-full border border-[#d7dde6] bg-[#eef2f7]"
        style={{ left: `${leftOf(valueArea.low)}%`, width: `${Math.max(1, leftOf(valueArea.high) - leftOf(valueArea.low))}%` }}
      />}
      {levels.map((item) => <div key={item.key} className="absolute top-1 -translate-x-1/2" style={{ left: `${leftOf(item.value)}%` }}>
        <div className="text-center text-[8px] font-semibold" style={{ color: item.color }}>{item.label}</div>
        <div className={cn('mx-auto mt-1 w-[2px]', item.emphasis ? 'h-11' : 'h-8')} style={{ background: item.color }} />
      </div>)}
    </div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">{levels.map((item) => <div key={item.key} className="flex items-center justify-between text-[9px]"><span className="font-semibold" style={{ color: item.color }}>{item.label}</span><span className="tabular-nums text-[#737a83]">{formatKrw(item.value)}</span></div>)}</div>
    <div className="mt-4 border-t border-[#e7eaee] pt-3">
      {valueArea ? <div className="flex items-start justify-between gap-4"><div><div className="text-[9px] font-semibold text-[#646c76]">관찰 가격대 · Value Area</div><div className="mt-1 text-[9px] leading-4 text-[#969ca4]">미시구조 거래분포 기준이며 기업가치 적정가가 아닙니다.</div></div><div className="shrink-0 text-right text-[10px] font-semibold tabular-nums text-[#3f4650]">{formatKrw(valueArea.low)}–{formatKrw(valueArea.high)}</div></div> : <div className="text-[9px] leading-4 text-[#969ca4]">현재 canonical microstructure에 Value Area 범위가 없습니다. 없는 가격대를 임의 생성하지 않습니다.</div>}
    </div>
  </div>;
};

const PositionCard = ({ position, operations }: { position: OpenPosition; operations: OperationsWithCheckpoint | null }) => {
  const financials = positionFinancials(position);
  const current = financials.markPrice;
  const latestDecision = latestDecisionFor(operations, position.market);
  const latestCandidate = latestDecision?.tradeMap;
  const stop = position.stopLossPrice;
  const tp1 = position.takeProfit1Price ?? position.takeProfitPrice;
  const tp2 = position.takeProfit2Price;
  const checkpointAt = operations?.checkpoint?.savedAt ?? null;
  const portfolioEquity = operations?.portfolio?.equity;
  const portfolioWeight = finite(portfolioEquity) && portfolioEquity > 0 && financials.marketValue != null ? financials.marketValue / portfolioEquity : null;
  const pnlAccent = (financials.unrealizedPnl ?? 0) >= 0 ? green : red;
  const stopDistance = targetDistance(current, stop);
  const tp1Distance = targetDistance(current, tp1);

  return <section className={cn(card, 'overflow-hidden')}>
    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><div className="text-[18px] font-semibold tracking-[-0.03em] text-[#15171c]">{position.market}</div><Pill color={blue}>OPEN · PAPER</Pill></div>
          <div className="mt-1 text-[10px] text-[#969ca4]">매수 {dateTime(position.openedAt)} · {timeAgo(position.openedAt)}</div>
        </div>
        <Pill color={pnlAccent}>{financials.unrealizedReturn != null ? formatPercent(financials.unrealizedReturn, true) : 'P&L —'}</Pill>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-[9px] font-medium text-[#969ca4]">현재 가격 · Paper mark</div>
          <div className="mt-1 text-[30px] font-semibold tabular-nums tracking-[-0.045em] text-[#111318]">{formatKrw(current)}</div>
          <div className="mt-1 text-[9px] text-[#9ca1a8]">runtime snapshot {checkpointAt ? timeAgo(checkpointAt) : '시각 미확인'}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-[#969ca4]">평가손익</div>
          <div className="mt-1 text-[17px] font-semibold tabular-nums" style={{ color: pnlAccent }}>{formatKrw(financials.unrealizedPnl, true)}</div>
          <div className="mt-1 text-[9px] text-[#9ca1a8]">평가액 {formatKrw(financials.marketValue)}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-[#eef0f2] pt-4">
        <Metric label="투입원금 · Cost basis" value={formatKrw(financials.costBasis)} />
        <Metric label="포트폴리오 비중" value={formatPercent(portfolioWeight)} />
        <Metric label="현재 평가액" value={formatKrw(financials.marketValue)} />
        <Metric label="보유수량" value={formatQuantity(financials.quantity)} />
        <Metric label="진입가" value={formatKrw(position.entryPrice)} />
        <Metric label="평균단가" value={formatKrw(position.averageCost)} />
        <Metric label="현재 손절가" value={formatKrw(stop)} accent={red} note={stopDistance != null ? `현재가 대비 ${formatPercent(stopDistance, true)}` : undefined} />
        <Metric label="현재 TP1" value={formatKrw(tp1)} accent={green} note={tp1Distance != null ? `현재가 대비 ${formatPercent(tp1Distance, true)}` : undefined} />
        <Metric label="현재 TP2" value={formatKrw(tp2)} accent={green} />
      </div>
    </div>

    <div className="border-t border-[#eef0f2] bg-[#fbfbfc] p-4"><PriceTrack position={position} decision={latestDecision} /></div>

    <div className="border-t border-[#eef0f2] px-5 py-4">
      <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-[#606873]" /><div><div className="text-[11px] font-semibold text-[#343940]">현재 실행 포지션 계획</div><div className="mt-1 text-[9px] leading-4 text-[#969ca4]">위 SL/TP는 실제 열린 포지션에서 읽은 값입니다. 최신 Oracle 후보와 섞지 않습니다.</div></div></div>
    </div>

    <details className="border-t border-[#eef0f2] px-5 py-4">
      <summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-semibold text-[#525960]">Latest Oracle candidate</div><div className="mt-1 text-[9px] text-[#9aa1a9]">새 진입 후보 · 현재 포지션의 불변 entry plan이 아님</div></div><ChevronRight className="h-4 w-4 text-[#a1a7ae]" /></div></summary>
      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
        <Metric label="Candidate Entry" value={formatKrw(latestCandidate?.entryPrice)} />
        <Metric label="Candidate Stop" value={formatKrw(latestCandidate?.stopLossPrice ?? latestCandidate?.structuralInvalidationPrice)} accent={red} />
        <Metric label="Candidate TP1" value={formatKrw(latestCandidate?.takeProfit1Price)} accent={green} />
        <Metric label="Candidate TP2" value={formatKrw(latestCandidate?.takeProfit2Price)} accent={green} />
      </div>
      <div className="mt-3 rounded-[15px] border border-[#eee6d8] bg-[#fffaf2] px-3 py-3 text-[9px] leading-4 text-[#8d7349]">{latestDecision ? `${dateTime(latestDecision.timestamp)} 최신 분석 · ${reasonKo(latestDecision.primaryReason ?? latestDecision.reasons?.[0])}` : '최신 canonical decision이 없습니다.'}</div>
    </details>
  </section>;
};

const tradeClassification = (trade: ClosedTrade, decision: DecisionTapeItem | null, audit: EntryAuditView | null) => {
  const verdict = String(decision?.council?.verdict ?? '').toUpperCase();
  const aiStance = String(decision?.aiCouncilReview?.stance ?? decision?.council?.aiReview?.stance ?? '').toUpperCase();
  const challenger = String(audit?.challenger?.alignment ?? decision?.challenger?.alignment ?? '').toUpperCase();
  const evidenceGap = decision?.evidenceActiveCount === 0;
  const conflict = ['CONDITIONAL', 'REVIEW', 'CAUTION', 'REJECT'].some((value) => verdict.includes(value))
    || ['DISSENT', 'CAUTION'].includes(aiStance)
    || challenger === 'CONFLICTS'
    || evidenceGap;
  if (trade.netPnl > 0 && conflict) return { label: 'PROFITABLE · FRAGILE WINNER', color: amber };
  if (trade.netPnl > 0) return { label: 'PROFITABLE WINNER', color: green };
  if (trade.netPnl < 0 && conflict) return { label: 'LOSS · WARNINGS CONFIRMED', color: red };
  if (trade.netPnl < 0) return { label: 'LOSS · REVIEW REQUIRED', color: red };
  return { label: 'BREAKEVEN · INCONCLUSIVE', color: amber };
};

const TradeExplainability = ({ trade, operations, onBack }: { trade: ClosedTrade; operations: OperationsWithCheckpoint | null; onBack: () => void }) => {
  const audit = auditOf(trade);
  const linked = entryDecisionForTrade(operations, trade);
  const decision = linked.decision;
  const entryPlan = audit?.tradeMap ?? null;
  const latest = latestDecisionFor(operations, trade.market);
  const aiReview = decision?.aiCouncilReview ?? decision?.council?.aiReview ?? null;
  const councilAuthority = decision?.council?.members?.some((member) => member.executionAuthority === true) === true;
  const classification = tradeClassification(trade, decision, audit);
  const quantity = finite(trade.quantity) ? trade.quantity : null;
  const notional = quantity != null ? trade.entryPrice * quantity : null;
  const decisionDeltaMinutes = linked.deltaMs == null ? null : linked.deltaMs / 60_000;
  const warnings: string[] = [];
  const verdict = String(decision?.council?.verdict ?? '').toUpperCase();
  const aiStance = String(aiReview?.stance ?? '').toUpperCase();
  const challengerAlignment = String(audit?.challenger?.alignment ?? '').toUpperCase();
  if (verdict && !['APPROVE', 'AGREE', 'PASS'].includes(verdict)) warnings.push(`Council ${decision?.council?.verdict}`);
  if (['DISSENT', 'CAUTION'].includes(aiStance)) warnings.push(`AI Council ${aiReview?.stance}`);
  if (challengerAlignment === 'CONFLICTS') warnings.push('Microstructure challenger conflict');
  if (decision?.evidenceActiveCount === 0) warnings.push('Linked evidence 0');
  if (decision && !councilAuthority) warnings.push('Council shadow-only');

  const brief = trade.netPnl >= 0
    ? `이 거래는 ${formatKrw(trade.netPnl, true)}의 수익으로 종료됐습니다.${warnings.length ? ` 다만 ${warnings.slice(0, 3).join(' · ')} 경고가 있어 수익만으로 전략 우수성을 확정하면 안 됩니다.` : ' 진입 시점의 주요 경고는 현재 연결 데이터에서 확인되지 않습니다.'}`
    : `이 거래는 ${formatKrw(trade.netPnl, true)}의 손실로 종료됐습니다.${warnings.length ? ` 진입 당시 ${warnings.slice(0, 3).join(' · ')} 경고가 기록돼 있어 실패 원인과의 연결을 재검증해야 합니다.` : ' 현재 연결 데이터만으로는 손실 원인을 단정할 수 없습니다.'}`;

  return <div className="fixed inset-0 z-[110] overflow-y-auto overscroll-contain bg-[#f6f7f9] text-[#111318]">
    <div className="sticky top-0 z-30 border-b border-[#e8ebee] bg-white/96 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e7ea] bg-white" aria-label="거래 상세 닫기"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0"><div className="text-[9px] font-semibold tracking-[0.16em] text-[#9ba1a9]">TRADE EXPLAINABILITY</div><div className="mt-0.5 truncate text-[19px] font-semibold tracking-[-0.035em]">{trade.market}</div></div>
      </div>
    </div>

    <main className="px-4 pb-16 pt-4">
      <section className={cn(card, 'p-5')}>
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-[10px] text-[#9298a0]">Closed Paper trade</div><div className="mt-2 text-[31px] font-semibold tabular-nums tracking-[-0.05em]" style={{ color: trade.netPnl >= 0 ? green : red }}>{formatKrw(trade.netPnl, true)}</div><div className="mt-1 text-[12px] font-semibold" style={{ color: trade.returnPct >= 0 ? green : red }}>{formatPercent(trade.returnPct, true)}</div></div>
          <Pill color={classification.color}>{classification.label}</Pill>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-[#eef0f2] pt-4">
          <Metric label="진입가" value={formatKrw(trade.entryPrice)} />
          <Metric label="평균 청산가" value={formatKrw(trade.exitPrice)} />
          <Metric label="진입 시각" value={dateTime(trade.openedAt)} />
          <Metric label="종료 시각" value={dateTime(trade.closedAt)} />
          <Metric label="보유시간" value={durationText(trade.openedAt, trade.closedAt)} />
          <Metric label="진입 명목금액" value={formatKrw(notional)} note="수량×체결가 기준" />
          <Metric label="수수료" value={formatKrw(trade.fees)} />
          <Metric label="수량" value={quantity == null ? '—' : formatQuantity(quantity)} />
        </div>
      </section>

      <section className={cn(card, 'mt-3 p-5')}>
        <div className="flex items-start gap-3"><Brain className="mt-0.5 h-5 w-5 shrink-0 text-[#555d67]" /><div><div className="text-[11px] font-semibold text-[#30353c]">Oracle Brief</div><div className="mt-2 text-[11px] leading-6 text-[#69717b]">{brief}</div></div></div>
      </section>

      <section className="mt-7">
        <div className="mb-3"><div className="text-[16px] font-semibold tracking-[-0.025em]">왜 이 거래가 실행됐나</div><div className="mt-1 text-[10px] leading-5 text-[#8e949c]">진입 시각과 5분 이내의 decision만 당시 판단으로 연결합니다. 최신 후보를 과거 거래에 덮어쓰지 않습니다.</div></div>
        {decision ? <div className="grid grid-cols-2 gap-2">
          <DecisionStep label="ROUTER" value={decision.router?.route ?? decision.strategyDisposition ?? 'UNKNOWN'} detail={decision.router?.reasons?.[0] ? reasonKo(decision.router.reasons[0]) : undefined} />
          <DecisionStep label="RISK GATE" value={decision.riskDisposition ?? 'UNKNOWN'} detail={decision.riskReasons?.[0] ? reasonKo(decision.riskReasons[0]) : undefined} />
          <DecisionStep label="COUNCIL" value={decision.council?.verdict ?? 'UNKNOWN'} detail={decision.council?.summary ?? undefined} />
          <DecisionStep label="AI REVIEW" value={aiReview?.stance ?? 'UNAVAILABLE'} detail={aiReview?.rationale ?? aiReview?.concerns?.[0]} />
          <DecisionStep label="AUTHORITY" value={councilAuthority ? 'EXECUTION ENABLED' : 'SHADOW / ADVISORY'} detail={councilAuthority ? 'Council veto가 실행에 반영되는 상태' : 'Council 경고는 기록되지만 당시 주문을 차단하지 않음'} />
          <DecisionStep label="RESULT" value="EXECUTED" detail={`${actionKo(decision.decision)} · ${regimeKo(decision.regime)}`} />
        </div> : <div className="rounded-[20px] border border-[#eee6d8] bg-[#fffaf2] p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#a8772d]" /><div><div className="text-[10px] font-semibold text-[#7f622e]">진입 Decision 연결 불확실</div><div className="mt-1 text-[9px] leading-5 text-[#8d7349]">{decisionDeltaMinutes == null ? '이 거래와 같은 종목의 decision을 찾지 못했습니다.' : `가장 가까운 decision이 진입 시각과 ${decisionDeltaMinutes.toFixed(1)}분 차이여서 자동 연결하지 않았습니다.`}</div></div></div></div>}
      </section>

      <section className="mt-7">
        <div className="mb-3"><div className="text-[16px] font-semibold tracking-[-0.025em]">Entry plan · 불변 감사 스냅샷</div><div className="mt-1 text-[10px] leading-5 text-[#8e949c]">종료 거래에 저장된 entryAudit.tradeMap만 사용합니다. 이후 새 candidate map은 여기 들어오지 않습니다.</div></div>
        <div className={cn(card, 'p-4')}>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <Metric label="Entry plan" value={formatKrw(entryPlan?.entryPrice ?? trade.entryPrice)} />
            <Metric label="Initial stop" value={formatKrw(entryPlan?.stopLossPrice ?? entryPlan?.structuralInvalidationPrice)} accent={red} />
            <Metric label="TP1" value={formatKrw(entryPlan?.takeProfit1Price)} accent={green} />
            <Metric label="TP2" value={formatKrw(entryPlan?.takeProfit2Price)} accent={green} />
            <Metric label="R:R 1" value={finite(entryPlan?.riskReward1) ? `${entryPlan?.riskReward1?.toFixed(2)}×` : '—'} />
            <Metric label="R:R 2" value={finite(entryPlan?.riskReward2) ? `${entryPlan?.riskReward2?.toFixed(2)}×` : '—'} />
          </div>
          {!entryPlan && <div className="mt-4 rounded-[15px] border border-[#eee6d8] bg-[#fffaf2] px-3 py-3 text-[9px] leading-4 text-[#8d7349]">이 과거 거래에는 불변 entry trade map이 저장되지 않았습니다. 최신 trade map으로 대체하지 않습니다.</div>}
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-3"><div className="text-[16px] font-semibold tracking-[-0.025em]">경고와 반대 근거</div><div className="mt-1 text-[10px] text-[#8e949c]">성과와 의사결정 품질을 분리해서 봅니다.</div></div>
        <div className={cn(card, 'divide-y divide-[#eef0f2]')}>
          <div className="flex items-start gap-3 px-4 py-4">{decision?.evidenceActiveCount === 0 ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#c75961]" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4d936e]" />}<div><div className="text-[10px] font-semibold text-[#444a52]">Evidence linkage</div><div className="mt-1 text-[9px] leading-4 text-[#8e959e]">{decision ? `진입 decision에 active evidence ${decision.evidenceActiveCount ?? '미확인'}건 · contradiction ${decision.evidenceContradictionCount ?? '미확인'}건` : '진입 decision이 연결되지 않아 Evidence 상태를 확정하지 않습니다.'}</div></div></div>
          <div className="flex items-start gap-3 px-4 py-4">{challengerAlignment === 'CONFLICTS' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b67a25]" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4d936e]" />}<div><div className="text-[10px] font-semibold text-[#444a52]">Microstructure challenger</div><div className="mt-1 text-[9px] leading-4 text-[#8e959e]">{audit?.challenger?.alignment ?? 'UNAVAILABLE'}{finite(audit?.challenger?.confidence) ? ` · confidence ${formatPercent(audit?.challenger?.confidence)}` : ''}{audit?.challenger?.reasons?.[0] ? ` · ${audit.challenger.reasons[0]}` : ''}</div></div></div>
          <div className="flex items-start gap-3 px-4 py-4">{councilAuthority ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4d936e]" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b67a25]" />}<div><div className="text-[10px] font-semibold text-[#444a52]">Council authority</div><div className="mt-1 text-[9px] leading-4 text-[#8e959e]">{decision ? (councilAuthority ? 'Council 판단에 실행 권한이 기록돼 있습니다.' : 'Shadow/advisory 상태라 Council 경고 자체가 주문을 막지는 않았습니다.') : '진입 decision 연결 전에는 당시 authority를 확정하지 않습니다.'}</div></div></div>
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-3"><div className="text-[16px] font-semibold tracking-[-0.025em]">결과 해석</div><div className="mt-1 text-[10px] text-[#8e949c]">돈을 벌었는지와 재현 가능한 좋은 거래였는지는 별개입니다.</div></div>
        <div className={cn(card, 'p-4')}>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <Metric label="Financial result" value={formatKrw(trade.netPnl, true)} accent={trade.netPnl >= 0 ? green : red} />
            <Metric label="Return" value={formatPercent(trade.returnPct, true)} accent={trade.returnPct >= 0 ? green : red} />
            <Metric label="Entry Oracle score" value={finite(trade.entryOracleTradeScore) ? trade.entryOracleTradeScore.toFixed(1) : '—'} />
            <Metric label="Exit Oracle score" value={finite(trade.exitOracleTradeScore) ? trade.exitOracleTradeScore.toFixed(1) : '—'} />
          </div>
          <div className="mt-4 rounded-[15px] bg-[#f7f8fa] px-3 py-3 text-[9px] leading-5 text-[#7d858e]">MAE · MFE · R-multiple · fill-latency edge는 현재 trading-status payload에 canonical outcome metric으로 노출되지 않습니다. 이 값이 없는데 UI에서 추정해 좋은 거래처럼 포장하지 않습니다.</div>
        </div>
      </section>

      <details className={cn(card, 'mt-7 overflow-hidden')}>
        <summary className="cursor-pointer list-none px-4 py-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Database className="h-4 w-4 text-[#68717b]" /><div><div className="text-[11px] font-semibold text-[#40464d]">Audit details</div><div className="mt-0.5 text-[9px] text-[#9aa1a9]">Level 3 · 원장·모델·매칭 정보</div></div></div><ChevronRight className="h-4 w-4 text-[#a1a7ae]" /></div></summary>
        <div className="border-t border-[#eef0f2] px-4 py-4">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <Metric label="Trade ID" value={trade.id} />
            <Metric label="Strategy version" value={trade.strategyVersion} />
            <Metric label="Entry audit at" value={finite(audit?.timestamp) ? dateTime(audit?.timestamp ?? 0) : '—'} />
            <Metric label="Decision delta" value={decisionDeltaMinutes == null ? '—' : `${decisionDeltaMinutes.toFixed(2)}m`} />
            <Metric label="Regime" value={audit?.regime ? regimeKo(audit.regime) : decision ? regimeKo(decision.regime) : '—'} />
            <Metric label="Event score" value={finite(audit?.eventScore) ? audit?.eventScore?.toFixed(2) : '—'} />
          </div>
          {decision?.evidenceIds?.length ? <div className="mt-4"><div className="text-[9px] font-semibold text-[#777f88]">Evidence IDs</div><div className="mt-2 break-all text-[8px] leading-4 text-[#9aa1a9]">{decision.evidenceIds.join(' · ')}</div></div> : null}
          {decision?.council?.members?.length ? <div className="mt-4 border-t border-[#eef0f2] pt-4"><div className="text-[9px] font-semibold text-[#777f88]">Council votes</div><div className="mt-2 space-y-2">{decision.council.members.map((member, index) => <div key={`${member.role}-${index}`} className="flex items-center justify-between gap-3 text-[9px]"><span className="text-[#777f88]">{member.role}</span><span className="font-semibold" style={{ color: tone(member.vote) }}>{member.vote} · {formatPercent(member.confidence)}</span></div>)}</div></div> : null}
          {latest && latest.timestamp !== decision?.timestamp ? <div className="mt-4 rounded-[15px] border border-[#e5e8ec] bg-[#fafbfc] px-3 py-3 text-[9px] leading-4 text-[#858d96]">현재 최신 candidate는 {dateTime(latest.timestamp)}의 별도 판단입니다. 이 종료 거래의 entry plan으로 사용하지 않습니다.</div> : null}
        </div>
      </details>
    </main>
  </div>;
};

const ClosedTradeRow = ({ trade, open }: { trade: ClosedTrade; open: () => void }) => (
  <button type="button" onClick={open} className={cn(card, 'w-full px-4 py-4 text-left active:scale-[0.995]')}>
    <div className="flex items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><span className="text-[14px] font-semibold text-[#22262c]">{trade.market}</span><Pill color={trade.netPnl >= 0 ? green : red}>{trade.netPnl >= 0 ? 'WIN' : 'LOSS'}</Pill></div><div className="mt-1 text-[9px] text-[#9ba1a9]">{dateTime(trade.openedAt)} → {dateTime(trade.closedAt)}</div><div className="mt-2 text-[9px] leading-4 text-[#858d96]">Entry {formatKrw(trade.entryPrice)} · Exit {formatKrw(trade.exitPrice)} · {durationText(trade.openedAt, trade.closedAt)}</div></div>
      <div className="flex items-center gap-2"><div className="text-right"><div className="text-[12px] font-semibold tabular-nums" style={{ color: trade.netPnl >= 0 ? green : red }}>{formatKrw(trade.netPnl, true)}</div><div className="mt-1 text-[9px] font-semibold" style={{ color: trade.returnPct >= 0 ? green : red }}>{formatPercent(trade.returnPct, true)}</div></div><ChevronRight className="h-4 w-4 text-[#b0b6bd]" /></div>
    </div>
  </button>
);

export const PositionMonitor = () => {
  const [operations, setOperations] = useState<OperationsWithCheckpoint | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<ClosedTrade | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/trading-status', { cache: 'no-store' });
      const payload = await response.json() as OperationsWithCheckpoint & { error?: string };
      if (!response.ok || payload.status === 'ERROR' || payload.status === 'UNAVAILABLE') {
        setError(payload.error ?? 'Trading status unavailable.');
      } else {
        setError(null);
      }
      setOperations(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Trading status unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const positions = operations?.portfolio?.openPositions ?? [];
  const trades = operations?.recentTrades ?? [];
  const sorted = useMemo(() => [...positions].sort((a, b) => b.openedAt - a.openedAt), [positions]);
  const recentTrades = useMemo(() => [...trades].sort((a, b) => b.closedAt - a.closedAt).slice(0, 12), [trades]);
  const openCost = positions.reduce((sum, position) => sum + (positionFinancials(position).costBasis ?? 0), 0);
  const openValue = positions.reduce((sum, position) => sum + (positionFinancials(position).marketValue ?? 0), 0);
  const portfolioEquity = operations?.portfolio?.equity;
  const exposure = finite(portfolioEquity) && portfolioEquity > 0 ? openValue / portfolioEquity : null;

  if (selectedTrade) return <TradeExplainability trade={selectedTrade} operations={operations} onBack={() => setSelectedTrade(null)} />;

  return <>
    {!open && <button
      type="button"
      onClick={() => setOpen(true)}
      className="fixed bottom-[148px] right-4 z-[70] flex h-12 items-center gap-2 rounded-full border border-[#dfe3e7] bg-white px-4 text-[10px] font-semibold text-[#25292f] shadow-[0_8px_26px_rgba(16,20,24,0.12)] active:scale-[0.985]"
      aria-label="거래 컨트롤 열기"
    >
      <BriefcaseBusiness className="h-4 w-4" />
      Trades · {positions.length} open
    </button>}

    {open && <div className="fixed inset-0 z-[95] overflow-y-auto overscroll-contain bg-[#f6f7f9] text-[#111318]">
      <div className="sticky top-0 z-30 border-b border-[#e8ebee] bg-white/96 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e7ea] bg-white" aria-label="거래 컨트롤 닫기"><ArrowLeft className="h-4 w-4" /></button>
            <div><div className="text-[9px] font-semibold tracking-[0.16em] text-[#9ba1a9]">TRADE CONTROL</div><div className="mt-0.5 text-[19px] font-semibold tracking-[-0.035em] text-[#15171c]">Positions & Outcomes</div></div>
          </div>
          <button type="button" onClick={() => void load()} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e7ea] bg-white" aria-label="거래 데이터 새로고침"><RefreshCw className={cn('h-4 w-4 text-[#626871]', loading && 'animate-spin')} /></button>
        </div>
      </div>

      <main className="px-4 pb-16 pt-4">
        <section className="grid grid-cols-2 gap-1.5 rounded-[20px] border border-[#e9eaed] bg-white p-2">
          <div className="rounded-[14px] bg-[#f7f8fa] px-3 py-3"><div className="text-[8px] text-[#9ca1a8]">Open</div><div className="mt-1 text-[12px] font-semibold text-[#34383e]">{positions.length}</div></div>
          <div className="rounded-[14px] bg-[#f7f8fa] px-3 py-3"><div className="text-[8px] text-[#9ca1a8]">Recent outcomes</div><div className="mt-1 text-[12px] font-semibold text-[#34383e]">{recentTrades.length}</div></div>
          <div className="rounded-[14px] bg-[#f7f8fa] px-3 py-3"><div className="text-[8px] text-[#9ca1a8]">Invested · Paper</div><div className="mt-1 truncate text-[11px] font-semibold text-[#34383e]">{positions.length ? formatKrw(openCost) : '—'}</div></div>
          <div className="rounded-[14px] bg-[#f7f8fa] px-3 py-3"><div className="text-[8px] text-[#9ca1a8]">Exposure</div><div className="mt-1 text-[11px] font-semibold text-[#34383e]">{formatPercent(exposure)}</div><div className="mt-1 text-[8px] text-[#9ca1a8]">{operations?.checkpoint?.savedAt ? `snapshot ${timeAgo(operations.checkpoint.savedAt)}` : operations?.status ?? 'UNKNOWN'}</div></div>
        </section>

        {error && <section className="mt-3 flex gap-3 rounded-[20px] border border-[#f1d8da] bg-[#fff8f8] p-4"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c75961]" /><div><div className="text-[11px] font-semibold text-[#9e333b]">Trade data warning</div><div className="mt-1 text-[9px] leading-4 text-[#99686d]">{error}</div></div></section>}

        <section className="mt-7">
          <div className="mb-3"><div className="text-[16px] font-semibold tracking-[-0.025em]">Open positions</div><div className="mt-1 text-[10px] text-[#8e949c]">실제 열린 포지션의 보호값을 최신 후보 trade map과 분리합니다.</div></div>
          <div className="space-y-3">
            {sorted.map((position) => <PositionCard key={`${position.market}-${position.openedAt}`} position={position} operations={operations} />)}
            {!sorted.length && <div className={cn(card, 'p-6')}><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[#6b747e]" /><div><div className="text-[12px] font-semibold text-[#30353c]">현재 열린 Paper 포지션이 없습니다.</div><div className="mt-1 text-[10px] leading-5 text-[#8a919a]">NO_TRADE도 정상적인 결정입니다. 아래 종료 거래에서 과거 판단과 결과를 복기할 수 있습니다.</div></div></div></div>}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-3"><div className="text-[16px] font-semibold tracking-[-0.025em]">Recent closed trades</div><div className="mt-1 text-[10px] leading-5 text-[#8e949c]">수익률만 보지 않고 클릭하면 당시 판단 → 불변 entry plan → 경고 → 결과 해석 순서로 보여줍니다.</div></div>
          <div className="space-y-2">{recentTrades.map((trade) => <ClosedTradeRow key={trade.id} trade={trade} open={() => setSelectedTrade(trade)} />)}{!recentTrades.length && <div className={cn(card, 'p-5 text-[10px] text-[#8d939b]')}>완료된 거래가 없습니다.</div>}</div>
        </section>
      </main>
    </div>}
  </>;
};
