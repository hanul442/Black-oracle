import React from 'react';
import { ArrowDown, Brain, CheckCircle2, FileSearch, Filter, Gauge, Layers3, Repeat2, ShieldAlert, Target, UsersRound, Waves } from 'lucide-react';
import { HORIZON_ORDER, HORIZON_STRATEGY_POLICIES, type CanonicalTimeframe } from '../../trading/horizonPolicy';
import { INVESTMENT_COMMITTEE_PERSONAS } from '../../trading/investmentCommittee';
import { EQUITY_MIN_DAILY_VOLUME, EQUITY_MIN_MARKET_CAP_KRW } from '../../trading/equityUniversePolicy';

const card = 'rounded-[24px] border border-[#e6e9ed] bg-white';
const soft = 'rounded-[17px] border border-[#eceef1] bg-[#fafbfc]';

const timeframes: CanonicalTimeframe[] = ['1M', '5M', '15M', '1H', '4H', '1D', '1W', '1MO'];
const timeframeLabel: Record<CanonicalTimeframe, string> = {
  '1M': '1분', '5M': '5분', '15M': '15분', '1H': '1시간', '4H': '4시간', '1D': '일봉', '1W': '주봉', '1MO': '월봉',
};

const steps = [
  { icon: FileSearch, title: 'News & Evidence', text: 'NARS·공시·공식자료·시장 데이터에서 최신 근거를 수집하고 출처·신선도·독립성을 기록합니다.' },
  { icon: Gauge, title: 'Market State', text: '시장 레짐·변동성·breadth·금리·FX·유동성을 분석하고 초단기~장기 상태를 따로 분류합니다.' },
  { icon: Layers3, title: 'Sector Strength', text: '단기·중기·장기별 상대강도, breadth, 거래량 참여, Evidence를 합쳐 강세 섹터를 선정합니다.' },
  { icon: Filter, title: 'Equity Hard Gate', text: '거래량 50만주 이상, 시총 1,000억원 이상, 코인 연계주 제외. 누락 데이터는 자동 통과시키지 않습니다.' },
  { icon: UsersRound, title: '24-member Committee', text: '각 위원이 자신의 전략·시그널·호라이즌에 따라 20~100개 종목을 독립적으로 추천하고 근거를 붙입니다.' },
  { icon: Brain, title: 'Cross Review & Debate', text: '종목별 교차채점 → 이견 분리 → 토론 → Red Team 반박. 다른 위원의 의견 자체는 Evidence로 취급하지 않습니다.' },
  { icon: ShieldAlert, title: 'Head Council Cut', text: '하드 거부권을 먼저 적용하고, 교차검증 점수·dissent·data gap을 반영해 하위 70%를 컷합니다.' },
  { icon: Target, title: 'Trade Map', text: '생존 후보마다 호라이즌별 예상 시나리오, 진입가, 무효화·손절, TP1·TP2, R:R을 따로 설계합니다.' },
  { icon: Waves, title: 'Paper Execution', text: '기존 S1R2 Paper runtime을 보존한 채 shadow 결과를 먼저 축적하고 승인된 경로만 실행 계층으로 전달합니다.' },
  { icon: Repeat2, title: 'Outcome Learning', text: '성공·실패·NO_TRADE를 모두 복기하고 전략·위원·시그널의 성과를 재평가한 뒤 다음 사이클로 피드백합니다.' },
];

const formatKrwCompact = (value: number) => value >= 1_000_000_000_000
  ? `₩${(value / 1_000_000_000_000).toFixed(1)}T`
  : value >= 100_000_000
    ? `₩${(value / 100_000_000).toFixed(0)}억`
    : `₩${value.toLocaleString()}`;

