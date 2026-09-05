import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  GitCompareArrows,
  Loader2,
  RefreshCw,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db, useAppContext } from '../store';
import { persistCouncilRun } from '../lib/persistCouncilRun';

type ScenarioReview = {
  scenarioId: string;
  stance: 'SUPPORT' | 'CHALLENGE' | 'MIXED' | 'INSUFFICIENT';
  probabilityEstimate: number;
  confidence: number;
  confidenceEffect: 'RAISE' | 'LOWER' | 'UNCHANGED';
  feedback: string;
  watchItems: string[];
  invalidationSignals: string[];
  evidenceIds: string[];
  counterEvidenceIds: string[];
  keyRisks: string[];
};

type LensResult = {
  lensId: string;
  reviews: ScenarioReview[];
};

type Ranking = {
  scenarioId: string;
  rank: number;
  consensusScore: number;
  probabilityEstimate: number;
  confidence: number;
  disposition: 'ADVANCE' | 'MONITOR' | 'CHALLENGE' | 'INSUFFICIENT';
  dominantSupport: string;
  dominantChallenge: string;
  unresolvedUncertainty: string[];
  preservedDissent: string[];
};

type CouncilResult = {
  id?: string;
  success: boolean;
  mode: 'ADVISORY_ONLY';
  executionAuthority: false;
  requesterUid?: string | null;
  model: string;
  startedAt: number;
  finishedAt: number;
  scenarioIds: string[];
  lenses: LensResult[];
  comparison: {
    rankings: Ranking[];
    crossScenarioObservations: string[];
    recommendedFocusScenarioId: string;
    reason: string;
  };
  context?: {
    hypothesisId?: string | null;
    questionId?: string | null;
  };
};

const LENS_LABELS: Record<string, string> = {
  momentum_trend: 'MOMENTUM / TREND',
  mean_reversion: 'MEAN REVERSION',
  event_news: 'EVENT / NEWS',
  macro_cross_asset: 'MACRO / CROSS-ASSET',
  liquidity_execution: 'LIQUIDITY / EXECUTION',
  risk: 'RISK',
};

