import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type TradingStatus = any;
type TradeCase = any;
type CouncilFeed = any;
type Tab = 'OVERVIEW' | 'EVIDENCE' | 'SCENARIO' | 'COUNCIL' | 'RISK' | 'HISTORY';

const money = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const pct = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;
const price = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `₩${money.format(value)}`;
const stamp = (value: number | null | undefined) => value ? new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const signedPct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
const tone = (value: string | null | undefined) => {
  if (!value) return 'text-[#77818a]';
  if (['ADVANCE', 'SUPPORTED', 'SUPPORT', 'PASS', 'ENTER'].includes(value)) return 'text-[#62d49f]';
  if (['CHALLENGE', 'OPPOSED', 'REJECT', 'EXIT'].includes(value)) return 'text-[#ff6262]';
  if (['MONITOR', 'CAUTION', 'MIXED', 'WATCH'].includes(value)) return 'text-[#f3b642]';
  return 'text-[#9aa3aa]';
};

export const TerminalPositionsView: React.FC = () => {
  const [status, setStatus] = useState<TradingStatus | null>(null);
  const [cases, setCases] = useState<TradeCase[]>([]);
  const [councilFeed, setCouncilFeed] = useState<CouncilFeed | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [statusResponse, caseResponse, councilResponse] = await Promise.all([
        fetch('/api/trading-status', { cache: 'no-store' }),
        fetch('/api/trade-cases', { cache: 'no-store' }),
        fetch('/api/trading-council-trace', { cache: 'no-store' }),
      ]);
      const [nextStatus, nextCases, nextCouncil] = await Promise.all([
        statusResponse.json(),
        caseResponse.json(),
        councilResponse.json(),
      ]);
      setStatus(nextStatus);
      setCases(Array.isArray(nextCases?.cases) ? nextCases.cases : []);
      setCouncilFeed(nextCouncil);
      setError(statusResponse.ok && caseResponse.ok && councilResponse.ok
        ? null
        : nextStatus?.error || nextCases?.error || nextCouncil?.error || 'Operator data request failed.');
      const firstMarket = nextCouncil?.traces?.[0]?.market
        || nextStatus?.decisionTape?.[0]?.market
        || nextStatus?.positionEvidence?.[0]?.market
        || nextCases?.cases?.[0]?.market
        || null;
      setSelectedMarket((current) => current || firstMarket);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Operator data request failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const positions = status?.positionEvidence || [];
  const decisionTape = status?.decisionTape || [];
  const councilRows = councilFeed?.traces || [];
  const markets = useMemo(() => Array.from(new Set([
    ...councilRows.map((item: any) => item.market),
    ...decisionTape.map((item: any) => item.market),
    ...positions.map((item: any) => item.market),
    ...cases.map((item: any) => item.market),
  ])).filter(Boolean) as string[], [cases, councilRows, decisionTape, positions]);

  const selectedPosition = positions.find((item: any) => item.market === selectedMarket) || null;
  const selectedDecision = decisionTape.find((item: any) => item.market === selectedMarket) || null;
  const selectedCouncil = councilRows.find((item: any) => item.market === selectedMarket) || null;
  const selectedCase = cases.find((item: any) => item.market === selectedMarket && item.status === 'OPEN')
    || cases.find((item: any) => item.market === selectedMarket)
    || null;
  const caseSnapshot = selectedCase?.governanceSnapshot || null;
  const liveTrace = selectedCouncil?.trace || null;
  const scenarios = liveTrace?.scenarios || caseSnapshot?.scenarios || [];
  const recommendedScenarioId = liveTrace?.v1?.recommendedScenarioId || caseSnapshot?.recommendedScenarioId || null;
  const recommendedScenario = scenarios.find((item: any) => item.id === recommendedScenarioId) || null;
  const councilRankings = liveTrace?.v1?.rankings || caseSnapshot?.councilRankings || [];
  const councilLenses = liveTrace?.v1?.lensReviews || caseSnapshot?.lensReviews || [];
  const history = selectedCase?.decisionHistory || [];
  const evidenceItems = selectedCouncil?.evidence?.items || selectedPosition?.evidenceItems || [];
  const evidenceActive = selectedCouncil?.evidence?.activeCount ?? selectedPosition?.externalEvidenceActive ?? selectedDecision?.evidenceActiveCount ?? 0;
  const evidenceContradictions = selectedCouncil?.evidence?.contradictionCount ?? selectedPosition?.externalEvidenceContradictions ?? selectedDecision?.evidenceContradictionCount ?? 0;
  const evidenceState = evidenceContradictions > 0 ? 'CONTESTED' : evidenceActive > 0 ? 'EVIDENCE_SUPPORTED' : 'INSUFFICIENT';
  const currentMark = selectedPosition?.markPrice ?? selectedCouncil?.anchorPrice ?? null;
  const currentRisk = selectedDecision?.riskDisposition || selectedPosition?.riskDisposition || selectedCase?.latestDecision?.riskDisposition || '—';
  const currentConfidence = selectedDecision?.confidence ?? selectedPosition?.confidence ?? null;
  const currentScore = selectedDecision?.oracleTradeScore ?? selectedPosition?.oracleTradeScore ?? null;
  const currentV1 = selectedCouncil?.v1 || null;

  return (
    <div className="terminal-screen h-full overflow-hidden bg-[#030405] text-[#d9dde1]">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-8 shrink-0 items-center gap-3 border-b border-[#24282c] bg-[#070809] px-3 font-mono text-[7px] uppercase tracking-[0.08em]">
          <span className="text-[#f3a312]">POSITIONS / COUNCIL TRACE</span>
          <span className="text-[#5c666f]">MARKETS <b className="font-normal text-[#c4cbd1]">{markets.length}</b></span>
          <span className="text-[#5c666f]">OPEN <b className="font-normal text-[#c4cbd1]">{positions.length}</b></span>
          <span className="text-[#5c666f]">C1/C2 <b className="font-normal text-[#c4cbd1]">{councilFeed?.comparison?.total ?? '—'}</b></span>
          <span className="text-[#5c666f]">RESOLVED <b className="font-normal text-[#c4cbd1]">{councilFeed?.comparison?.resolved ?? '—'}</b></span>
          {error && <span className="truncate text-[#ff6262]">{error}</span>}
          <button onClick={() => { setLoading(true); void load(); }} className="terminal-action ml-auto"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />REFRESH</button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-[#24282c] xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-auto bg-[#050607]">
            <div className="sticky top-0 z-10 grid grid-cols-[82px_78px_62px_42px_72px_1fr] border-b border-[#282d32] bg-[#0a0b0c] px-2 py-1.5 font-mono text-[6px] uppercase tracking-[0.08em] text-[#59636b]">
              <span>MARKET</span><span>MARK</span><span>FINAL</span><span>EVID</span><span>COUNCIL</span><span>STATE</span>
            </div>
            {markets.map((market) => {
              const position = positions.find((item: any) => item.market === market);
              const decision = decisionTape.find((item: any) => item.market === market);
              const councilRow = councilRows.find((item: any) => item.market === market);
              const caseItem = cases.find((item: any) => item.market === market);
              const active = market === selectedMarket;
              const evidenceCount = councilRow?.evidence?.activeCount ?? position?.externalEvidenceActive ?? decision?.evidenceActiveCount ?? 0;
              const decisionState = decision?.decision || decision?.action || (position ? 'HOLD' : caseItem?.status || 'RESEARCH');
              const councilState = councilRow?.v1?.disposition || decision?.governance?.intelligenceDisposition || '—';
              return (
                <button key={market} onClick={() => { setSelectedMarket(market); setTab('OVERVIEW'); }} className={`grid w-full grid-cols-[82px_78px_62px_42px_72px_1fr] border-b border-[#15191c] px-2 py-2 text-left font-mono text-[7px] ${active ? 'bg-[#101113]' : 'bg-[#050607] hover:bg-[#0a0c0e]'}`}>
                  <span className={active ? 'font-semibold text-[#f3a312]' : 'text-[#d1d6da]'}>{market}</span>
                  <span className="tabular-nums text-[#a2abb3]">{price(position?.markPrice ?? councilRow?.anchorPrice)}</span>
                  <span className={tone(decisionState)}>{decisionState}</span>
                  <span className={evidenceCount > 0 ? 'text-[#62d49f]' : 'text-[#f3b642]'}>{evidenceCount}</span>
                  <span className={tone(councilState)}>{councilState}</span>
                  <span className="truncate text-[#66717a]">{position ? 'OPEN' : councilRow?.trace ? 'TRACE' : caseItem?.status || 'PAPER'}</span>
                </button>
              );
            })}
            {!markets.length && <div className="px-3 py-10 text-center font-mono text-[7px] uppercase tracking-[0.08em] text-[#4f585f]">No Paper market data</div>}
          </aside>

          <main className="flex min-h-0 flex-col bg-[#050607]">
            {selectedMarket ? (
              <>
                <div className="shrink-0 border-b border-[#24282c] bg-[#070809]">
                  <div className="flex flex-wrap items-end gap-x-5 gap-y-2 px-3 py-2.5 font-mono">
                    <div>
                      <div className="text-[6px] uppercase tracking-[0.08em] text-[#59636b]">MARKET</div>
                      <div className="mt-1 text-[15px] font-semibold text-[#f3a312]">{selectedMarket}</div>
                    </div>
                    <HeaderMetric label="MARK" value={price(currentMark)} />
                    <HeaderMetric label="FINAL" value={selectedDecision?.decision || selectedDecision?.action || '—'} warn={(selectedDecision?.decision || selectedDecision?.action) === 'NO_TRADE'} />
                    <HeaderMetric label="SCORE" value={currentScore == null ? '—' : String(currentScore)} />
                    <HeaderMetric label="CONF" value={pct(currentConfidence, 0)} />
                    <HeaderMetric label="RISK" value={currentRisk} warn={currentRisk === 'REJECT'} />
                    <HeaderMetric label="EVIDENCE" value={`${evidenceActive}/${evidenceContradictions}`} warn={evidenceActive === 0 || evidenceContradictions > 0} />
                    <HeaderMetric label="COUNCIL V1" value={currentV1?.disposition || selectedDecision?.governance?.intelligenceDisposition || '—'} warn={['CHALLENGE', 'OPPOSED', 'INSUFFICIENT'].includes(currentV1?.disposition || selectedDecision?.governance?.intelligenceDisposition)} />
                    <HeaderMetric label="COUNCIL V2" value={selectedCouncil?.v2?.disposition || '—'} warn={selectedCouncil?.v2?.disposition === 'CHALLENGE'} />
                    <HeaderMetric label="TRACE" value={liveTrace ? 'PERSISTED' : 'LEGACY / —'} warn={!liveTrace} />
                  </div>
                  <div className="flex h-8 overflow-x-auto border-t border-[#1c2024] px-2 font-mono text-[6.5px] uppercase tracking-[0.08em]">
                    {(['OVERVIEW', 'EVIDENCE', 'SCENARIO', 'COUNCIL', 'RISK', 'HISTORY'] as Tab[]).map((item) => (
                      <button key={item} onClick={() => setTab(item)} className={`border-b px-3 ${tab === item ? 'border-[#f3a312] text-[#f3a312]' : 'border-transparent text-[#657079] hover:text-[#aab2b8]'}`}>{item}</button>
                    ))}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-2.5 font-mono">
                  {tab === 'OVERVIEW' && <Overview position={selectedPosition} tradeCase={selectedCase} decision={selectedDecision} council={selectedCouncil} recommended={recommendedScenario} evidenceState={evidenceState} />}
                  {tab === 'EVIDENCE' && <Evidence items={evidenceItems} state={evidenceState} />}
                  {tab === 'SCENARIO' && <Scenario items={scenarios} recommendedId={recommendedScenarioId} />}
                  {tab === 'COUNCIL' && <Council rankings={councilRankings} lenses={councilLenses} scenarios={scenarios} row={selectedCouncil} decision={selectedDecision} />}
                  {tab === 'RISK' && <Risk position={selectedPosition} trace={selectedDecision || selectedCase?.latestDecision || selectedCase?.entry?.trace} />}
                  {tab === 'HISTORY' && <History items={history} latest={selectedDecision} />}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center font-mono text-[7px] uppercase tracking-[0.08em] text-[#4f585f]">Select a market</div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

const HeaderMetric = ({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) => (
  <div className="min-w-[72px]">
    <div className="text-[5.5px] uppercase tracking-[0.08em] text-[#59636b]">{label}</div>
    <div className={`mt-1 text-[9px] tabular-nums ${warn ? 'text-[#f3b642]' : 'text-[#c5cbd0]'}`}>{value}</div>
  </div>
);

const Panel = ({ title, children }: React.PropsWithChildren<{ title: string }>) => (
  <section className="border border-[#20252a] bg-[#070809]">
    <div className="border-b border-[#20252a] px-2.5 py-1.5 text-[6px] uppercase tracking-[0.08em] text-[#66717a]">{title}</div>
    <div className="p-2.5">{children}</div>
  </section>
);

const Overview = ({ position, tradeCase, decision, council, recommended, evidenceState }: any) => (
  <div className="grid gap-2 xl:grid-cols-2">
    <Panel title="CURRENT PAPER STATE">
      <KeyRows rows={[
        ['STATUS', position ? 'OPEN' : decision?.decision || decision?.action || tradeCase?.status || 'PAPER'],
        ['ROUTE', decision?.strategyDisposition || position?.router || tradeCase?.latestDecision?.strategyDisposition || '—'],
        ['REGIME', decision?.regime || position?.regime || tradeCase?.latestDecision?.regime || '—'],
        ['EVIDENCE', evidenceState || '—'],
        ['CASE', tradeCase?.id || 'NOT LINKED'],
        ['DECISION AT', stamp(decision?.timestamp || position?.lastDecisionAt)],
      ]} />
    </Panel>
    <Panel title="DECISION / THESIS">
      <div className="text-[8px] leading-5 text-[#aeb5bb]">{decision?.primaryReason || position?.primaryReason || tradeCase?.latestDecision?.primaryReason || 'No persisted decision explanation.'}</div>
      <div className="mt-3 border-t border-[#1b2024] pt-2 text-[7px] text-[#77818a]">Recommended scenario: <span className="text-[#c5cbd0]">{recommended?.label || council?.v1?.label || 'NOT LINKED'}</span></div>
      <div className="mt-1 text-[7px] text-[#77818a]">Scenario thesis: <span className="text-[#9ca5ad]">{recommended?.thesis || '—'}</span></div>
    </Panel>
    <Panel title="GOVERNANCE CHAIN">
      <KeyRows rows={[
        ['EVIDENCE', `${council?.evidence?.activeCount ?? decision?.evidenceActiveCount ?? 0} active / ${council?.evidence?.contradictionCount ?? decision?.evidenceContradictionCount ?? 0} contradiction`],
        ['SCENARIO', council?.v1 ? `${council.v1.label} · ${council.v1.direction}` : recommended?.label || '—'],
        ['COUNCIL V1', council?.v1 ? `${council.v1.disposition} · ${pct(council.v1.confidence, 0)}` : decision?.governance?.intelligenceDisposition || '—'],
        ['RISK', decision?.riskDisposition || position?.riskDisposition || '—'],
        ['FINAL', decision?.decision || decision?.action || '—'],
        ['V2 SHADOW', council?.v2 ? `${council.v2.disposition} · ${pct(council.v2.confidence, 0)}` : '—'],
      ]} />
    </Panel>
    <Panel title="LINKAGE / AUTHORITY">
      <KeyRows rows={[
        ['INTELLIGENCE', council?.trace?.intelligencePackageId || tradeCase?.intelligencePackageId || decision?.governance?.intelligencePackageId || 'NOT LINKED'],
        ['SCENARIO SET', council?.trace?.scenarioSetId || tradeCase?.scenarioSetId || decision?.governance?.scenarioSetId || 'NOT LINKED'],
        ['COUNCIL RUN', council?.trace?.councilRunId || tradeCase?.councilRunId || decision?.governance?.councilRunId || 'NOT LINKED'],
        ['V1 AUTHORITY', 'PAPER GOVERNANCE'],
        ['V2 AUTHORITY', 'NONE / SHADOW'],
        ['LIVE AUTHORITY', 'NONE'],
      ]} />
    </Panel>
  </div>
);

const Evidence = ({ items, state }: any) => (
  <Panel title={`STRUCTURED EVIDENCE / ${state || 'UNKNOWN'}`}>
    <div className="overflow-x-auto">
      <div className="grid min-w-[820px] grid-cols-[90px_72px_72px_110px_120px_minmax(320px,1fr)] border-b border-[#252a2f] pb-1.5 text-[6px] uppercase tracking-[0.08em] text-[#59636b]"><span>DIR</span><span>STR</span><span>REL</span><span>TYPE</span><span>PUBLISHER</span><span>TITLE / SUMMARY</span></div>
      {items.map((item: any) => <div key={item.id} className="grid min-w-[820px] grid-cols-[90px_72px_72px_110px_120px_minmax(320px,1fr)] border-b border-[#15191c] py-2 text-[7px]"><span className={item.direction === 'BULLISH' ? 'text-[#62d49f]' : item.direction === 'BEARISH' ? 'text-[#ff6262]' : 'text-[#8a949c]'}>{item.direction}</span><span>{item.strength}</span><span>{item.reliability?.toFixed?.(2) ?? item.reliability ?? '—'}</span><span className="text-[#77818a]">{item.sourceType}</span><span className="truncate pr-2 text-[#8c969e]">{item.publisher}</span><span className="text-[#adb5bb]"><b className="font-normal text-[#d0d5d9]">{item.title}</b>{item.summary ? ` · ${item.summary}` : ''}</span></div>)}
      {!items.length && <div className="py-10 text-center text-[7px] uppercase tracking-[0.08em] text-[#4f585f]">No active structured evidence</div>}
    </div>
  </Panel>
);

const Scenario = ({ items, recommendedId }: any) => (
  <div className="grid gap-2 xl:grid-cols-2">
    {items.map((item: any) => <Panel key={item.id} title={`${item.label || item.id}${item.id === recommendedId ? ' / RECOMMENDED' : ''}`}><div className="flex gap-5 text-[7px]"><span className="text-[#77818a]">PROB <b className="font-normal text-[#d2d7db]">{pct(item.probability, 0)}</b></span><span className="text-[#77818a]">CONF <b className="font-normal text-[#d2d7db]">{pct(item.confidence, 0)}</b></span><span className="text-[#77818a]">DIR <b className="font-normal text-[#d2d7db]">{item.direction}</b></span></div><div className="mt-3 text-[8px] leading-5 text-[#aeb5bb]">{item.thesis}</div><List title="TRIGGERS" items={item.triggerConditions || []} /><List title="INVALIDATION" items={item.invalidationConditions || []} /></Panel>)}
    {!items.length && <div className="col-span-full py-10 text-center text-[7px] uppercase tracking-[0.08em] text-[#4f585f]">Scenario set not linked</div>}
  </div>
);

const Council = ({ rankings, lenses, scenarios, row, decision }: any) => {
  const scenarioById = new Map((scenarios || []).map((item: any) => [item.id, item]));
  const recommendedV1 = row?.trace?.v1?.recommendedScenarioId || row?.v1?.scenarioId || rankings?.find?.((item: any) => item.rank === 1)?.scenarioId || null;
  const recommendedV2 = row?.trace?.v2?.recommendedScenarioId || row?.v2?.scenarioId || null;
  const v1Lenses = (lenses || []).filter((item: any) => !recommendedV1 || item.scenarioId === recommendedV1);
  const v2Assessments = row?.trace?.v2?.assessments || [];
  const topV2 = v2Assessments.find((item: any) => item.rank === 1) || null;
  const v2Specialists = (row?.trace?.v2?.specialistReviews || []).filter((item: any) => !recommendedV2 || item.scenarioId === recommendedV2);
  const v1Scenario: any = scenarioById.get(recommendedV1) || null;
  const v2Scenario: any = scenarioById.get(recommendedV2) || null;

  return (
    <div className="grid gap-2 xl:grid-cols-2">
      <Panel title="DECISION CHAIN / AUTHORITATIVE V1">
        <KeyRows rows={[
          ['EVIDENCE', `${row?.evidence?.activeCount ?? decision?.evidenceActiveCount ?? 0} active / ${row?.evidence?.contradictionCount ?? decision?.evidenceContradictionCount ?? 0} contradiction`],
          ['SCENARIO', v1Scenario ? `${v1Scenario.label} · ${v1Scenario.direction} · ${pct(v1Scenario.probability, 0)}` : row?.v1 ? `${row.v1.label} · ${row.v1.direction}` : '—'],
          ['COUNCIL V1', row?.v1 ? `${row.v1.disposition} · conf ${pct(row.v1.confidence, 0)} · score ${pct(row.v1.score, 0)}` : decision?.governance?.intelligenceDisposition || '—'],
          ['RISK', decision?.riskDisposition || '—'],
          ['FINAL', decision?.decision || decision?.action || '—'],
          ['RUN', row?.trace?.councilRunId || decision?.governance?.councilRunId || 'NOT LINKED'],
        ]} />
      </Panel>

      <Panel title="V2 CHALLENGER / NO EXECUTION AUTHORITY">
        <KeyRows rows={[
          ['SCENARIO', v2Scenario ? `${v2Scenario.label} · ${v2Scenario.direction}` : row?.v2 ? `${row.v2.label} · ${row.v2.direction}` : '—'],
          ['DISPOSITION', row?.v2?.disposition || topV2?.disposition || '—'],
          ['SYNTHESIS', topV2 ? pct(topV2.synthesisScore, 0) : row?.v2 ? pct(row.v2.score, 0) : '—'],
          ['DISSENT', topV2 ? pct(topV2.dissentRatio, 0) : '—'],
          ['FALSIFY', topV2 ? pct(topV2.falsificationPressure, 0) : '—'],
          ['AUTHORITY', 'SHADOW / FALSE'],
        ]} />
        {!row?.trace && <div className="mt-2 border-t border-[#1a1f23] pt-2 text-[6.5px] leading-4 text-[#f3b642]">Latest retained comparison predates full Council trace persistence. A new governed cycle is required to populate specialist-level trace.</div>}
      </Panel>

      <Panel title="V1 SCENARIO RANKING">
        <div className="space-y-1.5">
          {(rankings || []).map((item: any) => {
            const scenario: any = scenarioById.get(item.scenarioId);
            return <div key={`${item.rank}-${item.scenarioId}`} className="grid grid-cols-[34px_70px_82px_70px_70px_minmax(0,1fr)] gap-2 border-b border-[#171b1f] pb-1.5 text-[7px]"><span className="text-[#59636b]">#{item.rank}</span><span className="text-[#c9ced2]">{scenario?.label || item.scenarioId}</span><span className={tone(item.disposition)}>{item.disposition}</span><span>{pct(item.consensusScore, 0)}</span><span>{pct(item.confidence, 0)}</span><span className="truncate text-[#77818a]" title={item.dominantChallenge}>{item.dominantChallenge || item.dominantSupport || '—'}</span></div>;
          })}
          {!rankings?.length && <div className="text-[7px] text-[#4f585f]">Council v1 ranking not linked.</div>}
        </div>
      </Panel>

      <Panel title="V1 LENS REVIEWS / RECOMMENDED SCENARIO">
        <div className="space-y-2">
          {v1Lenses.map((item: any, index: number) => <div key={`${item.lensId}-${item.scenarioId}-${index}`} className="border-b border-[#181c20] pb-2"><div className="flex gap-3 text-[7px]"><span className="text-[#f3a312]">{item.lensId}</span><span className={tone(item.stance)}>{item.stance}</span><span className="ml-auto">{pct(item.confidence, 0)}</span></div><div className="mt-1 text-[7px] leading-4 text-[#77818a]">{(item.reasons || []).join(' · ') || 'No reasons persisted.'}</div></div>)}
          {!v1Lenses.length && <div className="text-[7px] text-[#4f585f]">Council v1 lens trace not linked.</div>}
        </div>
      </Panel>

      <Panel title="V2 SPECIALISTS / BLIND FIRST PASS">
        <div className="space-y-2">
          {v2Specialists.map((item: any, index: number) => <div key={`${item.specialistId}-${item.scenarioId}-${index}`} className="border-b border-[#181c20] pb-2"><div className="flex gap-3 text-[7px]"><span className="text-[#f3a312]">{item.specialistId}</span><span className={tone(item.stance)}>{item.stance}</span><span className="text-[#59636b]">BLIND</span><span className="ml-auto">score {pct(item.score, 0)} / conf {pct(item.confidence, 0)}</span></div><div className="mt-1 text-[7px] leading-4 text-[#77818a]">{(item.reasons || []).join(' · ') || 'No reasons persisted.'}</div></div>)}
          {!v2Specialists.length && <div className="text-[7px] text-[#4f585f]">Council v2 specialist trace is not yet persisted for this market.</div>}
        </div>
      </Panel>

      <Panel title="PROSPECTIVE V1 / V2 OUTCOME">
        <KeyRows rows={[
          ['GENERATED', stamp(row?.generatedAt)],
          ['TARGET', stamp(row?.targetTimestamp)],
          ['RESOLVED', stamp(row?.resolvedAt)],
          ['RAW RETURN', signedPct(row?.rawReturn)],
          ['V1 UTILITY', signedPct(row?.v1DirectionalUtility)],
          ['V2 UTILITY', signedPct(row?.v2DirectionalUtility)],
          ['V1 / V2', `${row?.v1Favorable == null ? '—' : row.v1Favorable ? 'FAVORABLE' : 'UNFAVORABLE'} / ${row?.v2Favorable == null ? '—' : row.v2Favorable ? 'FAVORABLE' : 'UNFAVORABLE'}`],
        ]} />
      </Panel>
    </div>
  );
};

const Risk = ({ position, trace }: any) => (
  <div className="grid gap-2 xl:grid-cols-2">
    <Panel title="RISK GATE"><KeyRows rows={[
      ['DISPOSITION', position?.riskDisposition || trace?.riskDisposition || '—'],
      ['STOP', price(position?.stopLossPrice)],
      ['TARGET', price(position?.takeProfitPrice)],
      ['MARKET VALUE', price(position?.marketValue)],
      ['UNREALIZED', position ? `${position.unrealizedPnl >= 0 ? '+' : ''}₩${money.format(position.unrealizedPnl)}` : '—'],
      ['FINAL ACTION', trace?.decision || trace?.action || '—'],
    ]} /></Panel>
    <Panel title="RISK REASONS"><div className="space-y-1.5 text-[7px] leading-4 text-[#8f99a1]">{(trace?.riskReasons || []).map((item: string, index: number) => <div key={`${item}-${index}`}>{item}</div>)}{!(trace?.riskReasons || []).length && <div>No persisted risk rejection reason.</div>}</div></Panel>
  </div>
);

const History = ({ items, latest }: any) => {
  const rows = items?.length ? items : latest ? [latest] : [];
  return (
    <Panel title={items?.length ? 'DECISION HISTORY' : 'LATEST RETAINED DECISION'}>
      <div className="overflow-x-auto">
        <div className="grid min-w-[900px] grid-cols-[110px_86px_86px_70px_70px_90px_minmax(380px,1fr)] border-b border-[#252a2f] pb-1.5 text-[6px] uppercase tracking-[0.08em] text-[#59636b]"><span>TIME</span><span>ACTION</span><span>REGIME</span><span>SCORE</span><span>CONF</span><span>RISK</span><span>REASON</span></div>
        {rows.map((item: any, index: number) => <div key={`${item.timestamp}-${index}`} className="grid min-w-[900px] grid-cols-[110px_86px_86px_70px_70px_90px_minmax(380px,1fr)] border-b border-[#15191c] py-2 text-[7px]"><span className="text-[#68727a]">{stamp(item.timestamp)}</span><span className="text-[#d1d6da]">{item.action || item.decision}</span><span>{item.regime || '—'}</span><span>{item.oracleTradeScore ?? '—'}</span><span>{pct(item.confidence, 0)}</span><span>{item.riskDisposition || '—'}</span><span className="truncate text-[#8f99a1]" title={item.primaryReason}>{item.primaryReason || '—'}</span></div>)}
        {!rows.length && <div className="py-10 text-center text-[7px] uppercase tracking-[0.08em] text-[#4f585f]">No retained decision history</div>}
      </div>
    </Panel>
  );
};

const KeyRows = ({ rows }: { rows: Array<[string, string]> }) => <div className="space-y-1.5">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 border-b border-[#161a1d] pb-1.5 text-[7px]"><span className="text-[#626c74]">{label}</span><span className="break-all text-[#b4bbc1]">{value}</span></div>)}</div>;
const List = ({ title, items }: { title: string; items: string[] }) => <div className="mt-3"><div className="text-[6px] uppercase tracking-[0.08em] text-[#59636b]">{title}</div><div className="mt-1 space-y-1 text-[7px] leading-4 text-[#7f8991]">{items.length ? items.map((item, index) => <div key={`${item}-${index}`}>· {item}</div>) : <div>—</div>}</div></div>;
