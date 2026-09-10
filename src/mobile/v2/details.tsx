import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  Database,
  Lock,
  Network,
  Search,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  actionKo,
  AiCouncilReview,
  cn,
  dateTime,
  DecisionTapeItem,
  decimal,
  eventTags,
  eventTypeKo,
  LedgerEvent,
  money,
  number,
  OpenPosition,
  OperationalEvidence,
  pct,
  PriceCandle,
  PriceChartPayload,
  reasonKo,
  regimeKo,
  roleKo,
  scoreHex,
  scoreText,
  StrategyCard,
} from './types';
import {
  CheckRow,
  DetailShell,
  EmptyCard,
  EventCard,
  EventTrace,
  Metric,
  Pill,
  ProtectionCard,
  ReasonCard,
  ScoreBar,
  ScoreGauge,
  SectionTitle,
  StatusChip,
  TagRow,
  WarningCard,
} from './ui';

const DecisionPicker = ({ decisions, selected, onSelect }: { decisions: DecisionTapeItem[]; selected: DecisionTapeItem | null; onSelect: (decision: DecisionTapeItem) => void }) => (
  <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
    {decisions.map((decision) => <Pill key={`${decision.market}-${decision.timestamp}`} active={selected?.market === decision.market} onClick={() => onSelect(decision)}>{decision.market}</Pill>)}
  </div>
);

const chartY = (value: number, min: number, span: number) => 122 - ((value - min) / span) * 100;