const pct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(0)}%`;
const when = (timestamp: number | null | undefined) => timestamp
  ? new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp))
  : '—';

const stanceTone = (stance: ScenarioReview['stance']) => {
  if (stance === 'SUPPORT') return 'border-[#72B6A0]/25 text-[#82C0AD]';
  if (stance === 'CHALLENGE') return 'border-[#D66565]/25 text-[#D98787]';
  if (stance === 'MIXED') return 'border-[#C7A96B]/25 text-[#D3B778]';
  return 'border-white/[0.08] text-[#737E88]';
};

const dispositionTone = (disposition: Ranking['disposition']) => {
  if (disposition === 'ADVANCE') return 'text-[#72B6A0]';
  if (disposition === 'CHALLENGE') return 'text-[#D66565]';
  if (disposition === 'MONITOR') return 'text-[#C7A96B]';
  return 'text-[#737E88]';
};

export const CouncilView: React.FC = () => {
  const {
    user,
    signals,
    questions,
    hypotheses,
    scenarios,
    evidence,
    selectedEntity,
    setSelectedEntity,
  } = useAppContext() as any;

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<CouncilResult | null>(null);
  const [history, setHistory] = useState<CouncilResult[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  const caseModel = useMemo(() => {
    const scenarioItems = scenarios || [];
    const hypothesisItems = hypotheses || [];
    let focusHypothesis: any = null;

    if (selectedEntity?.type === 'hypothesis') {
      focusHypothesis = hypothesisItems.find((item: any) => item.id === selectedEntity.id) || null;
    } else if (selectedEntity?.type === 'scenario' || selectedEntity?.type === 'branch') {
      const selectedScenario = scenarioItems.find((item: any) => item.id === selectedEntity.id);
      focusHypothesis = selectedScenario
        ? hypothesisItems.find((item: any) => item.id === selectedScenario.hypothesisId)
        : null;
    }

    if (!focusHypothesis) {
      focusHypothesis = hypothesisItems
        .filter((hypothesis: any) => scenarioItems.filter((scenario: any) => scenario.hypothesisId === hypothesis.id).length >= 2)
        .sort((a: any, b: any) => Number(b.confidence || 0) - Number(a.confidence || 0))[0] || null;
    }

    const linkedScenarios = focusHypothesis
      ? scenarioItems
          .filter((scenario: any) => scenario.hypothesisId === focusHypothesis.id || focusHypothesis.scenarioIds?.includes(scenario.id))
          .slice(0, 6)
      : [];
    const question = focusHypothesis
      ? (questions || []).find((item: any) => item.id === focusHypothesis.questionId || item.hypothesisIds?.includes(focusHypothesis.id))
      : null;
    const linkedEvidence = focusHypothesis
      ? (evidence || []).filter((item: any) => item.linkedHypothesisId === focusHypothesis.id || focusHypothesis.evidenceIds?.includes(item.id))
      : [];
    const linkedSignals = question
      ? (signals || []).filter((item: any) => question.signalIds?.includes(item.id) || item.linkedQuestionIds?.includes(question.id))
      : [];

    return { focusHypothesis, linkedScenarios, question, linkedEvidence, linkedSignals };
  }, [selectedEntity, scenarios, hypotheses, questions, evidence, signals]);

  useEffect(() => {
    if (!selectedScenarioId && caseModel.linkedScenarios.length) {
      setSelectedScenarioId(caseModel.linkedScenarios[0].id);
    } else if (selectedScenarioId && !caseModel.linkedScenarios.some((item: any) => item.id === selectedScenarioId)) {
      setSelectedScenarioId(caseModel.linkedScenarios[0]?.id || null);
    }
  }, [caseModel.linkedScenarios, selectedScenarioId]);

  const loadHistory = async () => {
    if (!user?.uid) return;
    try {
      const snapshot = await getDocs(collection(db, 'users', user.uid, 'councilRuns'));
      const rows = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }) as CouncilResult)
        .filter((item) => item?.comparison && Array.isArray(item?.scenarioIds))
        .sort((a, b) => Number(b.finishedAt || 0) - Number(a.finishedAt || 0))
        .slice(0, 12);
      setHistory(rows);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, [user?.uid]);

  const runCouncil = async () => {
    if (!user || !caseModel.focusHypothesis || caseModel.linkedScenarios.length < 2 || running) return;
    setRunning(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/council-scenarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: caseModel.question?.text || caseModel.focusHypothesis.title,
          timeframe: 'case-defined',
          signals: caseModel.linkedSignals,
          hypotheses: [caseModel.focusHypothesis],
          evidence: caseModel.linkedEvidence,
          scenarios: caseModel.linkedScenarios,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error || `Council failed with HTTP ${response.status}.`);

      const persisted = await persistCouncilRun(user.uid, {
        ...payload,
        context: {
          hypothesisId: caseModel.focusHypothesis.id,
          questionId: caseModel.question?.id || null,
        },
      });
      setActiveResult(persisted as CouncilResult);
      setSelectedScenarioId(payload.comparison?.recommendedFocusScenarioId || caseModel.linkedScenarios[0]?.id || null);
      await loadHistory();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Council run failed.');
    } finally {
      setRunning(false);
    }
  };

  const scenarioById = useMemo(() => new Map(caseModel.linkedScenarios.map((item: any) => [item.id, item])), [caseModel.linkedScenarios]);
  const rankingById = useMemo(() => new Map((activeResult?.comparison?.rankings || []).map((item) => [item.scenarioId, item])), [activeResult]);
  const selectedScenario = selectedScenarioId ? scenarioById.get(selectedScenarioId) : null;
  const selectedRanking = selectedScenarioId ? rankingById.get(selectedScenarioId) : null;

  if (!caseModel.focusHypothesis || caseModel.linkedScenarios.length < 2) {
    return (
      <div className="flex h-full items-center justify-center bg-[#05070A] px-6 text-center text-[#E9EDF1]">
        <div className="max-w-lg border border-dashed border-white/[0.08] p-8">
          <BrainCircuit className="mx-auto h-6 w-6 text-[#59636D]" />
          <div className="mt-4 font-mono text-[8px] uppercase tracking-[0.18em] text-[#59636D]">Council requires competing scenarios</div>
          <p className="mt-2 text-[11px] leading-relaxed text-[#68727C]">Select a Case with at least two scenarios. Council will not fabricate missing branches just to produce a verdict.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-36 pt-6 text-[#E9EDF1] md:px-8 md:pb-24 md:pt-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-4 flex flex-col gap-4 border-b border-white/[0.06] pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.22em] text-[#43D9E6]">
              <BrainCircuit className="h-3.5 w-3.5" /> Multi-scenario Council
            </div>
            <h1 className="text-2xl font-medium tracking-[-0.035em]">Scenario stress review</h1>
            <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-[#71808A]">
              Six specialist lenses review every branch independently, then a meta-adjudicator compares the scenarios while preserving dissent and uncertainty.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <div className="border border-[#C7A96B]/20 bg-[#C7A96B]/[0.025] px-3 py-2 font-mono text-[6px] uppercase tracking-[0.11em] text-[#A88E58]">advisory only · no execution authority</div>
            <button
              onClick={runCouncil}
              disabled={running}
              className="flex h-10 items-center justify-center gap-2 border border-[#43D9E6]/25 bg-[#43D9E6]/[0.045] px-4 font-mono text-[7px] uppercase tracking-[0.14em] text-[#BCEFF3] transition hover:bg-[#43D9E6]/[0.08] disabled:opacity-50"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5" />}
              {running ? 'Council deliberating' : 'Run Council'}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 flex items-start gap-2 border border-[#D66565]/20 bg-[#D66565]/[0.025] p-3 text-[9px] leading-relaxed text-[#D98787]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}

        <section className="mb-4 border border-white/[0.07] bg-[#080C11]">
          <PanelHeader icon={GitCompareArrows} title="Scenario set" detail={`${caseModel.linkedScenarios.length} branches`} />
          <div className="grid gap-px bg-white/[0.04] md:grid-cols-2 xl:grid-cols-3">
            {caseModel.linkedScenarios.map((scenario: any) => {
              const ranking = rankingById.get(scenario.id);
              const active = selectedScenarioId === scenario.id;
              return (
                <button
                  key={scenario.id}
                  onClick={() => {
                    setSelectedScenarioId(scenario.id);
                    setSelectedEntity({ type: 'scenario', id: scenario.id });
                  }}
                  className={`bg-[#080C11] p-4 text-left transition ${active ? 'ring-1 ring-inset ring-[#43D9E6]/30 bg-white/[0.025]' : 'hover:bg-white/[0.018]'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-mono text-[7px] uppercase tracking-[0.12em] text-[#59636D]">{ranking ? `RANK ${ranking.rank}` : 'UNREVIEWED'}</div>
                    <div className="text-lg font-light text-[#D5DCE2]">{Math.round(Number(scenario.probability || 0))}%</div>
                  </div>
                  <div className="mt-2 text-[12px] font-medium leading-snug text-[#C8D0D7]">{scenario.title}</div>
                  <div className="mt-2 line-clamp-2 text-[9px] leading-relaxed text-[#64707A]">{scenario.expectedOutcome || scenario.triggerCondition || 'No outcome statement.'}</div>
                  {ranking && (
                    <div className="mt-3 flex flex-wrap gap-2 font-mono text-[6px] uppercase tracking-[0.09em]">
                      <span className={dispositionTone(ranking.disposition)}>{ranking.disposition}</span>
                      <span className="text-[#59636D]">Council P {pct(ranking.probabilityEstimate)}</span>
                      <span className="text-[#59636D]">CONF {pct(ranking.confidence)}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {activeResult ? (
          <>
            <section className="mb-4 border border-white/[0.07] bg-[#080C11]">
              <PanelHeader icon={Scale} title="Cross-scenario ranking" detail={`${when(activeResult.finishedAt)} · ${activeResult.model}`} />
              <div className="divide-y divide-white/[0.05]">
                {[...(activeResult.comparison.rankings || [])].sort((a, b) => a.rank - b.rank).map((ranking) => {
                  const scenario = scenarioById.get(ranking.scenarioId) as any;
                  return (
                    <button key={ranking.scenarioId} onClick={() => setSelectedScenarioId(ranking.scenarioId)} className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-white/[0.018] md:grid-cols-[48px_minmax(0,1fr)_110px_110px] md:items-center">
                      <div className="text-2xl font-light text-[#AEB7C0]">{ranking.rank}</div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-[#CBD2D9]">{scenario?.title || ranking.scenarioId}</div>
                        <div className="mt-1 line-clamp-2 text-[8px] leading-relaxed text-[#64707A]">{ranking.dominantSupport}</div>
                        <div className="mt-1 line-clamp-1 text-[8px] leading-relaxed text-[#9B6767]">Challenge: {ranking.dominantChallenge}</div>
                      </div>
                      <Metric label="CONSENSUS" value={pct(ranking.consensusScore)} />
                      <div>
                        <div className={`font-mono text-[8px] uppercase tracking-[0.1em] ${dispositionTone(ranking.disposition)}`}>{ranking.disposition}</div>
                        <div className="mt-1 font-mono text-[6px] uppercase tracking-[0.08em] text-[#4F5963]">P {pct(ranking.probabilityEstimate)} · C {pct(ranking.confidence)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-white/[0.05] p-4">
                <div className="font-mono text-[6px] uppercase tracking-[0.14em] text-[#59636D]">META-ADJUDICATOR</div>
                <p className="mt-2 text-[9px] leading-relaxed text-[#7B8791]">{activeResult.comparison.reason}</p>
                {!!activeResult.comparison.crossScenarioObservations?.length && (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {activeResult.comparison.crossScenarioObservations.map((item, index) => (
                      <div key={`${item}-${index}`}>
                        <Note icon={Eye} text={item} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_340px]">
              <section className="border border-white/[0.07] bg-[#080C11]">
                <PanelHeader icon={BrainCircuit} title="Lens feedback" detail={selectedScenario?.title || selectedScenarioId || 'Select scenario'} />
                <div className="grid gap-px bg-white/[0.04] md:grid-cols-2">
                  {activeResult.lenses.map((lens) => {
                    const review = lens.reviews.find((item) => item.scenarioId === selectedScenarioId);
                    if (!review) return null;
                    return (
                      <article key={lens.lensId} className="bg-[#080C11] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-[7px] uppercase tracking-[0.13em] text-[#AAB3BC]">{LENS_LABELS[lens.lensId] || lens.lensId}</span>
                          <span className={`border px-1.5 py-1 font-mono text-[6px] uppercase tracking-[0.09em] ${stanceTone(review.stance)}`}>{review.stance}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-px bg-white/[0.04]">
                          <Metric label="P EST." value={pct(review.probabilityEstimate)} />
                          <Metric label="CONF." value={pct(review.confidence)} />
                          <Metric label="EFFECT" value={review.confidenceEffect} />
                        </div>
                        <p className="mt-3 text-[9px] leading-relaxed text-[#7E8993]">{review.feedback}</p>
                        <ListBlock label="WATCH" items={review.watchItems} />
                        <ListBlock label="INVALIDATION" items={review.invalidationSignals} danger />
                        <ListBlock label="RISKS" items={review.keyRisks} danger />
                        <div className="mt-3 font-mono text-[6px] uppercase tracking-[0.08em] text-[#46515B]">EVID {review.evidenceIds.length} · COUNTER {review.counterEvidenceIds.length}</div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <aside className="space-y-4">
                <section className="border border-white/[0.07] bg-[#080C11]">
                  <PanelHeader icon={ShieldAlert} title="Selected scenario" detail={selectedRanking?.disposition || '—'} />
                  <div className="p-4">
                    <div className="text-[12px] font-medium leading-snug text-[#CDD4DA]">{selectedScenario?.title || 'No scenario selected'}</div>
                    {selectedRanking && (
                      <>
                        <div className="mt-3 grid grid-cols-2 gap-px bg-white/[0.04]">
                          <Metric label="COUNCIL P" value={pct(selectedRanking.probabilityEstimate)} />
                          <Metric label="CONFIDENCE" value={pct(selectedRanking.confidence)} />
                        </div>
                        <ListBlock label="UNRESOLVED" items={selectedRanking.unresolvedUncertainty} />
                        <ListBlock label="PRESERVED DISSENT" items={selectedRanking.preservedDissent} danger />
                      </>
                    )}
                  </div>
                </section>

                <section className="border border-white/[0.07] bg-[#080C11]">
                  <PanelHeader icon={Clock3} title="Council history" detail={`${history.length} saved`} />
                  <div className="max-h-[360px] divide-y divide-white/[0.05] overflow-y-auto">
                    {history.map((run) => (
                      <button key={run.id || run.startedAt} onClick={() => {
                        setActiveResult(run);
                        setSelectedScenarioId(run.comparison?.recommendedFocusScenarioId || run.scenarioIds?.[0] || null);
                      }} className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-white/[0.018]">
                        <div className="min-w-0">
                          <div className="font-mono text-[7px] text-[#AAB3BC]">{when(run.finishedAt)}</div>
                          <div className="mt-1 truncate font-mono text-[6px] uppercase tracking-[0.08em] text-[#4F5963]">{run.scenarioIds?.length || 0} scenarios · {run.model}</div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#46515B]" />
                      </button>
                    ))}
                    {!history.length && <div className="p-4 text-[8px] text-[#4F5963]">No saved Council runs yet.</div>}
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : (
          <section className="border border-dashed border-white/[0.08] px-5 py-14 text-center">
            <RefreshCw className="mx-auto h-5 w-5 text-[#4F5963]" />
            <div className="mt-3 font-mono text-[8px] uppercase tracking-[0.16em] text-[#59636D]">No Council run loaded</div>
            <p className="mx-auto mt-2 max-w-xl text-[10px] leading-relaxed text-[#58636D]">Run Council manually to obtain source-constrained feedback across all current scenarios. Nothing is synthesized locally before the run completes.</p>
          </section>
        )}
      </div>
    </div>
  );
};

const PanelHeader = ({ icon: Icon, title, detail }: { icon: React.ElementType; title: string; detail: string }) => (
  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
    <div className="flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.14em] text-[#7C8791]"><Icon className="h-3.5 w-3.5 text-[#43D9E6]" />{title}</div>
    <div className="max-w-[55%] truncate font-mono text-[6px] uppercase tracking-[0.09em] text-[#4F5963]">{detail}</div>
  </div>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-[#06090D] p-2.5">
    <div className="font-mono text-[6px] uppercase tracking-[0.09em] text-[#4F5963]">{label}</div>
    <div className="mt-1 font-mono text-[8px] text-[#AAB3BC]">{value}</div>
  </div>
);

const ListBlock = ({ label, items, danger = false }: { label: string; items: string[]; danger?: boolean }) => {
  if (!items?.length) return null;
  return (
    <div className="mt-3 border-t border-white/[0.05] pt-2.5">
      <div className={`font-mono text-[6px] uppercase tracking-[0.11em] ${danger ? 'text-[#A96565]' : 'text-[#59636D]'}`}>{label}</div>
      <div className="mt-1.5 space-y-1">
        {items.slice(0, 4).map((item, index) => <div key={`${item}-${index}`} className="text-[8px] leading-relaxed text-[#68747E]">• {item}</div>)}
      </div>
    </div>
  );
};

const Note = ({ icon: Icon, text }: { icon: React.ElementType; text: string }) => (
  <div className="flex items-start gap-2 border border-white/[0.05] bg-[#06090D] p-3 text-[8px] leading-relaxed text-[#68747E]">
    <Icon className="mt-0.5 h-3 w-3 shrink-0 text-[#59636D]" /> {text}
  </div>
);
