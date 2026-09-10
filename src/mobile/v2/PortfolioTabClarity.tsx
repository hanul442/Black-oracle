import React from 'react';
import { Activity, BarChart3, ChevronRight, Target, TrendingUp } from 'lucide-react';
import type { DecisionTapeItem, OpenPosition, OperationsPayload } from './types';
import { pct, scoreText, timeAgo } from './types';
import { EmptyCard, Header, Metric, Screen, SectionTitle } from './ui';
import { formatKrw, formatPercent, formatQuantity, positionFinancials } from './financial';

const StatCard = ({ label, value, Icon }: { label: string; value: string; Icon: React.ComponentType<{ className?: string }> }) => (
  <div className="rounded-[18px] border border-[#edf0f2] bg-white p-4">
    <div className="flex items-center justify-between text-[#89929b]"><span className="text-[10px] font-medium">{label}</span><Icon className="h-4 w-4" /></div>
    <div className="mt-3 text-[21px] font-semibold tracking-[-0.04em]">{value}</div>
  </div>
);

export const PortfolioTabClarity = ({ operations, decisions, onSelectPosition }: { operations: OperationsPayload | null; decisions: DecisionTapeItem[]; onSelectPosition: (position: OpenPosition) => void }) => {
  const portfolio = operations?.portfolio;
  const performance = operations?.performance;
  const positions = portfolio?.openPositions ?? [];
  const totalReturn = portfolio && portfolio.initialEquity ? portfolio.equity / portfolio.initialEquity - 1 : performance?.totalReturnPct ?? null;
  const openCost = positions.reduce((sum, position) => sum + (positionFinancials(position).costBasis ?? 0), 0);
  const openMarketValue = positions.reduce((sum, position) => sum + (positionFinancials(position).marketValue ?? 0), 0);
  const openUnrealized = positions.reduce((sum, position) => sum + (positionFinancials(position).unrealizedPnl ?? 0), 0);

  return (
    <Screen>
      <Header title="포트폴리오" subtitle="가격·수량·투입금액·평가금액을 구분해서 표시합니다. 모든 값은 persisted Paper checkpoint 기준입니다." />

      <div className="rounded-[24px] border border-[#edf0f2] bg-white p-5">
        <div className="text-[11px] text-[#8b949d]">총 자산 · Paper</div>
        <div className="mt-2 text-[30px] font-semibold tracking-[-0.05em]">{formatKrw(portfolio?.equity)}</div>
        <div className="mt-1 text-[14px] font-semibold" style={{ color: (totalReturn ?? 0) >= 0 ? '#0aa77d' : '#dc5a66' }}>{formatPercent(totalReturn, true)}</div>
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
          <Metric label="현금" value={formatKrw(portfolio?.cash)} />
          <Metric label="실현손익" value={formatKrw(portfolio?.realizedPnl, true)} />
          <Metric label="열린 포지션 원가" value={positions.length ? formatKrw(openCost) : '—'} />
          <Metric label="열린 포지션 평가금액" value={positions.length ? formatKrw(openMarketValue) : '—'} />
          <Metric label="미실현손익" value={positions.length ? formatKrw(openUnrealized, true) : '—'} accent={openUnrealized >= 0 ? '#0aa77d' : '#dc5a66'} />
          <Metric label="최대 낙폭 MDD" value={pct(performance?.maxDrawdownPct)} />
        </div>
      </div>

      <div className="mt-7"><SectionTitle title="진행 중 포지션" /></div>
      <div className="space-y-3">
        {positions.map((position) => {
          const finance = positionFinancials(position);
          const decision = decisions.find((item) => item.market === position.market);
          const tp1 = position.takeProfit1Price ?? decision?.tradeMap?.takeProfit1Price ?? null;
          const tp2 = position.takeProfit2Price ?? position.takeProfitPrice ?? decision?.tradeMap?.takeProfit2Price ?? null;
          return (
            <button type="button" key={`${position.market}-${position.openedAt}`} onClick={() => onSelectPosition(position)} className="w-full rounded-[18px] border border-[#edf0f2] bg-white p-4 text-left shadow-[0_7px_22px_rgba(15,23,42,0.035)]">
              <div className="flex items-start justify-between gap-3">
                <div><div className="text-[15px] font-semibold">{position.market}</div><div className="mt-1 text-[10px] text-[#969fa7]">{timeAgo(position.openedAt)} 진입 · {position.takeProfit1Taken ? '1차 익절 완료' : '1차 익절 대기'}</div></div>
                <div className="flex items-center gap-2"><div className="text-right"><div className="text-[9px] text-[#9ba3aa]">평가손익</div><div className="mt-0.5 text-[12px] font-semibold" style={{ color: (finance.unrealizedPnl ?? 0) >= 0 ? '#0aa77d' : '#dc5a66' }}>{formatKrw(finance.unrealizedPnl, true)}</div></div><ChevronRight className="h-4 w-4 text-[#b0b7be]" /></div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
                <Metric label="평균 진입가 · 1개당" value={formatKrw(finance.fillPrice)} />
                <Metric label="현재가 · 1개당" value={formatKrw(finance.markPrice)} />
                <Metric label="보유 수량" value={`${formatQuantity(finance.quantity)}개`} />
                <Metric label="투입금액 · 원가" value={formatKrw(finance.costBasis)} />
                <Metric label="현재 평가금액" value={formatKrw(finance.marketValue)} />
                <Metric label="수익률" value={formatPercent(finance.unrealizedReturn, true)} accent={(finance.unrealizedReturn ?? 0) >= 0 ? '#0aa77d' : '#dc5a66'} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#f0f2f4] pt-3">
                <Metric label="손절가 · 1개당" value={formatKrw(position.stopLossPrice)} accent="#dc5a66" />
                <Metric label="1차 익절가 · 1개당" value={formatKrw(tp1)} accent="#0aa77d" />
                <Metric label="2차 익절가 · 1개당" value={formatKrw(tp2)} accent="#1687c7" />
              </div>
            </button>
          );
        })}
        {!positions.length && <EmptyCard title="열린 포지션 없음" body="현재 Paper Engine은 신규 포지션을 보유하고 있지 않습니다. NO_TRADE도 정상적인 결정입니다." />}
      </div>

      <div className="mt-7"><SectionTitle title="성과" /></div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="승률" value={pct(performance?.winRate)} Icon={Target} />
        <StatCard label="거래 수" value={String(performance?.trades ?? 0)} Icon={Activity} />
        <StatCard label="Profit Factor" value={scoreText(performance?.profitFactor)} Icon={TrendingUp} />
        <StatCard label="거래당 기대손익" value={formatKrw(performance?.expectancy)} Icon={BarChart3} />
      </div>
    </Screen>
  );
};