const PriceChart = ({ candles, tradeMap }: { candles: PriceCandle[]; tradeMap: DecisionTapeItem['tradeMap'] }) => {
  if (candles.length < 2) return <EmptyCard title="가격 차트 대기 중" body="이 종목의 공개 시장 가격 데이터를 불러오지 못했습니다. 판단 근거와 Trade Map은 계속 확인할 수 있습니다." />;
  const closes = candles.map((c) => c.close);
  const levels = [tradeMap?.entryPrice, tradeMap?.stopLossPrice, tradeMap?.takeProfit1Price, tradeMap?.takeProfit2Price].filter((v): v is number => Number.isFinite(v));
  const min = Math.min(...closes, ...levels);
  const max = Math.max(...closes, ...levels);
  const span = Math.max(max - min, 1);
  const points = closes.map((value, index) => `${12 + (index / (closes.length - 1)) * 276},${chartY(value, min, span)}`).join(' ');
  const overlays: Array<[string, number | null | undefined, string]> = [
    ['ENTRY', tradeMap?.entryPrice, '#2d343b'],
    ['SL', tradeMap?.stopLossPrice, '#dc5a66'],
    ['TP1', tradeMap?.takeProfit1Price, '#0aa77d'],
    ['TP2', tradeMap?.takeProfit2Price, '#1687c7'],
  ];
  return (
    <div className="rounded-[20px] border border-[#edf0f2] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center justify-between"><div className="text-[11px] font-semibold">1시간 실제 가격 흐름</div><div className="text-[9px] text-[#9aa2aa]">최근 {candles.length}개 봉</div></div>
      <svg viewBox="0 0 300 140" className="h-44 w-full overflow-visible" aria-label="실제 시장 가격과 보호 수준 차트">
        {[0, 1, 2, 3].map((row) => <line key={row} x1="12" x2="288" y1={22 + row * 32} y2={22 + row * 32} stroke="#eef1f3" strokeWidth="1" />)}
        <polyline points={points} fill="none" stroke="#1a2026" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {overlays.map(([label, value, color]) => value != null && Number.isFinite(value) ? (
          <g key={label}>
            <line x1="12" x2="288" y1={chartY(value, min, span)} y2={chartY(value, min, span)} stroke={color} strokeWidth="1" strokeDasharray="4 4" opacity="0.8" />
            <text x="286" y={chartY(value, min, span) - 3} textAnchor="end" fontSize="8" fill={color}>{label}</text>
          </g>
        ) : null)}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[9px] text-[#9aa2aa]"><span>{dateTime(candles[0]?.timestamp)}</span><span>{number.format(candles[candles.length - 1]?.close ?? 0)}</span><span>{dateTime(candles[candles.length - 1]?.timestamp)}</span></div>
    </div>
  );
};

const councilMessage = (decision: DecisionTapeItem, role: string, vote: string, confidence: number, reasons: string[]) => {
  const voteText = actionKo(vote);
  if (role === 'TECHNICAL') return `다중 시간대 신호와 Oracle Trade Score ${scoreText(decision.oracleTradeScore)}를 검토했습니다. 제 의견은 ‘${voteText}’입니다.`;
  if (role === 'REGIME') return `현재 1시간 시장 국면은 ${regimeKo(decision.regime)}입니다. 국면 적합성을 기준으로 ‘${voteText}’ 의견을 냈습니다.`;
  if (role === 'EVIDENCE') return `활성 근거 ${decision.evidenceActiveCount ?? 0}건과 상충 근거 ${decision.evidenceContradictionCount ?? 0}건을 검토했습니다. 근거 관점의 결론은 ‘${voteText}’입니다.`;
  if (role === 'RISK') return `손절·포지션 크기·손실 한도와 실행 리스크를 확인했습니다. Risk Gate 상태는 ${decision.riskDisposition ?? '미평가'}, 표결은 ‘${voteText}’입니다.`;
  if (role === 'SKEPTIC') return `놓친 반대 근거와 타이밍 오류가 없는지 반대편에서 검토했습니다. 현재는 ‘${voteText}’ 의견입니다.`;
  return `${reasons.map(reasonKo).join(' ')} 신뢰도는 ${Math.round((confidence ?? 0) * 100)}%입니다.`;
};

const aiReviewMessage = (review: AiCouncilReview) => {
  const stance = String(review.stance ?? '').toUpperCase();
  const lead = stance === 'AGREE' ? '결정에 대체로 동의합니다.' : stance === 'DISSENT' ? '현재 결정에 반대 의견이 있습니다.' : '결정에는 동의 가능하지만 주의가 필요합니다.';
  const concern = review.concerns?.length ? ` 주요 우려는 ${review.concerns.slice(0, 2).join(' / ')}입니다.` : '';
  return `${lead}${concern}`;
};

export const StrategyDetail = ({ strategy, onBack }: { strategy: StrategyCard | null; onBack: () => void }) => {
  if (!strategy) return <DetailShell title="전략" onBack={onBack}><EmptyCard title="선택된 전략 없음" body="전략 허브에서 전략을 선택해 주세요." /></DetailShell>;
  return (
    <DetailShell title={strategy.name} subtitle={`${strategy.lifecycle} · Strategy Factory 검증 결과`} onBack={onBack}>
      <div className="rounded-[22px] border border-[#edf0f2] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between"><div><div className="text-[10px] text-[#929aa2]">Factory Score</div><div className="mt-1 text-[30px] font-semibold tracking-[-0.05em]" style={{ color: scoreHex(strategy.score) }}>{scoreText(strategy.score)}</div></div><ScoreGauge label="검증점수" value={strategy.score} compact /></div>
        <div className="mt-5 grid grid-cols-2 gap-4"><ScoreBar label="Monte Carlo 생존" value={strategy.survival} max={1} /><ScoreBar label="파라미터 강건성" value={strategy.robustness} max={1} /></div>
        <div className="mt-5 grid grid-cols-3 gap-3"><Metric label="Sharpe" value={scoreText(strategy.sharpe)} /><Metric label="MDD" value={pct(strategy.mdd)} /><Metric label="Samples" value={String(strategy.samples)} /></div>
      </div>
      <section className="mt-6"><SectionTitle title="전략 설명" /><p className="text-[12px] leading-6 text-[#707a84]">{strategy.thesis}</p></section>
      <section className="mt-6"><SectionTitle title="검증 상태" /><div className="space-y-2"><CheckRow good={strategy.hardGatePassed} label={strategy.hardGatePassed ? 'Hard Gate 통과' : 'Hard Gate 미통과 또는 관측 전용'} />{strategy.reasons.slice(0, 5).map((reason) => <CheckRow key={reason} good={false} label={reasonKo(reason)} />)}</div></section>
      <WarningCard title="공식 Grade는 아직 표시하지 않습니다" body="현재 서버에서 canonical Grade Engine 결과를 내려주지 않기 때문에 모바일 UI가 점수를 임의로 AAA/AA 등급으로 변환하지 않습니다. 공식 Grade가 백엔드 source-of-truth로 제공되면 다시 표시합니다." />
    </DetailShell>
  );
};

export const PositionDetail = ({ position, decision, onBack }: { position: OpenPosition | null; decision: DecisionTapeItem | null; onBack: () => void }) => {
  if (!position) return <DetailShell title="포지션" onBack={onBack}><EmptyCard title="선택된 포지션 없음" body="포트폴리오에서 포지션을 선택해 주세요." /></DetailShell>;
  const tradeMap = decision?.tradeMap ?? {
    entryPrice: position.entryPrice,
    stopLossPrice: position.stopLossPrice,
    takeProfit1Price: position.takeProfit1Price ?? null,
    takeProfit2Price: position.takeProfit2Price ?? position.takeProfitPrice,
  };
  return (
    <DetailShell title={position.market} subtitle={`Paper open position · ${dateTime(position.openedAt)} 진입`} onBack={onBack}>
      <div className="rounded-[22px] border border-[#edf0f2] bg-white p-5"><div className="text-[10px] text-[#8b949d]">진입가</div><div className="mt-1 text-[29px] font-semibold tracking-[-0.05em]">{number.format(position.entryPrice)}</div><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Quantity" value={decimal.format(position.quantity)} /><Metric label="TP1 실행" value={position.takeProfit1Taken ? '완료' : '대기'} /><Metric label="Stop Loss" value={position.stopLossPrice == null ? '—' : number.format(position.stopLossPrice)} accent="#d95360" /><Metric label="TP2" value={(position.takeProfit2Price ?? position.takeProfitPrice) == null ? '—' : number.format(position.takeProfit2Price ?? position.takeProfitPrice ?? 0)} accent="#087fbf" /></div></div>
      <div className="mt-4"><ProtectionCard tradeMap={tradeMap} /></div>
      <section className="mt-6"><SectionTitle title="최근 판단" />{decision ? <ReasonCard title={`${actionKo(decision.decision)} · ${regimeKo(decision.regime)}`} body={reasonKo(decision.primaryReason || decision.reasons?.[0])} icon={<Brain className="h-4 w-4" />} /> : <EmptyCard title="최근 판단 없음" body="이 포지션과 연결된 최신 decision trace가 없습니다." />}</section>
    </DetailShell>
  );
};

export const AnalysisDetail = ({ decisions, selected, onSelect, onCouncil, onBack }: { decisions: DecisionTapeItem[]; selected: DecisionTapeItem | null; onSelect: (decision: DecisionTapeItem) => void; onCouncil: () => void; onBack: () => void }) => {
  const [chart, setChart] = useState<PriceChartPayload | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  useEffect(() => {
    if (!selected?.market || !/^KRW-[A-Z0-9]+$/.test(selected.market)) { setChart(null); return; }
    let active = true;
    setChartLoading(true);
    fetch(`/api/market-chart?market=${encodeURIComponent(selected.market)}&unit=60&count=48`, { cache: 'no-store' })
      .then((response) => response.json() as Promise<PriceChartPayload>)
      .then((payload) => { if (active) setChart(payload); })
      .catch(() => { if (active) setChart({ success: false, available: false }); })
      .finally(() => { if (active) setChartLoading(false); });
    return () => { active = false; };
  }, [selected?.market]);

  return (
    <DetailShell title="AI 리포트" subtitle="무슨 종목을 봤고, 무엇을 근거로, 어떤 경로로 결론이 나왔는지 설명합니다." onBack={onBack}>
      <DecisionPicker decisions={decisions} selected={selected} onSelect={onSelect} />
      {!selected ? <EmptyCard title="분석할 판단 없음" body="Paper Engine의 decisionTape가 생성되면 종목별 분석 리포트를 확인할 수 있습니다." /> : <>
        <div className="rounded-[22px] border border-[#edf0f2] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] text-[#9199a1]">분석 대상</div><div className="mt-1 text-[22px] font-semibold">{selected.market}</div><div className="mt-1 text-[10px] text-[#9ba3aa]">{dateTime(selected.timestamp)} · {regimeKo(selected.regime)}</div></div><StatusChip value={actionKo(selected.decision)} /></div>
          <div className="mt-5 flex justify-around"><ScoreGauge label="Oracle Score" value={selected.oracleTradeScore} /><ScoreGauge label="Confidence" value={selected.confidence} max={1} /><ScoreGauge label="Regime" value={selected.regimeConfidence} max={1} /></div>
        </div>
        <div className="mt-4">{chartLoading ? <EmptyCard title="가격 차트 불러오는 중" body="공개 시장 데이터에서 최근 1시간 봉을 불러오고 있습니다." /> : <PriceChart candles={chart?.candles ?? []} tradeMap={selected.tradeMap} />}</div>
        <section className="mt-6"><SectionTitle title="무엇을 봤나" /><div className="space-y-3">
          <ReasonCard title="기술 신호" icon={<TrendingUp className="h-4 w-4" />} body={selected.technicalEvidence ? `방향 점수 ${scoreText(selected.technicalEvidence.directionalScore)} · 신뢰도 ${pct(selected.technicalEvidence.confidence)} · 상승군 ${selected.technicalEvidence.bullishFamilies ?? 0} / 하락군 ${selected.technicalEvidence.bearishFamilies ?? 0} · 독립 신호군 ${selected.technicalEvidence.independentFamilyCount ?? 0}` : '기술 신호 상세가 저장되지 않았습니다.'} />
          <ReasonCard title="시장 구조" icon={<BarChart3 className="h-4 w-4" />} body={selected.structure ? `${selected.structure.bias ?? 'NEUTRAL'} · ${selected.structure.eventType ?? '구조 이벤트 없음'} ${selected.structure.eventDirection ?? ''} · 위치 ${selected.structure.location ?? '—'} · 신뢰도 ${pct(selected.structure.confidence)}` : '구조 분석 정보가 없습니다.'} />
          <ReasonCard title="Evidence" icon={<Database className="h-4 w-4" />} body={`활성 ${selected.evidenceActiveCount ?? 0}건 · 상충 ${selected.evidenceContradictionCount ?? 0}건 · Event Score ${scoreText(selected.eventScore)} · Forecast ${selected.forecast?.available ? `${selected.forecast.direction} / ${pct(selected.forecast.confidence)}` : '없음'}`} />
          <ReasonCard title="미세구조" icon={<Activity className="h-4 w-4" />} body={selected.microstructure?.available ? `${selected.microstructure.direction ?? 'NEUTRAL'} · 신뢰도 ${pct(selected.microstructure.confidence)} · 체결 표본 ${selected.microstructure.sampleTrades ?? 0} · 압력 ${scoreText(selected.microstructure.pressureScore)}` : '현재 의사결정에 사용 가능한 미세구조 표본이 없습니다.'} />
        </div></section>
        <section className="mt-6"><SectionTitle title="어떻게 결론 냈나" /><div className="space-y-3">
          <ReasonCard title="1. Strategy Router" body={`${selected.strategyDisposition ?? selected.router?.route ?? '미확인'} · ${reasonKo(selected.router?.reasons?.[0])}`} icon={<Network className="h-4 w-4" />} />
          <button type="button" onClick={onCouncil} className="block w-full text-left"><ReasonCard title="2. Council" body={`${selected.council?.verdict ? actionKo(selected.council.verdict) : '미검토'} · 찬성 ${selected.council?.approveCount ?? 0} / 주의 ${selected.council?.cautionCount ?? 0} / 반대 ${selected.council?.rejectCount ?? 0} · 눌러서 실제 심사 의견 보기`} icon={<Bot className="h-4 w-4" />} /></button>
          <ReasonCard title="3. Risk Gate" body={`${selected.riskDisposition ?? 'NOT_EVALUATED'} · ${(selected.riskReasons ?? []).map(reasonKo).join(' / ') || '별도 리스크 사유 없음'}`} icon={<ShieldCheck className="h-4 w-4" />} />
          <ReasonCard title="4. 최종 Decision" body={`${actionKo(selected.decision)} · ${reasonKo(selected.primaryReason || selected.reasons?.[0])}`} icon={<Brain className="h-4 w-4" />} />
        </div></section>
        <section className="mt-6"><SectionTitle title="손절·익절 계획" /><ProtectionCard tradeMap={selected.tradeMap} /></section>
        <section className="mt-6"><SectionTitle title="판단 이유 전체" /><div className="space-y-2">{(selected.reasons ?? []).slice(0, 8).map((reason, index) => <div key={`${reason}-${index}`} className="rounded-xl bg-white px-4 py-3 text-[11px] leading-5 text-[#6f7983]">{index + 1}. {reasonKo(reason)}</div>)}</div></section>
      </>}
    </DetailShell>
  );
};

export const EvidenceListDetail = ({ items, events, onSelectItem, onSelectEvent, onBack }: { items: OperationalEvidence[]; events: LedgerEvent[]; onSelectItem: (item: OperationalEvidence) => void; onSelectEvent: (event: LedgerEvent) => void; onBack: () => void }) => {
  const [filter, setFilter] = useState('ALL');
  const filtered = items.filter((item) => filter === 'ALL' || String(item.direction ?? '').toUpperCase() === filter);
  return (
    <DetailShell title="근거 (Evidence)" subtitle="뉴스 목록이 아니라 실제 의사결정에 연결 가능한 근거와 출처·신뢰도·영향을 봅니다." onBack={onBack}>
      <div className="mb-4 flex gap-2 overflow-x-auto"><Pill active={filter === 'ALL'} onClick={() => setFilter('ALL')}>전체</Pill><Pill active={filter === 'BULLISH'} onClick={() => setFilter('BULLISH')}>긍정</Pill><Pill active={filter === 'BEARISH'} onClick={() => setFilter('BEARISH')}>부정</Pill><Pill active={filter === 'NEUTRAL'} onClick={() => setFilter('NEUTRAL')}>중립</Pill></div>
      <div className="space-y-3">{filtered.map((item) => <button type="button" key={item.id} onClick={() => onSelectItem(item)} className="w-full rounded-[18px] border border-[#edf0f2] bg-white p-4 text-left shadow-[0_7px_22px_rgba(15,23,42,0.035)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><StatusChip value={item.direction ?? 'NEUTRAL'} />{item.market && <span className="text-[10px] font-semibold">{item.market}</span>}</div><div className="mt-3 text-[13px] font-semibold leading-5">{item.title || item.id}</div><div className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#87919b]">{item.rationale || '상세 rationale이 없습니다.'}</div><div className="mt-3 flex gap-3 text-[9px] text-[#9aa2aa]"><span>{item.source || 'unknown source'}</span><span>신뢰도 {pct(item.reliability)}</span><span>점수 {scoreText(item.evidence_score)}</span></div></div><span className="text-[9px] text-[#9ba3aa]">{dateTime(item.observed_at)}</span></div></button>)}{!filtered.length && <EmptyCard title="표시할 Evidence 없음" body="현재 필터에 해당하는 운영 Evidence가 없습니다." />}</div>
      <section className="mt-7"><SectionTitle title="Canonical Evidence 연결 로그" /><div className="space-y-3">{events.slice(0, 20).map((event) => <EventCard key={event.id || event.eventKey} event={event} onClick={() => onSelectEvent(event)} />)}{!events.length && <EmptyCard title="Evidence 로그 대기 중" body="Evidence가 decision trace에 연결되면 canonical ledger에 기록됩니다." />}</div></section>
    </DetailShell>
  );
};

export const EvidenceItemDetail = ({ item, onBack }: { item: OperationalEvidence | null; onBack: () => void }) => {
  if (!item) return <DetailShell title="근거 상세" onBack={onBack}><EmptyCard title="선택된 Evidence 없음" body="근거 목록에서 항목을 선택해 주세요." /></DetailShell>;
  const citations = Array.isArray(item.citations) ? item.citations : item.citations ? [String(item.citations)] : [];
  return (
    <DetailShell title="근거 상세" subtitle={`${item.market ?? '시장 미지정'} · ${item.source ?? '출처 미상'}`} onBack={onBack}>
      <div className="rounded-[22px] border border-[#edf0f2] bg-white p-5"><div className="flex items-center gap-2"><StatusChip value={item.direction ?? 'NEUTRAL'} />{item.evidence_grade && <Pill>{item.evidence_grade}</Pill>}</div><div className="mt-4 text-[18px] font-semibold leading-7">{item.title || item.id}</div><div className="mt-5 grid grid-cols-2 gap-4"><ScoreBar label="Reliability" value={item.reliability} max={1} /><ScoreBar label="Impact confidence" value={item.impact_confidence} max={1} /></div><div className="mt-5 grid grid-cols-3 gap-3"><Metric label="Evidence score" value={scoreText(item.evidence_score)} /><Metric label="Strength" value={scoreText(item.strength)} /><Metric label="Materiality" value={item.materiality ?? '—'} /></div></div>
      <section className="mt-6"><SectionTitle title="이게 무슨 근거인가" /><ReasonCard title="핵심 내용과 판단 연결" body={item.rationale || '이 Evidence에는 별도 rationale이 저장되지 않았습니다.'} /></section>
      <section className="mt-6"><SectionTitle title="출처·유효기간" /><div className="rounded-[18px] border border-[#edf0f2] bg-white p-4"><div className="grid grid-cols-2 gap-4"><Metric label="Source" value={item.source ?? '—'} /><Metric label="Source type" value={item.source_type ?? '—'} /><Metric label="Observed" value={dateTime(item.observed_at)} /><Metric label="Expires" value={dateTime(item.expires_at)} /><Metric label="신규 리스크 사용" value={item.eligible_for_new_risk ? '허용' : '미허용'} /><Metric label="Analysis model" value={item.analysis_model ?? '—'} /></div></div></section>
      {citations.length > 0 && <section className="mt-6"><SectionTitle title="인용·근거 링크 기록" /><div className="space-y-2">{citations.slice(0, 10).map((citation, index) => <div key={`${index}-${String(citation)}`} className="rounded-xl bg-white px-4 py-3 text-[10px] leading-5 text-[#68727c]">{String(citation)}</div>)}</div></section>}
    </DetailShell>
  );
};

export const CouncilDetail = ({ decisions, selected, onSelect, onBack }: { decisions: DecisionTapeItem[]; selected: DecisionTapeItem | null; onSelect: (decision: DecisionTapeItem) => void; onBack: () => void }) => {
  const members = selected?.council?.members ?? [];
  return (
    <DetailShell title="Council Room" subtitle="실제로 저장된 각 심사 축의 표결과 근거를 한국어 대화형으로 보여줍니다. Council은 자문이며 주문 실행 권한이 없습니다." onBack={onBack}>
      <DecisionPicker decisions={decisions} selected={selected} onSelect={onSelect} />
      {!selected ? <EmptyCard title="Council 판단 대기 중" body="decision trace가 생성되면 Council 심사 의견을 확인할 수 있습니다." /> : <>
        <div className="rounded-[20px] border border-[#edf0f2] bg-white p-4"><div className="flex items-start justify-between"><div><div className="text-[10px] text-[#929aa2]">검토 대상</div><div className="mt-1 text-[18px] font-semibold">{selected.market} · {actionKo(selected.decision)}</div></div><StatusChip value={actionKo(selected.council?.verdict ?? '미검토')} /></div><div className="mt-4 grid grid-cols-4 gap-2"><Metric label="찬성" value={String(selected.council?.approveCount ?? 0)} accent="#0aa77d" /><Metric label="주의" value={String(selected.council?.cautionCount ?? 0)} accent="#d49535" /><Metric label="반대" value={String(selected.council?.rejectCount ?? 0)} accent="#dc5a66" /><Metric label="보류" value={String(selected.council?.abstainCount ?? 0)} /></div></div>
        <div className="mt-5 space-y-3">{members.map((member, index) => {
          const positive = member.vote === 'APPROVE';
          return <div key={`${member.role}-${index}`} className={cn('flex', positive ? 'justify-start' : 'justify-end')}><div className={cn('max-w-[88%] rounded-[20px] px-4 py-3', positive ? 'rounded-tl-md bg-white border border-[#e7eeeb]' : member.vote === 'REJECT' ? 'rounded-tr-md bg-[#fff1f2] border border-[#f7dadd]' : 'rounded-tr-md bg-[#fff8ed] border border-[#f5e2bf]')}><div className="flex items-center gap-2"><span className="text-[11px] font-semibold">{roleKo(member.role)}</span><StatusChip value={actionKo(member.vote)} /></div><div className="mt-2 text-[11px] leading-5 text-[#5f6973]">{councilMessage(selected, member.role, member.vote, member.confidence, member.reasons)}</div><div className="mt-3"><ScoreBar label="이 의견의 confidence" value={member.confidence} max={1} /></div>{member.reasons?.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-[9px] font-semibold text-[#8b949d]">시스템 원문 근거 보기</summary><div className="mt-2 space-y-1">{member.reasons.slice(0, 3).map((reason) => <div key={reason} className="text-[9px] leading-4 text-[#9ba3aa]">• {reasonKo(reason)}</div>)}</div></details>}</div></div>;
        })}{!members.length && <EmptyCard title="Council 멤버 로그 없음" body="현재 선택된 판단에는 deterministic Council member snapshot이 없습니다." />}
        {selected.aiCouncilReview && <div className="flex justify-start"><div className="max-w-[88%] rounded-[20px] rounded-tl-md border border-[#dfe9f0] bg-[#f2f8fc] px-4 py-3"><div className="flex items-center gap-2"><span className="text-[11px] font-semibold">AI Shadow 심사관</span><StatusChip value={selected.aiCouncilReview.stance ?? 'CAUTION'} /></div><div className="mt-2 text-[11px] leading-5 text-[#5f6973]">{aiReviewMessage(selected.aiCouncilReview)}</div><div className="mt-3"><ScoreBar label="AI confidence" value={selected.aiCouncilReview.confidence} max={1} /></div></div></div>}
        </div>
        <div className="mt-6 rounded-[20px] bg-[#121820] p-5 text-white"><div className="text-[10px] text-white/60">최종 Council 요약</div><div className="mt-2 text-[22px] font-semibold">{actionKo(selected.council?.verdict ?? '미검토')}</div><div className="mt-2 text-[11px] leading-5 text-white/70">{selected.council?.summary ?? '별도 Council summary가 없습니다.'}</div><div className="mt-4 flex items-center gap-2 text-[9px] text-white/60"><Lock className="h-3.5 w-3.5" /> 실행 권한 없음 · Risk/Execution Gate가 별도로 통제</div></div>
      </>}
    </DetailShell>
  );
};

export const TradeTimelineDetail = ({ decisions, selected, onSelectDecision, events, recentTrades, onSelectEvent, onAnalysis, onBack }: { decisions: DecisionTapeItem[]; selected: DecisionTapeItem | null; onSelectDecision: (decision: DecisionTapeItem) => void; events: LedgerEvent[]; recentTrades: any[]; onSelectEvent: (event: LedgerEvent) => void; onAnalysis: () => void; onBack: () => void }) => {
  const [filter, setFilter] = useState('ALL');
  const types = ['DECISION', 'RISK', 'ORDER', 'TRADE', 'OUTCOME'];
  const timeline = events.filter((event) => types.includes(event.eventType) && (filter === 'ALL' || event.eventType === filter));
  return (
    <DetailShell title="거래 현황" subtitle="최근 대상 한 건이 아니라 판단→리스크→주문→거래→결과 전체 활동을 시간순으로 추적합니다." onBack={onBack}>
      <DecisionPicker decisions={decisions} selected={selected} onSelect={onSelectDecision} />
      {selected && <><button type="button" onClick={onAnalysis} className="w-full rounded-[22px] border border-[#edf0f2] bg-white p-5 text-left shadow-[0_12px_34px_rgba(15,23,42,0.05)]"><div className="flex items-start justify-between"><div><div className="text-[10px] text-[#929aa2]">현재 선택한 판단</div><div className="mt-1 text-[20px] font-semibold">{selected.market} · {actionKo(selected.decision)}</div><div className="mt-1 text-[10px] text-[#9aa2aa]">{dateTime(selected.timestamp)} · {regimeKo(selected.regime)}</div></div><div className="flex gap-2"><ScoreGauge label="Score" value={selected.oracleTradeScore} compact /><ScoreGauge label="Conf." value={selected.confidence} max={1} compact /></div></div><div className="mt-4 text-[11px] leading-5 text-[#727c86]">{reasonKo(selected.primaryReason || selected.reasons?.[0])}</div></button><div className="mt-4"><ProtectionCard tradeMap={selected.tradeMap} /></div></>}
      <section className="mt-7"><SectionTitle title="활동 타임라인" /><div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1"><Pill active={filter === 'ALL'} onClick={() => setFilter('ALL')}>전체</Pill>{types.map((type) => <Pill key={type} active={filter === type} onClick={() => setFilter(type)}>{eventTypeKo(type)}</Pill>)}</div><div className="space-y-3">{timeline.map((event) => <EventCard key={event.id || event.eventKey} event={event} onClick={() => onSelectEvent(event)} />)}{!timeline.length && <EmptyCard title="해당 로그 없음" body="현재 필터에 해당하는 canonical event가 없습니다." />}</div></section>
      <section className="mt-7"><SectionTitle title="완료된 거래" /><div className="space-y-2">{recentTrades.slice(0, 12).map((trade: any) => <div key={trade.id} className="rounded-[18px] border border-[#edf0f2] bg-white p-4"><div className="flex items-center justify-between"><div><div className="text-[13px] font-semibold">{trade.market}</div><div className="mt-1 text-[9px] text-[#9ba3aa]">{dateTime(trade.openedAt)} → {dateTime(trade.closedAt)}</div></div><div className="text-[14px] font-semibold" style={{ color: trade.netPnl >= 0 ? '#0aa77d' : '#dc5a66' }}>{money(trade.netPnl)}</div></div><div className="mt-3 grid grid-cols-3 gap-3"><Metric label="Return" value={pct(trade.returnPct, true)} /><Metric label="Exit" value={trade.exitReason ?? '—'} /><Metric label="Fees" value={money(trade.fees)} /></div></div>)}{!recentTrades.length && <EmptyCard title="완료 거래 없음" body="아직 닫힌 Paper 거래가 없습니다." />}</div></section>
    </DetailShell>
  );
};

export const LogDetail = ({ events, onSelectEvent, onBack }: { events: LedgerEvent[]; onSelectEvent: (event: LedgerEvent) => void; onBack: () => void }) => {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('ALL');
  const [order, setOrder] = useState<'NEW' | 'OLD'>('NEW');
  const types = ['ALL', 'EVIDENCE', 'STRATEGY', 'COUNCIL', 'DECISION', 'RISK', 'ORDER', 'TRADE', 'OUTCOME', 'AI'];
  const filtered = useMemo(() => events.filter((event) => {
    if (type !== 'ALL' && event.eventType !== type) return false;
    if (!query.trim()) return true;
    const haystack = `${event.eventType} ${event.eventName} ${event.market ?? ''} ${event.action ?? ''} ${event.summary} ${event.reason ?? ''} ${event.strategyId ?? ''}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }).sort((a, b) => order === 'NEW' ? b.occurredAt - a.occurredAt : a.occurredAt - b.occurredAt), [events, order, query, type]);
  return (
    <DetailShell title="Canonical Log" subtitle="태그·검색·정렬이 실제로 동작하며, 각 로그를 눌러 trace와 links까지 확인할 수 있습니다." onBack={onBack}>
      <div className="flex items-center gap-2 rounded-2xl border border-[#e8ecef] bg-white px-3 py-2.5"><Search className="h-4 w-4 text-[#9aa2aa]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="종목, 이벤트, 전략, 사유 검색" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#adb4ba]" /></div>
      <div className="mt-3 flex items-center justify-between"><div className="text-[10px] text-[#929aa2]">{filtered.length} events</div><Pill active onClick={() => setOrder((current) => current === 'NEW' ? 'OLD' : 'NEW')}>{order === 'NEW' ? '최신순 ↓' : '오래된순 ↑'}</Pill></div>
      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">{types.map((item) => <Pill key={item} active={type === item} onClick={() => setType(item)}>{item === 'ALL' ? '전체' : eventTypeKo(item)}</Pill>)}</div>
      <div className="mt-4 space-y-3">{filtered.map((event) => <EventCard key={event.id || event.eventKey} event={event} onClick={() => onSelectEvent(event)} />)}{!filtered.length && <EmptyCard title="검색 결과 없음" body="필터나 검색어를 바꿔 보세요." />}</div>
    </DetailShell>
  );
};

export const EventDetail = ({ event, onBack }: { event: LedgerEvent | null; onBack: () => void }) => {
  if (!event) return <DetailShell title="로그 상세" onBack={onBack}><EmptyCard title="선택된 로그 없음" body="로그 항목을 선택해 주세요." /></DetailShell>;
  return (
    <DetailShell title={eventTypeKo(event.eventType)} subtitle={`${event.market ?? '시장 미지정'} · ${dateTime(event.occurredAt)}`} onBack={onBack}>
      <div className="rounded-[22px] border border-[#edf0f2] bg-white p-5"><div className="flex items-center justify-between"><StatusChip value={event.action ?? event.eventType} /><span className="text-[9px] text-[#9aa2aa]">{event.severity}</span></div><div className="mt-4 text-[17px] font-semibold leading-6">{event.summary}</div>{event.reason && <div className="mt-3 rounded-xl bg-[#f6f8f9] p-3 text-[11px] leading-5 text-[#66717b]">{reasonKo(event.reason)}</div>}<div className="mt-4"><TagRow tags={eventTags(event)} /></div></div>
      <section className="mt-6"><SectionTitle title="메타데이터" /><div className="rounded-[18px] border border-[#edf0f2] bg-white p-4"><div className="grid grid-cols-2 gap-4"><Metric label="Event name" value={event.eventName} /><Metric label="Authority" value={event.authority} /><Metric label="Source" value={event.source} /><Metric label="Execution authority" value={event.executionAuthority ? '있음' : '없음'} /><Metric label="Strategy" value={event.strategyId ?? '—'} /><Metric label="Version" value={event.strategyVersion ?? '—'} /></div></div></section>
      <section className="mt-6"><SectionTitle title="상세 추적 (trace / links)" /><EventTrace event={event} /></section>
    </DetailShell>
  );
};
