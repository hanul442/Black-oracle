import React from 'react';
import type { OpenPosition } from '../v2/types';
import { dateTime, timeAgo } from '../v2/types';
import { formatKrw, formatPercent, formatQuantity, positionFinancials } from '../v2/financial';

const green = '#16845b';
const red = '#d14b55';
const blue = '#3767d6';
const card = 'rounded-[24px] border border-[#e7e9ed] bg-white';
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const Metric = ({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) => <div className="min-w-0"><div className="text-[9px] font-medium text-[#969ca4]">{label}</div><div className="mt-1 truncate text-[14px] font-semibold tabular-nums tracking-[-0.02em]" style={{ color: accent ?? '#111318' }}>{value}</div></div>;

export const PositionSummary = ({
  position,
  portfolioEquity,
  compact = false,
  marketLabel,
  marketMeta,
}: {
  position: OpenPosition;
  portfolioEquity?: number | null;
  compact?: boolean;
  marketLabel?: string | null;
  marketMeta?: string | null;
}) => {
  const finance = positionFinancials(position);
  const weight = finite(portfolioEquity) && portfolioEquity > 0 && finance.marketValue != null ? finance.marketValue / portfolioEquity : null;
  const pnlColor = (finance.unrealizedPnl ?? 0) >= 0 ? green : red;
  const tp1 = position.takeProfit1Price ?? position.takeProfitPrice;
  const tp2 = position.takeProfit2Price;
  const label = marketLabel || position.market;
  const meta = marketMeta || (marketLabel && marketLabel !== position.market ? position.market : null);

  return <div className={`${card} ${compact ? 'p-4' : 'p-5'}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold text-[#17191e]">{label}</span><span className="rounded-full border border-[#3767d62a] bg-[#3767d60b] px-2 py-0.5 text-[9px] font-semibold" style={{ color: blue }}>OPEN · PAPER</span></div>
        {meta && <div className="mt-1 text-[9px] font-medium text-[#737c86]">{meta}</div>}
        <div className="mt-1 text-[9px] text-[#9299a2]">진입 {dateTime(position.openedAt)} · {timeAgo(position.openedAt)}</div>
      </div>
      <div className="text-right"><div className="text-[8px] text-[#999fa7]">평가손익</div><div className="mt-1 text-[13px] font-semibold tabular-nums" style={{ color: pnlColor }}>{formatKrw(finance.unrealizedPnl, true)}</div><div className="mt-0.5 text-[9px] font-semibold" style={{ color: pnlColor }}>{formatPercent(finance.unrealizedReturn, true)}</div></div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-[#eef0f2] pt-4">
      <Metric label="현재가 · Paper mark" value={formatKrw(finance.markPrice)} />
      <Metric label="포트폴리오 비중" value={formatPercent(weight)} />
      <Metric label="투입원금" value={formatKrw(finance.costBasis)} />
      <Metric label="현재 평가액" value={formatKrw(finance.marketValue)} />
      <Metric label="진입가" value={formatKrw(position.entryPrice)} />
      <Metric label="평균단가" value={formatKrw(position.averageCost)} />
      <Metric label="보유수량" value={formatQuantity(finance.quantity)} />
      <Metric label="손절가" value={formatKrw(position.stopLossPrice)} accent={red} />
      <Metric label="TP1" value={formatKrw(tp1)} accent={green} />
      <Metric label="TP2" value={formatKrw(tp2)} accent={green} />
    </div>
  </div>;
};
