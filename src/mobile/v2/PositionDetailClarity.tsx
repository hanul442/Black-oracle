import React from 'react';
import { Brain, ShieldCheck } from 'lucide-react';
import type { DecisionTapeItem, OpenPosition } from './types';
import { actionKo, dateTime, reasonKo, regimeKo } from './types';
import { DetailShell, EmptyCard, Metric, ReasonCard, SectionTitle, StatusChip } from './ui';
import { formatKrw, formatPercent, formatQuantity, positionFinancials } from './financial';

export const PositionDetailClarity = ({ position, decision, onBack }: { position: OpenPosition | null; decision: DecisionTapeItem | null; onBack: () => void }) => {
  if (!position) return <DetailShell title="포지션" onBack={onBack}><EmptyCard title="선택된 포지션 없음" body="포트폴리오에서 포지션을 선택해 주세요." /></DetailShell>;

  const finance = positionFinancials(position);
  const tp1 = position.takeProfit1Price ?? decision?.tradeMap?.takeProfit1Price ?? null;
  const tp2 = position.takeProfit2Price ?? position.takeProfitPrice ?? decision?.tradeMap?.takeProfit2Price ?? null;
  const sl = position.stopLossPrice ?? decision?.tradeMap?.stopLossPrice ?? null;
  const pnlPositive = (finance.unrealizedPnl ?? 0) >= 0;

  return (
    <DetailShell title={position.market} subtitle={`Paper 포지션 · ${dateTime(position.openedAt)} 진입`} onBack={onBack}>
      <div className="rounded-[22px] border border-[#edf0f2] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-medium text-[#8b949d]">현재 평가금액</div>
            <div className="mt-1 text-[28px] font-semibold tracking-[-0.05em]">{formatKrw(finance.marketValue)}</div>
            <div className="mt-1 text-[12px] font-semibold" style={{ color: pnlPositive ? '#0aa77d' : '#dc5a66' }}>
              평가손익 {formatKrw(finance.unrealizedPnl, true)} · {formatPercent(finance.unrealizedReturn, true)}
            </div>
          </div>
          <StatusChip value={position.takeProfit1Taken ? 'TP1 완료' : '보유 중'} />
        </div>

        <div className="mt-5 rounded-[16px] bg-[#f6f8f9] p-4">
          <div className="text-[10px] font-semibold text-[#5f6973]">가격과 금액은 다릅니다</div>
          <div className="mt-1 text-[10px] leading-5 text-[#8a949e]">평균 진입가는 1개당 매수가격이고, 투입금액은 실제로 이 포지션에 들어간 총 원가입니다.</div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
          <Metric label="평균 진입가 · 1개당" value={formatKrw(finance.fillPrice)} />
          <Metric label="수수료 포함 평균원가 · 1개당" value={formatKrw(finance.averageCostPerUnit)} />
          <Metric label="보유 수량" value={`${formatQuantity(finance.quantity)}개`} />
          <Metric label="투입금액 · 원가 기준" value={formatKrw(finance.costBasis)} />
          <Metric label="현재가 · 1개당" value={formatKrw(finance.markPrice)} />
          <Metric label="현재 평가금액" value={formatKrw(finance.marketValue)} />
        </div>
      </div>

      <section className="mt-6">
        <SectionTitle title="손절·익절 계획" />
        <div className="rounded-[20px] border border-[#edf0f2] bg-white p-4">
          <div className="flex items-center justify-between"><div className="text-[12px] font-semibold">Dynamic Protection</div><ShieldCheck className="h-4 w-4 text-[#5d6973]" /></div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
            <Metric label="손절가 · 1개당" value={formatKrw(sl)} accent="#d95360" />
            <Metric label="1차 익절가 · 1개당" value={formatKrw(tp1)} accent="#0a9f79" />
            <Metric label="2차 익절가 · 1개당" value={formatKrw(tp2)} accent="#087fbf" />
            <Metric label="1차 익절 상태" value={position.takeProfit1Taken ? '체결 완료' : '대기 중'} />
          </div>
          <div className="mt-4 border-t border-[#f0f2f4] pt-3 text-[10px] leading-5 text-[#87919a]">SL·TP1·TP2는 ‘거래금액’이 아니라 해당 자산 1개당 목표 가격입니다. 실제 청산 금액은 당시 보유 수량과 체결가에 따라 결정됩니다.</div>
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle title="최근 판단" />
        {decision ? <ReasonCard title={`${actionKo(decision.decision)} · ${regimeKo(decision.regime)}`} body={reasonKo(decision.primaryReason || decision.reasons?.[0])} icon={<Brain className="h-4 w-4" />} /> : <EmptyCard title="최근 판단 없음" body="이 포지션과 연결된 최신 decision trace가 없습니다." />}
      </section>
    </DetailShell>
  );
};