export const InvestmentCyclePanel = () => (
  <div className="px-4 pb-16 pt-4 text-[#111318]">
    <section className={card + ' p-5'}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[9px] font-semibold tracking-[0.18em] text-[#9aa0a8]">BLACK ORACLE · V10</div>
          <div className="mt-2 text-[27px] font-semibold tracking-[-0.05em]">Investment Cycle</div>
          <div className="mt-2 max-w-[520px] text-[11px] leading-5 text-[#7e858e]">시장 전체에서 시작해 섹터·종목·Council·거래·복기까지 한 Trace로 연결하는 상위 의사결정 레이어입니다.</div>
        </div>
        <div className="rounded-full border border-[#dfe3e7] bg-[#f8f9fa] px-3 py-1.5 text-[9px] font-semibold text-[#58616b]">SHADOW FIRST</div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#eef0f2] pt-4">
        <div><div className="text-[8px] text-[#9aa0a8]">Council</div><div className="mt-1 text-[15px] font-semibold">{INVESTMENT_COMMITTEE_PERSONAS.length}</div></div>
        <div><div className="text-[8px] text-[#9aa0a8]">Horizons</div><div className="mt-1 text-[15px] font-semibold">5</div></div>
        <div><div className="text-[8px] text-[#9aa0a8]">Timeframes</div><div className="mt-1 text-[15px] font-semibold">8</div></div>
      </div>
    </section>

    <section className="mt-7">
      <div className="mb-3"><div className="text-[17px] font-semibold tracking-[-0.025em]">Decision flow</div><div className="mt-1 text-[10px] leading-4 text-[#9298a0]">사용자가 앱에서 그대로 추적해야 할 실제 사이클.</div></div>
      <div className="space-y-2">{steps.map((step, index) => {
        const Icon = step.icon;
        return <React.Fragment key={step.title}>
          <div className={card + ' p-4'}>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[#f4f6f8]"><Icon className="h-4 w-4 text-[#59626c]" /></div>
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[9px] font-semibold text-[#a0a6ae]">{String(index + 1).padStart(2, '0')}</span><span className="text-[13px] font-semibold text-[#25282e]">{step.title}</span></div><div className="mt-1.5 text-[10px] leading-5 text-[#7d858e]">{step.text}</div></div>
            </div>
          </div>
          {index < steps.length - 1 && <div className="flex justify-center"><ArrowDown className="h-3.5 w-3.5 text-[#bcc1c7]" /></div>}
        </React.Fragment>;
      })}</div>
    </section>

    <section className="mt-7">
      <div className="mb-3"><div className="text-[17px] font-semibold tracking-[-0.025em]">KRX universe gate</div><div className="mt-1 text-[10px] leading-4 text-[#9298a0]">Council 전에 통과해야 하는 정량·분류 필터입니다.</div></div>
      <div className={card + ' divide-y divide-[#eef0f2]'}>
        {[
          ['Daily volume', `${EQUITY_MIN_DAILY_VOLUME.toLocaleString()}주 이상`],
          ['Market cap', `${formatKrwCompact(EQUITY_MIN_MARKET_CAP_KRW)} 이상`],
          ['Crypto-linked equity', '제외'],
          ['Missing cap / classification', 'DATA_GAP · 자동 탈락'],
        ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 px-4 py-3"><span className="text-[10px] text-[#7b838c]">{label}</span><span className="text-[10px] font-semibold text-[#343941]">{value}</span></div>)}
      </div>
    </section>

    <section className="mt-7">
      <div className="mb-3"><div className="text-[17px] font-semibold tracking-[-0.025em]">Multi-horizon strategy map</div><div className="mt-1 text-[10px] leading-4 text-[#9298a0]">같은 종목도 기간별로 독립 Thesis·전략·손절·성과를 가집니다.</div></div>
      <div className="space-y-2">{HORIZON_ORDER.map((horizon) => {
        const policy = HORIZON_STRATEGY_POLICIES[horizon];
        return <div key={horizon} className={card + ' p-4'}>
          <div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-semibold">{policy.label}</div><div className="mt-1 text-[9px] text-[#9aa0a8]">{policy.intendedHoldingPeriod} · {policy.rebalanceCadence}</div></div><div className="rounded-full bg-[#f5f6f8] px-2.5 py-1 text-[9px] font-semibold text-[#5f6872]">{policy.minimumIndependentConfirmations}+ confirmations</div></div>
          <div className="mt-3 flex flex-wrap gap-1.5">{policy.primaryStrategyFamilies.map((family) => <span key={family} className="rounded-full border border-[#e4e7ea] px-2 py-1 text-[8px] font-medium text-[#737b84]">{family}</span>)}</div>
        </div>;
      })}</div>
    </section>

    <section className="mt-7">
      <div className="mb-3"><div className="text-[17px] font-semibold tracking-[-0.025em]">Timeframe authority matrix</div><div className="mt-1 text-[10px] leading-4 text-[#9298a0]">분봉·1H·4H·일봉·주봉·월봉을 모두 보되, 호라이즌마다 권한이 다릅니다.</div></div>
      <div className={card + ' overflow-hidden'}>
        <div className="overflow-x-auto">
          <div className="min-w-[650px] p-3">
            <div className="grid grid-cols-[90px_repeat(8,minmax(54px,1fr))] gap-1 text-center text-[8px] font-semibold text-[#989ea6]"><div className="text-left">Horizon</div>{timeframes.map((frame) => <div key={frame}>{timeframeLabel[frame]}</div>)}</div>
            <div className="mt-2 space-y-1.5">{HORIZON_ORDER.map((horizon) => {
              const policy = HORIZON_STRATEGY_POLICIES[horizon];
              const rules = new Map(policy.timeframeRules.map((rule) => [rule.timeframe, rule]));
              return <div key={horizon} className="grid grid-cols-[90px_repeat(8,minmax(54px,1fr))] gap-1"><div className="flex items-center text-[9px] font-semibold text-[#4d545d]">{policy.label}</div>{timeframes.map((frame) => { const rule = rules.get(frame); return <div key={frame} className={'flex h-9 items-center justify-center rounded-[10px] text-[8px] font-semibold ' + (rule ? rule.required ? 'bg-[#22262c] text-white' : 'bg-[#eef1f4] text-[#626b75]' : 'bg-[#fafbfc] text-[#c3c7cc]')}>{rule ? `${Math.round(rule.weight * 100)}%` : '—'}</div>; })}</div>;
            })}</div>
          </div>
        </div>
      </div>
    </section>

    <section className="mt-7">
      <div className="mb-3"><div className="text-[17px] font-semibold tracking-[-0.025em]">Large participant footprint</div><div className="mt-1 text-[10px] leading-4 text-[#9298a0]">“세력”을 이름 붙이지 않고 관측 가능한 흔적만 평가합니다.</div></div>
      <div className={card + ' p-4'}>
        <div className="grid grid-cols-2 gap-2">{['Relative volume', 'Absorption-like candle', 'VWAP / close location', 'Breakout participation', 'Volume persistence', 'Price-volume divergence'].map((item) => <div key={item} className={soft + ' px-3 py-3 text-[9px] font-medium text-[#606873]'}>{item}</div>)}</div>
        <div className="mt-3 flex items-start gap-2 rounded-[15px] border border-[#eee4d5] bg-[#fffaf2] px-3 py-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#a17635]" /><div className="text-[9px] leading-4 text-[#806a49]">기관·외국인·특정 주체는 실제 수급·소유·브로커 데이터가 있을 때만 명시합니다. 거래량만으로 조작 또는 특정 주체 개입을 확정하지 않습니다.</div></div>
      </div>
    </section>

    <section className="mt-7">
      <div className="mb-3"><div className="text-[17px] font-semibold tracking-[-0.025em]">Committee roster</div><div className="mt-1 text-[10px] leading-4 text-[#9298a0]">후보 발굴과 교차검증을 위한 24개 전문 좌석.</div></div>
      <div className="grid grid-cols-2 gap-2">{INVESTMENT_COMMITTEE_PERSONAS.map((persona) => <div key={persona.id} className={card + ' p-3'}><div className="text-[9px] font-semibold text-[#9aa0a8]">{persona.desk}</div><div className="mt-1 text-[10px] font-semibold leading-4 text-[#2e333a]">{persona.title}</div><div className="mt-2 text-[8px] leading-4 text-[#858c95]">Top {persona.nominationTarget} · {persona.focusSignals.slice(0, 2).join(' / ')}</div></div>)}</div>
    </section>
  </div>
);
