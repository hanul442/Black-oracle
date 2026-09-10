import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, BarChart3, Bot, Brain, Database, Network, ShieldCheck, TrendingUp } from 'lucide-react';
import type { DecisionTapeItem, PriceCandle } from './types';
import { actionKo, dateTime, pct, reasonKo, regimeKo, scoreText } from './types';
import { formatKrw } from './financial';
import { DetailShell, EmptyCard, Pill, ProtectionCard, ReasonCard, ScoreGauge, SectionTitle, StatusChip } from './ui';

type ChartPayload = {
  success?: boolean;
  available?: boolean;
  market?: string;
  source?: 'UPBIT_PUBLIC' | 'KIS_OFFICIAL' | string;
  assetClass?: 'CRYPTO' | 'EQUITY' | string;
  configured?: boolean;
  unit?: number;
  count?: number;
  asOf?: number | null;
  candles?: PriceCandle[];
  error?: string;
};

type Timeframe = { label: string; unit: number; count: number };

const CRYPTO_TIMEFRAMES: Timeframe[] = [
  { label: '1m', unit: 1, count: 120 },
  { label: '5m', unit: 5, count: 120 },
  { label: '15m', unit: 15, count: 96 },
  { label: '1H', unit: 60, count: 72 },
  { label: '4H', unit: 240, count: 60 },
];

const EQUITY_TIMEFRAMES: Timeframe[] = [
  { label: '1m', unit: 1, count: 120 },
  { label: '5m', unit: 5, count: 96 },
  { label: '15m', unit: 15, count: 80 },
  { label: '1H', unit: 60, count: 60 },
  { label: '1D', unit: 1440, count: 60 },
];

const DecisionPicker = ({ decisions, selected, onSelect }: { decisions: DecisionTapeItem[]; selected: DecisionTapeItem | null; onSelect: (decision: DecisionTapeItem) => void }) => (
  <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
    {decisions.map((decision) => (
      <Pill key={`${decision.market}-${decision.timestamp}`} active={selected?.market === decision.market && selected?.timestamp === decision.timestamp} onClick={() => onSelect(decision)}>{decision.market}</Pill>
    ))}
  </div>
);

const marketSourceLabel = (source: ChartPayload['source']) => source === 'UPBIT_PUBLIC' ? 'Upbit Public' : source === 'KIS_OFFICIAL' ? 'KIS Official' : source || 'Market Data';

const candleColor = (candle: PriceCandle) => candle.close >= candle.open ? '#0aa77d' : '#dc5a66';

