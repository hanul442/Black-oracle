import React from 'react';
import { Activity, BarChart3, ChevronRight, Target, TrendingUp, WalletCards } from 'lucide-react';
import type { DecisionTapeItem, OpenPosition, OperationsPayload } from '../v2/types';
import { pct, scoreText, timeAgo } from '../v2/types';
import { EmptyCard, Header, Metric, Screen, SectionTitle } from '../v2/ui';
import { formatKrw, formatPercent, formatQuantity, positionFinancials } from '../v2/financial';
import { PortfolioPerformanceChart } from './PortfolioPerformanceChart';

const StatCard = ({ label, value, Icon }: { label: string; value: string; Icon: React.ComponentType<{ className?: string }> }) => (
  <div className="rounded-[20px] border border-[#edf0f2] bg-white p-4">
    <div className="flex items-center justify-between text-[#7f8992]"><span className="text-[12px] font-medium">{label}</span><Icon className="h-4 w-4" /></div>
    <div className="mt-3 text-[22px] font-semibold tracking-[-0.04em]">{value}</div>
  </div>
);

export const PortfolioTabV4 = ({ operations, decisions, onSelectPosition }: { operations: OperationsPayload | null; decisions: DecisionTapeItem[]; onSelectPosition: (position: OpenPosition) => void }) => {
  const portfolio = operations?.portfolio;
  const performance = operations?.performance;
  const positions = portfolio?.openPositions ?? [];
  const totalReturn = portfolio && portfolio.initialEquity ? portfolio.equity / portfolio.initialEquity - 1 : performance?.totalReturnPct ?? null;
  const openCost = positions.reduce((sum, position) => sum + (positionFinancials(position).costBasis ?? 0), 0);
  const openMarketValue = positions.reduce((sum, position) => sum + (positionFinancials(position).marketValue ?? 0), 0);
  const openUnrealized = positions.reduce((sum, position) => sum + (positionFinancials(position).unrealizedPnl ?? 0), 0);
  const exposure = portfolio?.equity && portfolio.equity > 0 ? openMarketValue / portfolio.equity : null;

  return (
    <Screen>
      <Header title="포트폴리오" subtitle="총자산 → 운용성과 → 노출 → 포지션 → 성과 순으로 봅니다. 가격과 금액은 구분해서 표시합니다." />

      <div className="rounded-[24px] border border-[#edf0f2] bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-medium text-[#7f8992]">총 자산 · Paper</div>
          <WalletCards className="h-5 w-5 text-[#8f98a1]" />
        </div>
        <div className="mt-2 text-[32px] font-semibold tracking-[-0.05em]">{formatKrw(portfolio?.equity)}</div>
        <div className="mt-1 text-[16px] font-semibold" style={{ color: (totalReturn ?? 0) >= 0 ? '#0aa77d' : '#dc5a66' }}>{formatPercent(totalReturn, true)}</div>
        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-[#f0f2f4] pt-5">
          <Metric label="현금" value={formatKrw(portfolio?.cash)} />
          <Metric label="현재 노출" value={pct(exposure)} />
          <Metric label="실현손익" value={formatKrw(portfolio?.realizedPnl, true)} />
          <Metric label="미실현손익" value={positions.length ? formatKrw(openUnrealized, true) : '—'} accent={openUnrealized >= 0 ? '#0aa77d' : '#dc5a66'} />
        </div>
      </div>

      <div className="mt-4">
        <PortfolioPerformanceChart points={operations?.equityCurve ?? []} />
      </div>

      <div className="mt-6"><SectionTitle title="포지션 노출" /></div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="열린 포지션 원가" value={positions.length ? formatKrw(openCost) : '—'} Icon={WalletCards} />
        <StatCard label="현재 평가금액" value={positions.length ? formatKrw(openMarketValue) : '—'} Icon={TrendingUp} />
      </div>

      <div className="mt-7"><SectionTitle title="진행 중 포지션" /></div>
      <div className="space-y-3">
        {positions.map((position) => {
          const finance = positionFinancials(position);
          const decision = decisions.find((item) => item.market === position.market);
          const tp1 = position.takeProfit1Price ?? decision?.tradeMap?.takeProfit1Price ?? null;
          const tp2 = position.takeProfit2Price ?? position.takeProfitPrice ?? decision?.tradeMap?.takeProfit2Price ?? null;
          return (
            <button type="button" key={`${position.market}-${position.openedAt}`} onClick={() => onSelectPosition(position)} className="w-full rounded-[20px] border border-[#edf0f2] bg-white p-4 text-left shadow-[0_8px_26px_rgba(15,23,42,0.035)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[17px] font-semibold">{position.market}</div>
                  <div className="mt-1 text-[12px] text-[#8f98a1]">{timeAgo(position.openedAt)} 진입 · {position.takeProfit1Taken ? '1차 익절 완료' : '1차 익절 대기'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-[11px] text-[#8f98a1]">평가손익</div>
                    <div className="mt-0.5 text-[14px] font-semibold" style={{ color: (finance.unrealizedPnl ?? 0) >= 0 ? '#0aa77d' : '#dc5a66' }}>{formatKrw(finance.unrealizedPnl, true)}</div>
                    <div className="mt-0.5 text-[12px] font-semibold" style={{ color: (finance.unrealizedReturn ?? 0) >= 0 ? '#0aa77d' : '#dc5a66' }}>{formatPercent(finance.unrealizedReturn, true)}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#aab2b9]" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-[#f0f2f4] pt-4">
                <Metric label="평균 진입가 · 1개당" value={formatKrw(finance.fillPrice)} />
                <Metric label="현재가 · 1개당" value={formatKrw(finance.markPrice)} />
                <Metric label="보유 수량" value={`${formatQuantity(finance.quantity)}개`} />
                <Metric label="투입금액 · 원가" value={formatKrw(finance.costBasis)} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-[#f7f8f9] px-3 py-3">
                <Metric label="손절가 · 1개당" value={formatKrw(position.stopLossPrice)} accent="#dc5a66" />
                <Metric label="1차 익절가 · 1개당" value={formatKrw(tp1)} accent="#0aa77d" />
                <Metric label="2차 익절가 · 1개당" value={formatKrw(tp2)} accent="#1687c7" />
              </div>
            </button>
          );
        })}
        {!positions.length && <EmptyCard title="열린 포지션 없음" body="현재 Paper Engine은 신규 포지션을 보유하고 있지 않습니다. NO_TRADE도 정상적인 결정입니다." />}
      </div>

      <div className="mt-7"><SectionTitle title="성과 지표" /></div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="승률" value={pct(performance?.winRate)} Icon={Target} />
        <StatCard label="거래 수" value={String(performance?.trades ?? 0)} Icon={Activity} />
        <StatCard label="Profit Factor" value={scoreText(performance?.profitFactor)} Icon={TrendingUp} />
        <StatCard label="거래당 기대손익" value={formatKrw(performance?.expectancy)} Icon={BarChart3} />
      </div>
    </Screen>
  );
};