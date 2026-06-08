import React, { useState, useEffect } from 'react';
import { useAppContext } from '../store';
import { X, ExternalLink, ShieldCheck, Zap, AlertTriangle, Network, Activity, Clock, Database, ChevronUp, ChevronDown, FileText, BarChart2, Radio, ArrowRight, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip, YAxis, BarChart, Bar, Cell } from 'recharts';

export const DetailBottomSheet: React.FC = () => {
  const { selectedEntity } = useAppContext() as any;
  if (!selectedEntity) return null;
  return <DetailBottomSheetContent />;
};

const DetailBottomSheetContent: React.FC = () => {
  const { selectedEntity, setSelectedEntity, sources, signals, questions, hypotheses, scenarios, setCurrentView, deleteCascade, addNotification, activeCase, activeCaseEvidenceItems, activeCaseEvidenceLedgerSummary, activeCaseEvidenceTasks, activeCaseEvidenceSummary, isNodeLinkedToActiveCase } = useAppContext() as any;
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteStatus, setDeleteStatus] = useState("");
  const [briefingLevel, setBriefingLevel] = useState<'1'|'3'|'10'>('3');
  const [showAllRelated, setShowAllRelated] = useState(false);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [briefingProgress, setBriefingProgress] = useState(0);
  const [aiBriefingText, setAiBriefingText] = useState<Record<string, string>>({});

  const generateAIBriefing = async (lines: '1'|'3'|'10') => {
      let baseText = entity?.summary || entity?.description || entity?.text || entity?.expectedOutcome || entity?.title || '';
      
      if (tracePathNodes && tracePathNodes.length > 0) {
          const contextText = tracePathNodes.filter((n: any) => n.data.id !== entity?.id).map((n: any) => {
              return `[${n.type.toUpperCase()}] ${n.data.title || ''}: ${n.data.summary || n.data.description || n.data.text || n.data.expectedOutcome || ''}`;
          });
          if (contextText.length > 0) {
              baseText += `\n\n--- RELATED PIPELINE CONTEXT ---\n` + contextText.join("\n");
          }
      }

      if (!baseText || !baseText.trim()) return;
      
      setBriefingLevel(lines);
      setIsGeneratingBriefing(true);
      setBriefingProgress(0);
      
      const interval = setInterval(() => {
          setBriefingProgress(prev => {
              if (prev >= 95) return prev;
              return prev + Math.floor(Math.random() * 10) + 5;
          });
      }, 150);

      try {
          const resp = await fetch('/api/briefing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: baseText, lines: parseInt(lines) })
          });
          const data = await resp.json();
          if (data.success && data.text) {
              setAiBriefingText(prev => ({ ...prev, [`${entity.id}_${lines}`]: data.text }));
          } else if (data.errorCode === 'MISSING_GEMINI_API_KEY') {
              addNotification(data.message || 'Gemini API key is not configured.', 'warning');
          }
      } catch (err) {
          console.error("AI briefing failed", err);
      } finally {
          clearInterval(interval);
          setBriefingProgress(100);
          setTimeout(() => setIsGeneratingBriefing(false), 500);
      }
  };

  const getEntityData = () => {
    let collection: any[] = [];
    if (selectedEntity.type === 'source') collection = sources;
    else if (selectedEntity.type === 'signal') collection = signals;
    else if (selectedEntity.type === 'question') collection = questions;
    else if (selectedEntity.type === 'hypothesis') collection = hypotheses;
    else if (selectedEntity.type === 'branch' || selectedEntity.type === 'scenario') collection = scenarios;
    return collection.find(item => item.id === selectedEntity.id) || null;
  };

  const entity = getEntityData();

  const getDirectlyRelatedItems = (ent: any, type: string) => {
     if (!ent) return [];
     let related: any[] = [];
     
     if (type === 'source') {
         related = signals.filter((x: any) => x.sourceIds?.includes(ent.id)).map((x: any) => ({ type: 'signal', data: x }));
     } else if (type === 'signal') {
         const parents = sources.filter((x: any) => ent.sourceIds?.includes(x.id)).map((x: any) => ({ type: 'source', data: x }));
         const children = questions.filter((x: any) => x.signalIds?.includes(ent.id)).map((x: any) => ({ type: 'question', data: x }));
         related = [...parents, ...children];
     } else if (type === 'question') {
         const parents = signals.filter((x: any) => ent.signalIds?.includes(x.id)).map((x: any) => ({ type: 'signal', data: x }));
         const children = hypotheses.filter((x: any) => x.questionId === ent.id).map((x: any) => ({ type: 'hypothesis', data: x }));
         related = [...parents, ...children];
     } else if (type === 'hypothesis') {
         const parents = questions.filter((x: any) => x.id === ent.questionId).map((x: any) => ({ type: 'question', data: x }));
         const children = scenarios.filter((x: any) => x.hypothesisId === ent.id).map((x: any) => ({ type: 'scenario', data: x }));
         related = [...parents, ...children];
     } else if (type === 'scenario') {
         related = hypotheses.filter((x: any) => x.id === ent.hypothesisId).map((x: any) => ({ type: 'hypothesis', data: x }));
     }
     return related;
  };

  const directlyRelatedItemsResult = React.useMemo(() => getDirectlyRelatedItems(entity, selectedEntity?.type), [entity, selectedEntity?.type, sources, signals, questions, hypotheses, scenarios]);
  
  const finalDisplayedRelatedItems = showAllRelated ? directlyRelatedItemsResult : directlyRelatedItemsResult.slice(0, 5);

  // Optional: keep it expanded if it was already, else it starts small
  useEffect(() => {
    // We do not auto expand. It defaults to isExpanded = false.
  }, [selectedEntity?.id]);

  const tracePathNodes = React.useMemo(() => {
     if (!entity) return [];
     let nodeSource = null;
     let nodeSignal = null;
     let nodeQuestion = null;
     let nodeHypothesis = null;
     let nodeScenario = null;

     let s = entity;
     let type = selectedEntity?.type;

     if (type === 'source') {
        nodeSource = s;
        nodeSignal = signals.find((x: any) => x.sourceIds?.includes(s.id));
        if (nodeSignal) nodeQuestion = questions.find((x: any) => x.signalIds?.includes(nodeSignal.id));
        if (nodeQuestion) nodeHypothesis = hypotheses.find((x: any) => x.questionId === nodeQuestion.id);
        if (nodeHypothesis) nodeScenario = scenarios.find((x: any) => x.hypothesisId === nodeHypothesis.id);
     } else if (type === 'signal') {
        nodeSignal = s;
        nodeSource = sources.find((x: any) => s.sourceIds?.includes(x.id));
        nodeQuestion = questions.find((x: any) => x.signalIds?.includes(s.id));
        if (nodeQuestion) nodeHypothesis = hypotheses.find((x: any) => x.questionId === nodeQuestion.id);
        if (nodeHypothesis) nodeScenario = scenarios.find((x: any) => x.hypothesisId === nodeHypothesis.id);
     } else if (type === 'question') {
        nodeQuestion = s;
        nodeSignal = signals.find((x: any) => s.signalIds?.includes(x.id));
        if (nodeSignal) nodeSource = sources.find((x: any) => nodeSignal.sourceIds?.includes(x.id));
        nodeHypothesis = hypotheses.find((x: any) => x.questionId === s.id);
        if (nodeHypothesis) nodeScenario = scenarios.find((x: any) => x.hypothesisId === nodeHypothesis.id);
     } else if (type === 'hypothesis') {
        nodeHypothesis = s;
        nodeQuestion = questions.find((x: any) => x.id === s.questionId);
        if (nodeQuestion) {
            nodeSignal = signals.find((x: any) => nodeQuestion.signalIds?.includes(x.id));
            if (nodeSignal) nodeSource = sources.find((x: any) => nodeSignal.sourceIds?.includes(x.id));
        }
        nodeScenario = scenarios.find((x: any) => x.hypothesisId === s.id);
     } else if (type === 'scenario') {
        nodeScenario = s;
        nodeHypothesis = hypotheses.find((x: any) => x.id === s.hypothesisId);
        if (nodeHypothesis) {
            nodeQuestion = questions.find((x: any) => x.id === nodeHypothesis.questionId);
            if (nodeQuestion) {
                 nodeSignal = signals.find((x: any) => nodeQuestion.signalIds?.includes(x.id));
                 if (nodeSignal) nodeSource = sources.find((x: any) => nodeSignal.sourceIds?.includes(x.id));
            }
        }
     }

     return [
         nodeSource && { type: 'source', data: nodeSource },
         nodeSignal && { type: 'signal', data: nodeSignal },
         nodeQuestion && { type: 'question', data: nodeQuestion },
         nodeHypothesis && { type: 'hypothesis', data: nodeHypothesis },
         nodeScenario && { type: 'scenario', data: nodeScenario }
     ].filter(x => x && x.data);
  }, [entity, selectedEntity?.type, sources, signals, questions, hypotheses, scenarios]);

  const closePanel = () => {
    setSelectedEntity(null);
    setIsExpanded(false);
  };

  if (!entity) return null;

  const getHash = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
      return Math.abs(hash);
  };

  const probability = entity.probability !== undefined ? entity.probability : 
                      (entity.confidence !== undefined ? entity.confidence : (getHash(entity.id + 'prob') % 100));
                      
  const impact = entity.impactScore !== undefined ? entity.impactScore : 
                 (entity.impact !== undefined ? entity.impact : (getHash(entity.id + 'imp') % 100));
                 
  const reliability = entity.reliability || entity.reliabilityScore || (getHash(entity.id + 'rel') % 100);

  // Generate generic charts data based on id but constrained by real metric
  const sparklineData = Array.from({ length: 15 }, (_, i) => {
      // Create a smooth pseudo-random walk that ends near the actual probability/reliability
      const progress = i / 14;
      const startVal = probability * 0.4;
      const targetVal = probability;
      const noise = (Math.sin(i * 0.5 + entity.id.length) * 15) * (1 - progress); 
      const currentVal = startVal + (targetVal - startVal) * progress + noise;
      return { time: i, value: Math.max(0, Math.min(100, currentVal)) };
  });
  
  const barData = [
    { name: 'Conf', value: Number(reliability), color: '#06b6d4' },
    { name: 'Prob', value: Number(probability), color: '#f59e0b' },
    { name: 'Imp',  value: Number(impact), color: '#ef4444' }
  ];

  const ledgerPreviewRows = React.useMemo(() => {
    const evidenceRows = (activeCaseEvidenceItems || []).slice(0, 5).map((item: any) => {
      const ev = item.evidence || {};
      const isOpposing = ev.contradictsThesis || ev.evidenceType === 'contradicting' || ev.evidenceType === 'opposing';
      const isSupporting = ev.supportsThesis || ev.evidenceType === 'supporting';
      return {
        id: ev.id,
        title: ev.title || ev.evidenceType || 'Evidence record',
        summary: ev.summary || 'No summary available.',
        badge: isOpposing ? 'OPPOSE' : isSupporting ? 'SUPPORT' : 'NEUTRAL',
        badgeClass: isOpposing ? 'border-red-500/40 text-red-400 bg-red-950/20' : isSupporting ? 'border-cyan-500/40 text-cyan-300 bg-cyan-950/20' : 'border-white/10 text-gray-400 bg-white/[0.03]',
        confidence: ev.confidence,
        credibility: ev.credibilityScore ?? ev.reliability,
        linkedEntityType: item.linkedEntityType,
        linkMode: item.linkMode,
        isTaskRecord: false,
      };
    });

    if (evidenceRows.length > 0) return evidenceRows;

    return (activeCaseEvidenceTasks || []).slice(0, 5).map((task: any) => ({
      id: task.id,
      title: task.label || task.type,
      summary: task.resultSummary || task.errorMessage || 'Evidence task status pending.',
      badge: 'TASK',
      badgeClass: task.status === 'failed' ? 'border-red-500/40 text-red-400 bg-red-950/20' : task.status === 'completed' ? 'border-cyan-500/40 text-cyan-300 bg-cyan-950/20' : 'border-white/10 text-gray-500 bg-white/[0.03]',
      confidence: undefined,
      credibility: undefined,
      linkedEntityType: 'task',
      linkMode: 'provisional',
      isTaskRecord: true,
      status: task.status,
    }));
  }, [activeCaseEvidenceItems, activeCaseEvidenceTasks]);

  const evidenceGatheringMessage = React.useMemo(() => {
    if (!activeCase) return '';
    if ((activeCaseEvidenceSummary?.failedTasks || 0) > 0) return 'Some evidence tasks failed. Ledger confidence may be limited.';
    if ((activeCaseEvidenceSummary?.runningTasks || 0) > 0) return 'Evidence Gathering in progress. Ledger may update.';
    if (activeCase.status === 'evidence_updated') return 'Evidence updated for active case.';
    return 'Evidence Gathering is still preparing the ledger.';
  }, [activeCase, activeCaseEvidenceSummary]);


  const caseLinkedNodeCount = activeCase
    ? (activeCase.linkedSourceIds?.length || 0) +
      (activeCase.linkedSignalIds?.length || 0) +
      (activeCase.linkedQuestionIds?.length || 0) +
      (activeCase.linkedHypothesisIds?.length || 0) +
      (activeCase.linkedScenarioIds?.length || 0) +
      (activeCase.linkedReportIds?.length || 0)
    : 0;

  const selectedNodeLinkedToCase = activeCase
    ? Boolean(isNodeLinkedToActiveCase?.(selectedEntity.type, selectedEntity.id))
    : false;

  const selectedNodeTypeLabel = selectedEntity.type === 'branch' ? 'scenario' : selectedEntity.type;

  const sourceTraceBlocks = [
    { key: 'source', label: 'Source', count: activeCase?.linkedSourceIds?.length || 0 },
    { key: 'signal', label: 'Signal', count: activeCase?.linkedSignalIds?.length || 0 },
    { key: 'question', label: 'Question', count: activeCase?.linkedQuestionIds?.length || 0 },
    { key: 'hypothesis', label: 'Hypothesis', count: activeCase?.linkedHypothesisIds?.length || 0 },
    { key: 'scenario', label: 'Scenario', count: activeCase?.linkedScenarioIds?.length || 0 },
    { key: 'report', label: 'Report', count: activeCase?.linkedReportIds?.length || 0 },
  ];

  const getIcon = () => {
    if (selectedEntity.type === 'source') return <Database className="w-5 h-5 text-gray-400" />;
    if (selectedEntity.type === 'signal') return <Activity className="w-5 h-5 text-cyan-400" />;
    if (selectedEntity.type === 'hypothesis' || selectedEntity.type === 'question') return <Network className="w-5 h-5 text-indigo-400" />;
    return <AlertTriangle className="w-5 h-5 text-red-500" />;
  };

  const getColorClass = () => {
    if (selectedEntity.type === 'source') return 'text-gray-300 border-gray-500/50';
    if (selectedEntity.type === 'signal') return 'text-cyan-400 border-cyan-500/50';
    if (selectedEntity.type === 'hypothesis' || selectedEntity.type === 'question') return 'text-indigo-400 border-indigo-500/50';
    return 'text-red-500 border-red-500/50';
  };

  const getBgClass = () => {
    if (selectedEntity.type === 'source') return 'bg-gray-500/10';
    if (selectedEntity.type === 'signal') return 'bg-cyan-500/10';
    if (selectedEntity.type === 'hypothesis' || selectedEntity.type === 'question') return 'bg-indigo-500/10';
    return 'bg-red-500/10';
  };

  return (
    <>
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 md:top-4 md:bottom-20 md:right-4 md:left-auto md:translate-x-0 w-full md:w-[450px] bg-[#080b14]/95 backdrop-blur-3xl border border-white/5 md:rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-[300] flex flex-col md:max-h-none max-h-[90vh]"
      >
        {/* Mobile handle indicator */}
        <div 
            className="w-full pt-3 pb-1 flex justify-center md:hidden cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="w-12 h-1.5 bg-white/20 rounded-full" />
        </div>

        {/* Always visible Header Row */}
        <div className="flex items-start justify-between p-4 md:p-6 border-b border-white/5 shrink-0">
            <div className="flex-1 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
               <AnimatePresence>
                   {entity.probability > 70 && selectedEntity.type === 'scenario' && (
                       <motion.div initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} className="inline-flex px-2 py-0.5 bg-red-950/40 border border-red-500/50 rounded-full text-red-500 text-[9px] font-mono tracking-widest uppercase mb-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                           고위험 시나리오
                       </motion.div>
                   )}
               </AnimatePresence>
               <div className="flex items-center gap-3">
                  <h2 className="text-xl md:text-2xl text-gray-200 font-mono font-medium tracking-tight">
                      {selectedEntity.type === 'source' && 'SRC'}
                      {selectedEntity.type === 'signal' && 'SIG'}
                      {selectedEntity.type === 'question' && 'QUE'}
                      {selectedEntity.type === 'hypothesis' && 'HYP'}
                      {selectedEntity.type === 'scenario' && 'SCN'}
                      -
                      {entity.id.substring(0, 4).toUpperCase()}
                  </h2>
               </div>
               <div className="text-sm md:text-base text-gray-400 font-sans mt-1 leading-relaxed max-w-[80vw] md:max-w-[380px] pr-4">
                   {entity.title || entity.text || '알 수 없는 노드 (Unknown Node)'}
               </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
                <button onClick={() => {
                    setShowDeleteModal(true);
                }} className="text-red-500 hover:text-red-400 transition-colors bg-red-950/10 hover:bg-red-900/20 p-2 rounded-xl border border-red-900/30">
                    <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setIsExpanded(!isExpanded)} className="text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-xl border border-white/10 hidden md:block">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
                <button onClick={closePanel} className="text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-xl border border-white/10">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>

        {/* Expandable Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
               initial={{ height: 0, opacity: 0 }}
               animate={{ height: 'auto', opacity: 1 }}
               exit={{ height: 0, opacity: 0 }}
               transition={{ duration: 0.3, ease: 'easeInOut' }}
               className="flex flex-col md:flex-row overflow-y-auto custom-scrollbar"
            >
                {/* Left Column */}
                <div className="flex-1 p-4 md:p-6 flex flex-col gap-6 md:border-r border-white/5">
                    <div>
                        <div className="flex bg-transparent items-center gap-2 text-[10px] font-mono text-gray-600 uppercase tracking-widest">
                            <span>추적 ID {(entity.id || 'N/A').toUpperCase()}</span>
                            <FileText className="w-3 h-3 text-gray-500 cursor-pointer hover:text-gray-300" />
                        </div>
                    </div>

                    {/* Path visualization shortcut */}
                    {tracePathNodes.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] mb-2">
                            {tracePathNodes.map((node, index) => (
                                <React.Fragment key={index}>
                                    <div className={`px-2 py-0.5 rounded border transition-colors ${node.data.id === entity.id && node.type === selectedEntity.type ? 'border-cyan-500/50 text-cyan-300 bg-cyan-950/40' : 'border-white/5 text-gray-500 bg-black/20 cursor-pointer hover:border-white/20'}`} onClick={() => setSelectedEntity({type: node.type, id: node.data.id})}>
                                        {node.label}
                                    </div>
                                    {index < tracePathNodes.length - 1 && <ArrowRight className="w-3 h-3 text-gray-700" />}
                                </React.Fragment>
                            ))}
                        </div>
                    )}

                    {/* Oracle Case Context */}
                    {activeCase && (
                      <div className="bg-[#050608]/80 border border-white/10 rounded-xl p-3 font-mono text-[10px] text-gray-500">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="text-cyan-400 uppercase tracking-[0.25em]">Oracle Case</div>
                            <div className="text-gray-200 text-[12px] mt-1 line-clamp-1">{activeCase.title}</div>
                          </div>
                          <div className="text-right uppercase">
                            <div className="text-gray-300">{String(activeCase.status || 'case_created').replace(/_/g, ' ')}</div>
                            <div className="text-gray-600">{caseLinkedNodeCount} linked nodes</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="border border-white/5 bg-black/30 rounded px-2 py-1">
                            <span className="block text-gray-600 uppercase">Evidence Tasks</span>
                            <span className="text-cyan-300">{Math.round(activeCaseEvidenceSummary?.progress || 0)}%</span>
                          </div>
                          <div className="border border-white/5 bg-black/30 rounded px-2 py-1">
                            <span className="block text-gray-600 uppercase">Ledger</span>
                            <span className="text-gray-300">{activeCaseEvidenceLedgerSummary?.total ?? 0} items</span>
                            <span className="text-cyan-300"> · {activeCaseEvidenceLedgerSummary?.supporting ?? 0} support</span>
                            <span className="text-red-400"> · {activeCaseEvidenceLedgerSummary?.opposing ?? 0} oppose</span>
                          </div>
                        </div>
                        <div className={`mt-2 border rounded px-2 py-1 ${selectedNodeLinkedToCase ? 'border-cyan-500/30 text-cyan-300 bg-cyan-950/10' : 'border-white/5 text-gray-500 bg-black/20'}`}>
                          Selected Node: {selectedNodeTypeLabel} · {selectedNodeLinkedToCase ? 'linked to active case' : 'outside active case context'} · Confidence {entity.confidence !== undefined ? `${Math.round(entity.confidence)}%` : entity.probability !== undefined ? `${Math.round(entity.probability)}%` : 'pending'}
                        </div>
                      </div>
                    )}

                    {/* Source Trace Panel */}
                    {activeCase && (
                      <div className="bg-[#050608]/70 border border-white/10 rounded-xl p-3 font-mono text-[9px]">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-cyan-500 uppercase tracking-[0.25em]">Source Trace</span>
                          <span className="text-gray-600 uppercase">Selected: {selectedNodeTypeLabel}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {sourceTraceBlocks.map((block, index) => {
                            const isSelectedStep = selectedNodeTypeLabel === block.key;
                            const isCaseLinkedStep = block.count > 0;
                            return (
                              <React.Fragment key={block.key}>
                                <div className={`min-w-[64px] border rounded px-2 py-1 ${isSelectedStep ? 'border-cyan-400 text-cyan-200 bg-cyan-950/20' : isCaseLinkedStep ? 'border-cyan-500/25 text-gray-300 bg-black/30' : 'border-white/5 text-gray-600 bg-black/20'}`}>
                                  <div className="uppercase tracking-widest">{block.label}</div>
                                  <div className={isCaseLinkedStep ? 'text-cyan-300' : 'text-gray-600'}>{block.count}</div>
                                </div>
                                {index < sourceTraceBlocks.length - 1 && <div className="h-px w-4 bg-white/15" />}
                              </React.Fragment>
                            );
                          })}
                        </div>
                        <div className="mt-2 text-gray-600 leading-snug">Trace uses existing Source → Signal → Question → Hypothesis → Scenario → Report links. Direct case links are highlighted; inferred linkage remains ledger-scoped.</div>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest flex items-center gap-2">
                                <Zap className="w-3 h-3" /> AI 브리핑 (AI BRIEFING)
                            </h3>
                            <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
                                <button onClick={() => generateAIBriefing('1')} className={`px-2 py-1 text-[9px] font-mono rounded ${briefingLevel === '1' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-500 hover:text-gray-300'}`}>1줄</button>
                                <button onClick={() => generateAIBriefing('3')} className={`px-2 py-1 text-[9px] font-mono rounded ${briefingLevel === '3' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-500 hover:text-gray-300'}`}>3줄</button>
                                <button onClick={() => generateAIBriefing('10')} className={`px-2 py-1 text-[9px] font-mono rounded ${briefingLevel === '10' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-500 hover:text-gray-300'}`}>10줄</button>
                            </div>
                        </div>
                        <div className="bg-cyan-950/20 border border-cyan-900/30 rounded-xl p-4 text-[13px] text-gray-300 font-sans leading-relaxed min-h-[80px]">
                            {(() => {
                                const baseText = entity.summary || entity.description || entity.text || entity.expectedOutcome || entity.title;
                                
                                if (!baseText) {
                                    return (
                                        <div className="flex flex-col items-center justify-center py-4 text-center">
                                            <p className="text-gray-500 mb-3">해당 노드에 대한 상세 데이터가 없습니다.</p>
                                        </div>
                                    );
                                }
                                
                                if (isGeneratingBriefing) {
                                    return (
                                        <div className="flex flex-col items-center justify-center p-4 gap-3">
                                            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs">
                                                <div className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                                AI 브리핑 생성 중... {briefingProgress}%
                                            </div>
                                            <div className="w-full bg-black/50 h-1.5 rounded-full overflow-hidden">
                                                <div className="bg-cyan-500 h-full transition-all duration-300" style={{ width: `${briefingProgress}%` }} />
                                            </div>
                                        </div>
                                    );
                                }

                                const aiText = aiBriefingText[`${entity.id}_${briefingLevel}`];
                                if (aiText) {
                                    return <p className="whitespace-pre-wrap">{aiText}</p>;
                                }

                                return (
                                    <div className="flex flex-col items-center justify-center py-4 text-center">
                                        <p className="text-gray-500 mb-3 text-xs">현재 AI 브리핑이 생성되지 않았습니다.</p>
                                        <button 
                                            onClick={() => generateAIBriefing(briefingLevel)}
                                            className="bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 px-4 py-2 rounded text-xs font-mono transition-colors"
                                        >
                                            {briefingLevel}줄 요약 브리핑 생성하기
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                           <button 
                               onClick={() => {
                                   closePanel();
                                   setCurrentView('forecast');
                               }}
                               className="inline-flex items-center justify-center gap-2 text-[10px] font-mono text-white bg-blue-600 hover:bg-blue-500 border border-blue-500/50 shadow-[0_4px_15px_rgba(37,99,235,0.3)] px-5 py-2.5 rounded hover:-translate-y-0.5 uppercase tracking-widest transition-all"
                           >
                               <BarChart2 className="w-3.5 h-3.5" />
                               전략 투영 분석 (PROJECTION)
                           </button>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="w-full md:w-[350px] bg-black/20 p-4 md:p-6 flex flex-col gap-8 shrink-0">
                    {/* Metrics Row */}
                    <div className="flex items-center gap-8">
                        <div className="flex flex-col flex-1 gap-2">
                            <span className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest">발생 예측 확률</span>
                            <div className="text-3xl font-mono text-white">{probability.toFixed(0)}%</div>
                            <div className="w-full h-1 bg-gray-900 rounded-full mt-1 overflow-hidden shadow-inner">
                                <motion.div initial={{width:0}} animate={{width:`${probability.toFixed(0)}%`}} className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                            </div>
                        </div>
                        <div className="w-[1px] h-12 bg-white/5" />
                        <div className="flex flex-col gap-2 min-w-[80px]">
                            <span className="text-[10px] font-mono text-red-500 uppercase tracking-widest">예상 파급력</span>
                            <div className="text-xl md:text-2xl font-mono text-red-500 font-bold">{impact > 70 ? '치명적' : (impact > 40 ? '높음' : '제한적')}</div>
                            <Activity className="w-5 h-5 text-red-500 mt-1" />
                        </div>
                    </div>

                    {/* Sources & Chart Row */}
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex flex-col gap-3 flex-1">
                            <h3 className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest mb-1 flex items-center justify-between">
                                관련 노드 <span className="text-white ml-2">{directlyRelatedItemsResult.length}건 직접 연결됨</span>
                            </h3>
                            {finalDisplayedRelatedItems.map((item: any, idx: number) => (
                                <div key={`${item.type}-${item.data.id}`} className="flex items-center gap-2 text-[12px] font-sans text-gray-300 cursor-pointer hover:text-white transition-colors" onClick={() => setSelectedEntity({type: item.type, id: item.data.id})}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${item.type === 'source' ? 'bg-gray-500' : item.type === 'signal' ? 'bg-cyan-500' : 'bg-indigo-500'}`} />
                                    <span className="truncate">{item.data.title || item.data.text || item.data.question || '이름 없는 마디'}</span>
                                </div>
                            ))}
                            {(directlyRelatedItemsResult.length > 5) && (
                                <div 
                                  className="text-[10px] font-mono text-cyan-500/70 mt-1 cursor-pointer hover:text-cyan-400 flex items-center gap-1"
                                  onClick={() => setShowAllRelated(!showAllRelated)}
                                >
                                  {showAllRelated ? '- 기본 보기' : `+ ${directlyRelatedItemsResult.length - 5} 개 숨겨짐 (전체 보기 역추적)`}
                                </div>
                            )}

                            <div className="mt-auto pt-4 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest mb-1">최종 업데이트</span>
                                    <span className="text-[11px] font-mono text-gray-300 flex items-center gap-1.5">
                                        <Radio className="w-3 h-3 text-cyan-500" />
                                        16:32:12 UTC
                                    </span>
                                </div>
                                <div className="px-2 py-0.5 rounded border border-green-500/50 text-green-400 text-[9px] font-mono uppercase tracking-widest bg-green-500/10">
                                    LIVE
                                </div>
                            </div>
                        </div>

                        {/* Evidence Ledger Preview */}
                        {activeCase && (
                          <div className="flex-1 bg-[#050608]/80 border border-white/10 rounded-xl p-3 flex flex-col gap-3 min-w-[220px]">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest">Evidence Ledger</h3>
                                <p className="text-[9px] font-mono text-gray-500 mt-1">{evidenceGatheringMessage}</p>
                              </div>
                              <button disabled className="text-[8px] font-mono uppercase tracking-widest border border-white/10 text-gray-600 px-2 py-1 rounded cursor-not-allowed">
                                Open Ledger · Soon
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 font-mono text-[9px] text-gray-500">
                              <div className="border border-white/5 bg-black/30 rounded px-2 py-1">
                                <span className="block uppercase text-gray-600">Case-linked evidence</span>
                                <span className="text-gray-200">{activeCaseEvidenceLedgerSummary?.total ?? 0}</span>
                                <span className="text-gray-600"> · direct {activeCaseEvidenceLedgerSummary?.directCaseLinked ?? 0} / inferred {activeCaseEvidenceLedgerSummary?.inferredLinked ?? 0}</span>
                              </div>
                              <div className="border border-white/5 bg-black/30 rounded px-2 py-1">
                                <span className="block uppercase text-gray-600">Disposition</span>
                                <span className="text-cyan-300">S {activeCaseEvidenceLedgerSummary?.supporting ?? 0}</span>
                                <span className="text-red-400"> · O {activeCaseEvidenceLedgerSummary?.opposing ?? 0}</span>
                                <span className="text-gray-400"> · N {activeCaseEvidenceLedgerSummary?.neutral ?? 0}</span>
                              </div>
                              <div className="border border-white/5 bg-black/30 rounded px-2 py-1">
                                <span className="block uppercase text-gray-600">Confidence</span>
                                <span className="text-gray-300">{activeCaseEvidenceLedgerSummary?.averageConfidence !== undefined ? `${Math.round(activeCaseEvidenceLedgerSummary.averageConfidence)}%` : 'pending'}</span>
                              </div>
                              <div className="border border-white/5 bg-black/30 rounded px-2 py-1">
                                <span className="block uppercase text-gray-600">Credibility</span>
                                <span className="text-gray-300">{activeCaseEvidenceLedgerSummary?.averageCredibility !== undefined ? `${Math.round(activeCaseEvidenceLedgerSummary.averageCredibility)}%` : 'pending'}</span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              {ledgerPreviewRows.length === 0 ? (
                                <div className="border border-white/5 bg-black/30 rounded p-3 font-mono text-[10px] text-gray-500">
                                  <div>No case-linked evidence recorded yet.</div>
                                  <div>Evidence Gathering is still preparing the ledger.</div>
                                </div>
                              ) : ledgerPreviewRows.map((row: any) => (
                                <div key={row.id} className="border border-white/5 bg-black/30 rounded px-2 py-2 font-mono text-[10px]">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-1.5 py-0.5 rounded border text-[8px] ${row.badgeClass}`}>{row.badge}</span>
                                    <span className="text-gray-300 truncate">{row.title}</span>
                                    <span className="ml-auto text-[8px] text-gray-600 uppercase">{row.isTaskRecord ? 'Provisional task record' : `${row.linkMode} ${row.linkedEntityType || 'link'}`}</span>
                                  </div>
                                  <div className="text-gray-500 leading-snug line-clamp-2">{row.summary}</div>
                                  <div className="mt-1 text-[8px] text-gray-600 uppercase tracking-wider">
                                    Confidence {row.confidence !== undefined ? `${Math.round(row.confidence)}%` : 'pending'} · Credibility {row.credibility !== undefined ? `${Math.round(row.credibility)}%` : 'pending'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Mini Chart */}
                        <div className="w-full md:w-[140px] h-[140px] bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col shrink-0 mt-4 md:mt-0">
                            <span className="text-[9px] font-mono text-indigo-300 uppercase tracking-widest mb-2">분석 확률 추세 (Trend)</span>
                            <div className="flex-1 w-full mx-auto relative -ml-1 flex items-end">
                                <LineChart width={120} height={90} data={sparklineData}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <Line type="monotone" dataKey="value" stroke="#c084fc" strokeWidth={2} dot={false} fill="url(#colorValue)" />
                                    <circle cx="100%" cy="30%" r="3" fill="#fff" filter="drop-shadow(0 0 4px #c084fc)" style={{ transformOrigin: 'center', transform: 'translate(100px, 15px)' }}/>
                                </LineChart>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>

    <AnimatePresence>
        {showDeleteModal && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-[#0b101e] border border-red-500/30 w-full max-w-md rounded-2xl p-6 shadow-2xl flex flex-col gap-4"
                >
                    <h3 className="text-xl font-medium text-red-400 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        자료 삭제 확인
                    </h3>
                    {isDeleting ? (
                        <div className="py-8 flex flex-col items-center justify-center gap-4">
                            <div className="w-full bg-slate-800 rounded-full h-2 mb-2 overflow-hidden border border-slate-700 relative">
                                <motion.div 
                                    className="bg-red-500 h-2 rounded-full absolute left-0 top-0 bottom-0"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${deleteProgress}%` }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                            <div className="text-xl font-medium text-red-400 font-mono">
                                {deleteProgress}%
                            </div>
                            <p className="text-sm text-gray-300 animate-pulse text-center break-words min-h-[40px] flex items-center justify-center">
                                {deleteStatus || "삭제 진행 중..."}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mt-2 mb-2">
                                <p className="text-white font-medium mb-1 line-clamp-2">{entity?.title || entity?.text || entity?.content}</p>
                                {entity?.shortCode && <span className="text-xs text-red-400/80 font-mono">{entity.shortCode}</span>}
                            </div>
                            <p className="text-sm text-gray-300 leading-relaxed mb-2">
                                이 항목과 연결된 **모든 하위 자료들이 함께 삭제**됩니다. 삭제하시겠습니까?
                            </p>
                            <div className="flex justify-end gap-3 mt-4">
                                <button 
                                    disabled={isDeleting}
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setDeleteFeedback("");
                                    }}
                                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors text-sm disabled:opacity-50"
                                >
                                    취소
                                </button>
                                <button 
                                    disabled={isDeleting}
                                    onClick={async () => {
                                        setIsDeleting(true);
                                        setDeleteProgress(0);
                                        setDeleteStatus("삭제 준비 중...");
                                        try {
                                            await deleteCascade(selectedEntity.type, selectedEntity.id, deleteFeedback, (progress: number, label: string) => {
                                                setDeleteProgress(progress);
                                                setDeleteStatus(label);
                                            });
                                            await new Promise(r => setTimeout(r, 600));
                                            setSelectedEntity(null);
                                        } finally {
                                            setIsDeleting(false);
                                            setShowDeleteModal(false);
                                            setDeleteFeedback("");
                                        }
                                    }}
                                    className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                                >
                                    삭제
                                </button>
                            </div>
                        </>
                    )}
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
    </>
  );
};