const OhlcvChart = ({ payload, decision, timeframe }: { payload: ChartPayload; decision: DecisionTapeItem; timeframe: Timeframe }) => {
  const candles = (payload.candles ?? []).filter((item) => [item.timestamp, item.open, item.high, item.low, item.close, item.volume].every(Number.isFinite));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => setSelectedIndex(null), [decision.market, timeframe.unit, payload.asOf]);

  if (candles.length < 2) {
    const body = payload.configured === false
      ? '이 배포에는 해당 시장 데이터 자격증명이 연결되지 않았습니다. 가격을 추정하지 않고 빈 상태로 표시합니다.'
      : payload.error || '실제 시장 OHLCV 데이터를 불러오지 못했습니다. 가격을 임의 생성하지 않습니다.';
    return <EmptyCard title="실제 가격 데이터 없음" body={body} />;
  }

  const width = 340;
  const priceTop = 22;
  const priceBottom = 196;
  const volumeTop = 212;
  const volumeBottom = 260;
  const left = 12;
  const right = 328;
  const plotWidth = right - left;
  const slot = plotWidth / candles.length;
  const candleWidth = Math.max(1.5, Math.min(5.5, slot * 0.62));
  const overlays = [
    { label: 'ENTRY', value: decision.tradeMap?.entryPrice, color: '#2d343b' },
    { label: 'SL', value: decision.tradeMap?.stopLossPrice, color: '#dc5a66' },
    { label: 'TP1', value: decision.tradeMap?.takeProfit1Price, color: '#0aa77d' },
    { label: 'TP2', value: decision.tradeMap?.takeProfit2Price, color: '#1687c7' },
  ].filter((item): item is { label: string; value: number; color: string } => item.value != null && Number.isFinite(item.value));

  const rawMin = Math.min(...candles.map((item) => item.low), ...overlays.map((item) => item.value));
  const rawMax = Math.max(...candles.map((item) => item.high), ...overlays.map((item) => item.value));
  const pad = Math.max((rawMax - rawMin) * 0.08, rawMax * 0.0005, 0.00000001);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const span = Math.max(max - min, 0.00000001);
  const maxVolume = Math.max(...candles.map((item) => item.volume), 1);
  const xFor = (index: number) => left + slot * (index + 0.5);
  const yFor = (value: number) => priceBottom - ((value - min) / span) * (priceBottom - priceTop);
  const volumeY = (volume: number) => volumeBottom - (volume / maxVolume) * (volumeBottom - volumeTop);

  const decisionIndex = candles.reduce((best, candle, index) => {
    const currentDistance = Math.abs(candle.timestamp - decision.timestamp);
    const bestDistance = Math.abs(candles[best].timestamp - decision.timestamp);
    return currentDistance < bestDistance ? index : best;
  }, 0);
  const intervalMs = timeframe.unit * 60_000;
  const decisionVisible = decision.timestamp >= candles[0].timestamp - intervalMs && decision.timestamp <= candles[candles.length - 1].timestamp + intervalMs;
  const inspected = candles[selectedIndex ?? candles.length - 1];
  const first = candles[0];
  const last = candles[candles.length - 1];
  const periodChange = first.open > 0 ? last.close / first.open - 1 : null;
  const candleChange = inspected.open > 0 ? inspected.close / inspected.open - 1 : null;
  const positive = (periodChange ?? 0) >= 0;

  const inspectFromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = ((event.clientX - rect.left) / rect.width) * width;
    const index = Math.max(0, Math.min(candles.length - 1, Math.floor((localX - left) / slot)));
    setSelectedIndex(index);
  };

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#e8ecef] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.045)]">
      <div className="px-4 pb-2 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[9px] font-medium text-[#929aa2]">{marketSourceLabel(payload.source)} · 실제 OHLCV</div>
            <div className="mt-1 text-[22px] font-semibold tracking-[-0.035em]">{formatKrw(last.close)}</div>
            <div className="mt-1 text-[10px] font-semibold" style={{ color: positive ? '#0aa77d' : '#dc5a66' }}>{pct(periodChange, true)} · 표시 구간</div>
          </div>
          <div className="text-right"><div className="text-[9px] text-[#9aa2aa]">최근 봉</div><div className="mt-1 text-[10px] font-medium text-[#59636d]">{dateTime(payload.asOf ?? last.timestamp)}</div></div>
        </div>
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${width} 272`} className="h-[272px] w-full touch-pan-y select-none" role="img" aria-label={`${decision.market} ${timeframe.label} 실제 캔들 및 거래량 차트`} onPointerDown={inspectFromPointer}>
        {[0, 1, 2, 3, 4].map((row) => {
          const y = priceTop + ((priceBottom - priceTop) / 4) * row;
          return <line key={`grid-${row}`} x1={left} x2={right} y1={y} y2={y} stroke="#eef1f3" strokeWidth="1" />;
        })}
        <line x1={left} x2={right} y1={205} y2={205} stroke="#e6eaed" strokeWidth="1" />

        {candles.map((candle, index) => {
          const x = xFor(index);
          const color = candleColor(candle);
          const openY = yFor(candle.open);
          const closeY = yFor(candle.close);
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(1.2, Math.abs(closeY - openY));
          return (
            <g key={`${candle.timestamp}-${index}`}>
              <line x1={x} x2={x} y1={yFor(candle.high)} y2={yFor(candle.low)} stroke={color} strokeWidth="1" />
              <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} rx="0.7" fill={color} />
              <rect x={x - candleWidth / 2} y={volumeY(candle.volume)} width={candleWidth} height={Math.max(1, volumeBottom - volumeY(candle.volume))} rx="0.5" fill={color} opacity="0.34" />
            </g>
          );
        })}

        {overlays.map((overlay) => {
          const y = yFor(overlay.value);
          return (
            <g key={overlay.label}>
              <line x1={left} x2={right} y1={y} y2={y} stroke={overlay.color} strokeWidth="1" strokeDasharray="4 4" opacity="0.82" />
              <rect x={right - 49} y={y - 8.5} width="49" height="14" rx="5" fill="white" opacity="0.92" />
              <text x={right - 3} y={y + 1} textAnchor="end" fontSize="7.5" fontWeight="600" fill={overlay.color}>{overlay.label} {formatKrw(overlay.value).replace('₩', '')}</text>
            </g>
          );
        })}

        {decisionVisible && (
          <g>
            <line x1={xFor(decisionIndex)} x2={xFor(decisionIndex)} y1={priceTop} y2={volumeBottom} stroke="#111820" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
            <rect x={Math.max(left, Math.min(right - 58, xFor(decisionIndex) - 29))} y="5" width="58" height="15" rx="6" fill="#111820" />
            <text x={Math.max(left + 29, Math.min(right - 29, xFor(decisionIndex)))} y="15" textAnchor="middle" fontSize="7.5" fontWeight="600" fill="white">DECISION</text>
          </g>
        )}

        {selectedIndex != null && (
          <g>
            <line x1={xFor(selectedIndex)} x2={xFor(selectedIndex)} y1={priceTop} y2={volumeBottom} stroke="#6f7983" strokeWidth="0.8" opacity="0.55" />
            <circle cx={xFor(selectedIndex)} cy={yFor(inspected.close)} r="3" fill="white" stroke="#1b242c" strokeWidth="1.5" />
          </g>
        )}
      </svg>

      <div className="border-t border-[#eef1f3] px-4 py-3">
        <div className="mb-2 flex items-center justify-between"><div className="text-[9px] font-medium text-[#87919a]">{selectedIndex == null ? '최근 봉' : '선택한 봉'} · {dateTime(inspected.timestamp)}</div><div className="text-[10px] font-semibold" style={{ color: (candleChange ?? 0) >= 0 ? '#0aa77d' : '#dc5a66' }}>{pct(candleChange, true)}</div></div>
        <div className="grid grid-cols-5 gap-2 text-center">
          {[['시가', inspected.open], ['고가', inspected.high], ['저가', inspected.low], ['종가', inspected.close]].map(([label, value]) => <div key={String(label)}><div className="text-[8px] text-[#9aa2aa]">{label}</div><div className="mt-1 truncate text-[9px] font-semibold">{formatKrw(Number(value))}</div></div>)}
          <div><div className="text-[8px] text-[#9aa2aa]">거래량</div><div className="mt-1 truncate text-[9px] font-semibold">{new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(inspected.volume)}</div></div>
        </div>
        <div className="mt-3 text-[8px] leading-4 text-[#a0a7ae]">차트를 눌러 봉을 검사할 수 있습니다. ENTRY/SL/TP는 Black Oracle Trade Map이며 시장 체결가와 구분됩니다.</div>
      </div>
    </div>
  );
};

const ConfidenceBreakdown = ({ decision }: { decision: DecisionTapeItem }) => {
  const councilValues = (decision.council?.members ?? []).map((member) => member.confidence).filter(Number.isFinite);
  const councilConfidence = councilValues.length ? councilValues.reduce((sum, value) => sum + value, 0) / councilValues.length : null;
  const rows = [
    ['최종 판단', decision.confidence],
    ['시장 국면', decision.regimeConfidence],
    ['기술 근거', decision.technicalEvidence?.confidence],
    ['Forecast', decision.forecast?.available ? decision.forecast.confidence : null],
    ['Council 평균', councilConfidence],
  ] as Array<[string, number | null | undefined]>;
  return (
    <div className="rounded-[20px] border border-[#edf0f2] bg-white p-4">
      <div className="text-[12px] font-semibold">Confidence Breakdown</div>
      <div className="mt-1 text-[9px] leading-4 text-[#98a1aa]">각 값은 서로 다른 모듈의 신뢰도입니다. 동일한 확률 척도로 간주하지 않습니다.</div>
      <div className="mt-4 space-y-3">{rows.map(([label, value]) => {
        const normalized = value == null || !Number.isFinite(value) ? 0 : Math.max(0, Math.min(100, value * 100));
        return <div key={label}><div className="mb-1 flex justify-between text-[9px]"><span className="text-[#7f8992]">{label}</span><span className="font-semibold text-[#303840]">{value == null || !Number.isFinite(value) ? '—' : `${Math.round(value * 100)}%`}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#edf1f3]"><div className="h-full rounded-full bg-[#303840]" style={{ width: `${normalized}%` }} /></div></div>;
      })}</div>
    </div>
  );
};

export const AnalysisDetailV2 = ({ decisions, selected, onSelect, onCouncil, onBack }: { decisions: DecisionTapeItem[]; selected: DecisionTapeItem | null; onSelect: (decision: DecisionTapeItem) => void; onCouncil: () => void; onBack: () => void }) => {
  const [timeframeUnit, setTimeframeUnit] = useState(60);
  const [chart, setChart] = useState<ChartPayload | null>(null);
  const [chartLoading, setChartLoading] = useState(false);

  const isEquity = Boolean(selected?.market && /^KRX-\d{6}$/.test(selected.market));
  const timeframes = isEquity ? EQUITY_TIMEFRAMES : CRYPTO_TIMEFRAMES;
  const timeframe = useMemo(() => timeframes.find((item) => item.unit === timeframeUnit) ?? timeframes.find((item) => item.unit === 60) ?? timeframes[0], [timeframeUnit, isEquity]);

  useEffect(() => {
    if (!timeframes.some((item) => item.unit === timeframeUnit)) setTimeframeUnit(isEquity ? 1440 : 60);
  }, [isEquity]);

  useEffect(() => {
    if (!selected?.market) { setChart(null); return; }
    if (!/^KRW-[A-Z0-9]+$/.test(selected.market) && !/^KRX-\d{6}$/.test(selected.market)) { setChart(null); return; }
    let active = true;
    setChartLoading(true);
    fetch(`/api/market-chart?market=${encodeURIComponent(selected.market)}&unit=${timeframe.unit}&count=${timeframe.count}`, { cache: 'no-store' })
      .then((response) => response.json() as Promise<ChartPayload>)
      .then((payload) => { if (active) setChart(payload); })
      .catch(() => { if (active) setChart({ success: false, available: false, market: selected.market, error: '시장 데이터 요청에 실패했습니다.' }); })
      .finally(() => { if (active) setChartLoading(false); });
    return () => { active = false; };
  }, [selected?.market, timeframe.unit, timeframe.count]);

  return (
    <DetailShell title="AI 리포트" subtitle="실제 시장 데이터 위에 Black Oracle의 판단·보호선·근거를 겹쳐 봅니다." onBack={onBack}>
      <DecisionPicker decisions={decisions} selected={selected} onSelect={onSelect} />
      {!selected ? <EmptyCard title="분석할 판단 없음" body="Paper Engine의 decisionTape가 생성되면 종목별 분석 리포트를 확인할 수 있습니다." /> : <>
        <div className="rounded-[22px] border border-[#edf0f2] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] text-[#9199a1]">분석 대상</div><div className="mt-1 text-[22px] font-semibold">{selected.market}</div><div className="mt-1 text-[10px] text-[#9ba3aa]">{dateTime(selected.timestamp)} · {regimeKo(selected.regime)}</div></div><StatusChip value={actionKo(selected.decision)} /></div>
          <div className="mt-5 flex justify-around"><ScoreGauge label="Oracle Score" value={selected.oracleTradeScore} /><ScoreGauge label="Confidence" value={selected.confidence} max={1} /><ScoreGauge label="Regime" value={selected.regimeConfidence} max={1} /></div>
        </div>

        <section className="mt-5">
          <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">{timeframes.map((item) => <Pill key={item.unit} active={timeframe.unit === item.unit} onClick={() => setTimeframeUnit(item.unit)}>{item.label}</Pill>)}</div>
          {chartLoading ? <EmptyCard title="실제 차트 불러오는 중" body={`${selected.market} ${timeframe.label} OHLCV 데이터를 가져오고 있습니다.`} /> : chart ? <OhlcvChart payload={chart} decision={selected} timeframe={timeframe} /> : <EmptyCard title="차트 지원 대기 중" body="현재 종목 형식에는 연결된 시장 데이터 어댑터가 없습니다." />}
        </section>

        <div className="mt-4"><ConfidenceBreakdown decision={selected} /></div>

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
