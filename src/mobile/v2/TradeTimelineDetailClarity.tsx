import React, { useState } from 'react';
import type { DecisionTapeItem, LedgerEvent } from './types';
import { actionKo, dateTime, eventTypeKo, pct, reasonKo, regimeKo } from './types';
import { DetailShell, EmptyCard, EventCard, Metric, Pill, ProtectionCard, ScoreGauge, SectionTitle } from './ui';
import { formatKrw, formatQuantity } from './financial';

export const TradeTimelineDetailClarity = ({ decisions, selected, onSelectDecision, events, recentTrades, onSelectEvent, onAnalysis, onBack }: { decisions: DecisionTapeItem[]; selected: DecisionTapeItem | null; onSelectDecision: (decision: DecisionTapeItem) => void; events: LedgerEvent[]; recentTrades: any[]; onSelectEvent: (event: LedgerEvent) => void; onAnalysis: () => void; onBack: () => void }) => {
  const [filter, setFilter] = useState('ALL');
  const types = ['DECISION', 'RISK', 'ORDER', 'TRADE', 'OUTCOME'];
  const timeline = events.filter((event) => types.includes(event.eventType) && (filter === 'ALL' || event.eventType === filter));
  return (
    <DetailShell title="거래 현황" subtitle="판단→리스크→주문→거래→결과를 추적하고, 가격·수량·거래금액·손익을 서로 다른 값으로 명확히 표시합니다." onBack={onBack}>
      <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">{decisions.map((decision) => <Pill key={`${decision.market}-${decision.timestamp}`} active={selected?.market === decision.market} onClick={() => onSelectDecision(decision)}>{decision.market}</Pill>)}</div>
      {selected && <><button type="button" onClick={onAnalysis} className="w-full rounded-[22px] border border-[#edf0f2] bg-white p-5 text-left shadow-[0_12px_34px_rgba(15,23,42,0.05)]"><div className="flex items-start justify-between"><div><div className="text-[10px] text-[#929aa2]">현재 선택한 판단</div><div className="mt-1 text-[20px] font-semibold">{selected.market} · {actionKo(selected.decision)}</div><div className="mt-1 text-[10px] text-[#9aa2aa]">{dateTime(selected.timestamp)} · {regimeKo(selected.regime)}</div></div><div className="flex gap-2"><ScoreGauge label="Score" value={selected.oracleTradeScore} compact /><ScoreGauge label="Conf." value={selected.confidence} max={1} compact /></div></div><div className="mt-4 text-[11px] leading-5 text-[#727c86]">{reasonKo(selected.primaryReason || selected.reasons?.[0])}</div></button><div className="mt-4"><ProtectionCard tradeMap={selected.tradeMap} /></div></>}

      <section className="mt-7"><SectionTitle title="활동 타임라인" /><div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1"><Pill active={filter === 'ALL'} onClick={() => setFilter('ALL')}>전체</Pill>{types.map((type) => <Pill key={type} active={filter === type} onClick={() => setFilter(type)}>{eventTypeKo(type)}</Pill>)}</div><div className="space-y-3">{timeline.map((event) => <EventCard key={event.id || event.eventKey} event={event} onClick={() => onSelectEvent(event)} />)}{!timeline.length && <EmptyCard title="해당 로그 없음" body="현재 필터에 해당하는 canonical event가 없습니다." />}</div></section>

      <section className="mt-7"><SectionTitle title="완료된 거래" /><div className="space-y-3">{recentTrades.slice(0, 20).map((trade: any) => {
        const quantity = Number.isFinite(Number(trade.quantity)) ? Number(trade.quantity) : null;
        const entryPrice = Number.isFinite(Number(trade.entryPrice)) ? Number(trade.entryPrice) : null;
        const exitPrice = Number.isFinite(Number(trade.exitPrice)) ? Number(trade.exitPrice) : null;
        const entryNotional = quantity != null && entryPrice != null ? quantity * entryPrice : null;
        const exitNotional = quantity != null && exitPrice != null ? quantity * exitPrice : null;
        return <div key={trade.id} className="rounded-[18px] border border-[#edf0f2] bg-white p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-semibold">{trade.market}</div><div className="mt-1 text-[9px] text-[#9ba3aa]">{dateTime(trade.openedAt)} → {dateTime(trade.closedAt)}</div></div><div className="text-right"><div className="text-[9px] text-[#9ba3aa]">순손익</div><div className="mt-0.5 text-[14px] font-semibold" style={{ color: trade.netPnl >= 0 ? '#0aa77d' : '#dc5a66' }}>{formatKrw(trade.netPnl, true)}</div><div className="mt-0.5 text-[10px] font-semibold" style={{ color: trade.returnPct >= 0 ? '#0aa77d' : '#dc5a66' }}>{pct(trade.returnPct, true)}</div></div></div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4"><Metric label="진입가 · 1개당" value={formatKrw(entryPrice)} /><Metric label="청산가 · 1개당" value={formatKrw(exitPrice)} /><Metric label="거래 수량" value={quantity == null ? '—' : `${formatQuantity(quantity)}개`} /><Metric label="진입금액 · 가격×수량" value={formatKrw(entryNotional)} /><Metric label="청산금액 · 가격×수량" value={formatKrw(exitNotional)} /><Metric label="수수료" value={formatKrw(trade.fees)} /></div>
          <div className="mt-4 rounded-xl bg-[#f7f8f9] px-3 py-2.5 text-[10px] leading-5 text-[#7d8791]">청산 사유: {trade.exitReason ?? '—'} · 진입/청산 금액은 가격×수량 기준이며, 순손익은 수수료 등 비용을 반영한 별도 값입니다.</div>
        </div>;
      })}{!recentTrades.length && <EmptyCard title="완료 거래 없음" body="아직 닫힌 Paper 거래가 없습니다." />}</div></section>
    </DetailShell>
  );
};
