import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type TradingStatus = any;
type TradeCase = any;
type Tab = 'OVERVIEW' | 'EVIDENCE' | 'SCENARIO' | 'COUNCIL' | 'RISK' | 'HISTORY';

const money = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const pct = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;
const price = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `₩${money.format(value)}`;
const stamp = (value: number | null | undefined) => value ? new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';

export const TerminalPositionsView: React.FC = () => {
  const [status, setStatus] = useState<TradingStatus | null>(null);
  const [cases, setCases] = useState<TradeCase[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [statusResponse, caseResponse] = await Promise.all([
        fetch('/api/trading-status', { cache: 'no-store' }),
        fetch('/api/trade-cases', { cache: 'no-store' }),
      ]);
      const [nextStatus, nextCases] = await Promise.all([statusResponse.json(), caseResponse.json()]);
      setStatus(nextStatus);
      setCases(Array.isArray(nextCases?.cases) ? nextCases.cases : []);
      setError(statusResponse.ok && caseResponse.ok ? null : nextStatus?.error || nextCases?.error || 'Position data request failed.');
      const firstMarket = nextStatus?.positionEvidence?.[0]?.market || nextCases?.cases?.[0]?.market || null;
      setSelectedMarket((current) => current || firstMarket);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Position data request failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const positions = status?.positionEvidence || [];
  const markets = useMemo(() => Array.from(new Set([
    ...positions.map((item: any) => item.market),
    ...cases.map((item: any) => item.market),
  ])).filter(Boolean) as string[], [cases, positions]);

  const selectedPosition = positions.find((item: any) => item.market === selectedMarket) || null;
  const selectedCase = cases.find((item: any) => item.market === selectedMarket && item.status === 'OPEN')
    || cases.find((item: any) => item.market === selectedMarket)
    || null;
  const snapshot = selectedCase?.governanceSnapshot || null;
  const scenarios = snapshot?.scenarios || [];
  const recommendedScenario = scenarios.find((item: any) => item.id === snapshot?.recommendedScenarioId) || null;
  const council = snapshot?.councilRankings || [];
  const history = selectedCase?.decisionHistory || [];

  return (
    <div className="terminal-screen h-full overflow-hidden bg-[#030405] text-[#d9dde1]">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-8 shrink-0 items-center gap-3 border-b border-[#24282c] bg-[#070809] px-3 font-mono text-[7px] uppercase tracking-[0.08em]">
          <span className="text-[#f3a312]">POSITIONS</span>
          <span className="text-[#5c666f]">OPEN <b className="font-normal text-[#c4cbd1]">{positions.length}</b></span>
          <span className="text-[#5c666f]">CASES <b className="font-normal text-[#c4cbd1]">{cases.length}</b></span>
          <span className="text-[#5c666f]">EQUITY <b className="font-normal text-[#c4cbd1]">{status?.portfolio?.equity == null ? '—' : `₩${money.format(status.portfolio.equity)}`}</b></span>
          {error && <span className="truncate text-[#ff6262]">{error}</span>}
          <button onClick={() => { setLoading(true); void load(); }} className="terminal-action ml-auto"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />REFRESH</button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-[#24282c] xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-auto bg-[#050607]">
            <div className="sticky top-0 z-10 grid grid-cols-[90px_78px_78px_68px_1fr] border-b border-[#282d32] bg-[#0a0b0c] px-2 py-1.5 font-mono text-[6px] uppercase tracking-[0.08em] text-[#59636b]">
              <span>MARKET</span><span>MARK</span><span>P&L</span><span>EVID</span><span>STATE</span>
            </div>
            {markets.map((market) => {
              const position = positions.find((item: any) => item.market === market);
              const caseItem = cases.find((item: any) => item.market === market);
              const active = market === selectedMarket;
              return (
                <button key={market} onClick={() => { setSelectedMarket(market); setTab('OVERVIEW'); }} className={`grid w-full grid-cols-[90px_78px_78px_68px_1fr] border-b border-[#15191c] px-2 py-2 text-left font-mono text-[7px] ${active ? 'bg-[#101113]' : 'bg-[#050607] hover:bg-[#0a0c0e]'}`}>
                  <span className={active ? 'font-semibold text-[#f3a312]' : 'text-[#d1d6da]'}>{market}</span>
                  <span className="tabular-nums text-[#a2abb3]">{price(position?.markPrice)}</span>
                  <span className={`tabular-nums ${(position?.unrealizedPnl || 0) < 0 ? 'text-[#ff6a6a]' : (position?.unrealizedPnl || 0) > 0 ? 'text-[#62d49f]' : 'text-[#77818a]'}`}>{position ? `${position.unrealizedPnl >= 0 ? '+' : ''}₩${money.format(position.unrealizedPnl)}` : '—'}</span>
                  <span className={position?.evidenceState === 'EVIDENCE_SUPPORTED' ? 'text-[#62d49f]' : 'text-[#f3b642]'}>{position?.externalEvidenceActive ?? 0}</span>
                  <span className="truncate text-[#77818a]">{position?.evidenceState || caseItem?.status || 'RESEARCH'}</span>
                </button>
              );
            })}
            {!markets.length && <div className="px-3 py-10 text-center font-mono text-[7px] uppercase tracking-[0.08em] text-[#4f585f]">No position or trade-case data</div>}
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
                    <HeaderMetric label="MARK" value={price(selectedPosition?.markPrice)} />
                    <HeaderMetric label="ENTRY" value={price(selectedPosition?.entryPrice)} />
                    <HeaderMetric label="UNREAL P&L" value={selectedPosition ? `${selectedPosition.unrealizedPnl >= 0 ? '+' : ''}₩${money.format(selectedPosition.unrealizedPnl)}` : '—'} warn={(selectedPosition?.unrealizedPnl || 0) < 0} />
                    <HeaderMetric label="STOP" value={price(selectedPosition?.stopLossPrice)} />
                    <HeaderMetric label="TARGET" value={price(selectedPosition?.takeProfitPrice)} />
                    <HeaderMetric label="SCORE" value={selectedPosition?.oracleTradeScore == null ? '—' : String(selectedPosition.oracleTradeScore)} />
                    <HeaderMetric label="CONF" value={pct(selectedPosition?.confidence, 0)} />
                    <HeaderMetric label="RISK" value={selectedPosition?.riskDisposition || selectedCase?.latestDecision?.riskDisposition || '—'} warn={(selectedPosition?.riskDisposition || selectedCase?.latestDecision?.riskDisposition) === 'REJECT'} />
                    <HeaderMetric label="EVIDENCE" value={`${selectedPosition?.externalEvidenceActive ?? 0}/${selectedPosition?.externalEvidenceContradictions ?? 0}`} warn={selectedPosition?.evidenceState !== 'EVIDENCE_SUPPORTED'} />
                  </div>
                  <div className="flex h-8 overflow-x-auto border-t border-[#1c2024] px-2 font-mono text-[6.5px] uppercase tracking-[0.08em]">
                    {(['OVERVIEW', 'EVIDENCE', 'SCENARIO', 'COUNCIL', 'RISK', 'HISTORY'] as Tab[]).map((item) => (
                      <button key={item} onClick={() => setTab(item)} className={`border-b px-3 ${tab === item ? 'border-[#f3a312] text-[#f3a312]' : 'border-transparent text-[#657079] hover:text-[#aab2b8]'}`}>{item}</button>
                    ))}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-2.5 font-mono">
                  {tab === 'OVERVIEW' && <Overview position={selectedPosition} tradeCase={selectedCase} recommended={recommendedScenario} />}
                  {tab === 'EVIDENCE' && <Evidence items={selectedPosition?.evidenceItems || []} state={selectedPosition?.evidenceState} />}
                  {tab === 'SCENARIO' && <Scenario items={scenarios} recommendedId={snapshot?.recommendedScenarioId} />}
                  {tab === 'COUNCIL' && <Council rankings={council} lenses={snapshot?.lensReviews || []} />}
                  {tab === 'RISK' && <Risk position={selectedPosition} trace={selectedCase?.latestDecision || selectedCase?.entry?.trace} />}
                  {tab === 'HISTORY' && <History items={history} />}
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

const Overview = ({ position, tradeCase, recommended }: any) => (
  <div className="grid gap-2 xl:grid-cols-2">
    <Panel title="POSITION STATE">
      <KeyRows rows={[
        ['STATUS', position ? 'OPEN' : tradeCase?.status || '—'],
        ['ROUTE', position?.router || tradeCase?.latestDecision?.strategyDisposition || '—'],
        ['REGIME', position?.regime || tradeCase?.latestDecision?.regime || '—'],
        ['EVIDENCE', position?.evidenceState || '—'],
        ['CASE', tradeCase?.id || 'NOT LINKED'],
        ['OPENED', stamp(position?.openedAt || tradeCase?.openedAt)],
      ]} />
    </Panel>
    <Panel title="DECISION / THESIS">
      <div className="text-[8px] leading-5 text-[#aeb5bb]">{position?.primaryReason || tradeCase?.latestDecision?.primaryReason || 'No persisted decision explanation.'}</div>
      <div className="mt-3 border-t border-[#1b2024] pt-2 text-[7px] text-[#77818a]">Recommended scenario: <span className="text-[#c5cbd0]">{recommended?.label || 'NOT LINKED'}</span></div>
      <div className="mt-1 text-[7px] text-[#77818a]">Scenario thesis: <span className="text-[#9ca5ad]">{recommended?.thesis || '—'}</span></div>
    </Panel>
    <Panel title="EXECUTION">
      <KeyRows rows={[
        ['REFERENCE', price(tradeCase?.entry?.referencePrice)],
        ['FILL', price(tradeCase?.entry?.fillPrice)],
        ['NOTIONAL', price(tradeCase?.entry?.notional)],
        ['SLIPPAGE', tradeCase?.entry?.slippageBps == null ? '—' : `${tradeCase.entry.slippageBps.toFixed(1)} bps`],
        ['VERSION', tradeCase?.entry?.strategyVersion || '—'],
        ['AUDIT', tradeCase?.entry?.trace?.auditCompleteness ? `${tradeCase.entry.trace.auditCompleteness.score}% ${tradeCase.entry.trace.auditCompleteness.grade}` : '—'],
      ]} />
    </Panel>
    <Panel title="LINKAGE">
      <KeyRows rows={[
        ['INTELLIGENCE', tradeCase?.intelligencePackageId || 'NOT LINKED'],
        ['SCENARIO SET', tradeCase?.scenarioSetId || 'NOT LINKED'],
        ['COUNCIL RUN', tradeCase?.councilRunId || 'NOT LINKED'],
        ['FINAL DECISION', tradeCase?.finalDecisionId || 'NOT LINKED'],
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

const Council = ({ rankings, lenses }: any) => (
  <div className="grid gap-2 xl:grid-cols-2">
    <Panel title="SCENARIO RANKING"><KeyRows rows={rankings.map((item: any) => [`#${item.rank} ${item.scenarioId}`, `${item.disposition} · score ${item.consensusScore ?? '—'} · conf ${pct(item.confidence, 0)}`])} /></Panel>
    <Panel title="LENS REVIEWS"><div className="space-y-2">{lenses.map((item: any, index: number) => <div key={`${item.lensId}-${item.scenarioId}-${index}`} className="border-b border-[#181c20] pb-2"><div className="flex gap-3 text-[7px]"><span className="text-[#f3a312]">{item.lensId}</span><span>{item.scenarioId}</span><span className="text-[#8e989f]">{item.stance}</span><span className="ml-auto">{pct(item.confidence, 0)}</span></div><div className="mt-1 text-[7px] leading-4 text-[#77818a]">{(item.reasons || []).join(' · ') || 'No reasons persisted.'}</div></div>)}{!lenses.length && <div className="text-[7px] text-[#4f585f]">Council not linked.</div>}</div></Panel>
  </div>
);

const Risk = ({ position, trace }: any) => (
  <div className="grid gap-2 xl:grid-cols-2">
    <Panel title="RISK GATE"><KeyRows rows={[
      ['DISPOSITION', position?.riskDisposition || trace?.riskDisposition || '—'],
      ['STOP', price(position?.stopLossPrice)],
      ['TARGET', price(position?.takeProfitPrice)],
      ['MARKET VALUE', price(position?.marketValue)],
      ['UNREALIZED', position ? `${position.unrealizedPnl >= 0 ? '+' : ''}₩${money.format(position.unrealizedPnl)}` : '—'],
      ['EVIDENCE STATE', position?.evidenceState || '—'],
    ]} /></Panel>
    <Panel title="RISK REASONS"><div className="space-y-1.5 text-[7px] leading-4 text-[#8f99a1]">{(trace?.riskReasons || []).map((item: string, index: number) => <div key={`${item}-${index}`}>{item}</div>)}{!(trace?.riskReasons || []).length && <div>No persisted risk rejection reason.</div>}</div></Panel>
  </div>
);

const History = ({ items }: any) => (
  <Panel title="DECISION HISTORY">
    <div className="overflow-x-auto">
      <div className="grid min-w-[900px] grid-cols-[110px_86px_86px_70px_70px_90px_minmax(380px,1fr)] border-b border-[#252a2f] pb-1.5 text-[6px] uppercase tracking-[0.08em] text-[#59636b]"><span>TIME</span><span>ACTION</span><span>REGIME</span><span>SCORE</span><span>CONF</span><span>RISK</span><span>REASON</span></div>
      {items.map((item: any, index: number) => <div key={`${item.timestamp}-${index}`} className="grid min-w-[900px] grid-cols-[110px_86px_86px_70px_70px_90px_minmax(380px,1fr)] border-b border-[#15191c] py-2 text-[7px]"><span className="text-[#68727a]">{stamp(item.timestamp)}</span><span className="text-[#d1d6da]">{item.action}</span><span>{item.regime || '—'}</span><span>{item.oracleTradeScore ?? '—'}</span><span>{pct(item.confidence, 0)}</span><span>{item.riskDisposition || '—'}</span><span className="truncate text-[#8f99a1]" title={item.primaryReason}>{item.primaryReason || '—'}</span></div>)}
      {!items.length && <div className="py-10 text-center text-[7px] uppercase tracking-[0.08em] text-[#4f585f]">No retained decision history</div>}
    </div>
  </Panel>
);

const KeyRows = ({ rows }: { rows: Array<[string, string]> }) => <div className="space-y-1.5">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 border-b border-[#161a1d] pb-1.5 text-[7px]"><span className="text-[#626c74]">{label}</span><span className="break-all text-[#b4bbc1]">{value}</span></div>)}</div>;
const List = ({ title, items }: { title: string; items: string[] }) => <div className="mt-3"><div className="text-[6px] uppercase tracking-[0.08em] text-[#59636b]">{title}</div><div className="mt-1 space-y-1 text-[7px] leading-4 text-[#7f8991]">{items.length ? items.map((item, index) => <div key={`${item}-${index}`}>· {item}</div>) : <div>—</div>}</div></div>;
