import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radar, FolderOutput, Network, BrainCircuit, Activity, BarChart2, FileText, CheckCircle2, ChevronRight, X, Maximize2, Map, Layers } from 'lucide-react';
import { useAppContext } from '../store';
import { ExecutionLogger, WorkflowStep } from './ExecutionLogger';

const STEPS: WorkflowStep[] = [
  { id: 'signal', title: '신호 수집 (Signal Collection)', description: '글로벌 비정형 데이터 네트워크 스캔 및 지역 OSINT 노드 탐색 중...', icon: Radar, baseDuration: 2000 },
  { id: 'merge', title: '데이터 병합 및 정제 (Deduplication)', description: '유사 데이터 분석, 중복 노드 병합 및 무의미한 엔티티 삭제 처리 중...', icon: Layers, baseDuration: 2500 },
  { id: 'source', title: '출처 분류 (Source Classification)', description: '신뢰도 벡터 검증 및 연관된 인텔리전스 스트림 클러스터링...', icon: FolderOutput, baseDuration: 2200 },
  { id: 'trace', title: '인과망 추적 (Trace Extraction)', description: '인과 관계 연결 고리 분리 및 주요 엔티티 관계망 구축 중...', icon: Network, baseDuration: 2400 },
  { id: 'hypothesis', title: '가설 생성 (Hypothesis Generation)', description: '상충되는 신호들을 종합하여 잠재적 전개 방향 가설 도출...', icon: BrainCircuit, baseDuration: 2800 },
  { id: 'scenario', title: '시나리오 모델링 (Scenario Modeling)', description: '정의된 벡터 공간에서 확률 분포 시뮬레이션 및 파생...', icon: Activity, baseDuration: 2500 },
  { id: 'projection', title: '영향력 투영 (Projection Build)', description: '장기 거시적 예상 파급력 평가 및 신뢰 구간 렌더링 중...', icon: BarChart2, baseDuration: 2200 },
  { id: 'report', title: '심층 보고서 (Deep Dive Report)', description: '최종 인텔리전스 브리핑 작성 및 활성 상태 퍼블리싱...', icon: FileText, baseDuration: 1800 },
];

export const CollectionWorkflow: React.FC<{
  query: string;
  onClose: () => void;
  onComplete: (data: any) => void;
}> = ({ query, onClose, onComplete }) => {
    const { setCurrentView, setWorkflowStep, user, setSelectedEntity, addNotification, isWorkflowMinimized, setIsWorkflowMinimized, setWorkflowQuery, createOracleCase, updateOracleCase, linkGeneratedNodesToCase, startEvidenceGatheringForCase, updateEvidenceTask, activeCaseEvidenceTasks, activeCaseEvidenceSummary } = useAppContext() as any;
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const fetchedResultRef = useRef<any>(null);
  
    useEffect(() => {
      let isCancelled = false;
      let caseId: string | null = null;
      const evidenceTimers: ReturnType<typeof setTimeout>[] = [];

      const taskId = (type: string) => caseId ? `evtask_${caseId}_${type}` : '';
      const scheduleEvidenceProgress = () => {
        if (!caseId) return;
        evidenceTimers.push(setTimeout(() => {
          updateEvidenceTask(taskId('market_metrics'), {
            status: 'completed',
            progress: 100,
            resultSummary: 'Market metrics placeholder prepared',
          }).catch((err: any) => console.warn('Evidence task update failed', err));
          updateEvidenceTask(taskId('valuation_data'), {
            status: 'running',
            progress: 35,
            resultSummary: 'Valuation range placeholder scan in progress',
          }).catch((err: any) => console.warn('Evidence task update failed', err));
        }, 1000));
        evidenceTimers.push(setTimeout(() => {
          updateEvidenceTask(taskId('valuation_data'), {
            status: 'completed',
            progress: 100,
            resultSummary: 'Valuation range placeholder prepared',
          }).catch((err: any) => console.warn('Evidence task update failed', err));
          updateEvidenceTask(taskId('price_volume_data'), {
            status: 'running',
            progress: 45,
            resultSummary: 'Price-volume pattern placeholder scan in progress',
          }).catch((err: any) => console.warn('Evidence task update failed', err));
        }, 2600));
        evidenceTimers.push(setTimeout(() => {
          updateEvidenceTask(taskId('price_volume_data'), {
            status: 'completed',
            progress: 100,
            resultSummary: 'Price-volume pattern placeholder prepared',
          }).catch((err: any) => console.warn('Evidence task update failed', err));
          updateEvidenceTask(taskId('latest_sources'), {
            status: 'running',
            progress: 60,
            resultSummary: 'Latest source sweep waiting for Oracle Search response',
          }).catch((err: any) => console.warn('Evidence task update failed', err));
        }, 4200));
      };

      // Automatically switch to watchlist view when workflow starts
      setCurrentView('watchlist');
      setWorkflowStep(0);
      
      const runOracleSearch = async () => {
        try {
          const oracleCase = await createOracleCase({ query });
          caseId = oracleCase.id;
          await updateOracleCase(caseId, { status: 'search_running' });
          await startEvidenceGatheringForCase(caseId);
          scheduleEvidenceProgress();
        } catch (err) {
          console.error('Oracle case creation failed', err);
          addNotification('케이스 파일 생성 실패: 기존 분석 워크플로우를 계속 실행합니다.', 'warning');
        }

        try {
          const resp = await fetch('/api/search-oracle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, userId: user?.uid })
          });
          const data = await resp.json();

          if (caseId) {
            try {
              if (data?.success === false || data?.error || data?.errorCode) {
                const message = data?.message || data?.error || 'Oracle analysis did not complete.';
                await updateOracleCase(caseId, {
                  status: 'evidence_gathering',
                  summary: message,
                });
                await Promise.all([
                  updateEvidenceTask(taskId('latest_sources'), { status: 'failed', progress: 0, errorMessage: message }),
                  updateEvidenceTask(taskId('source_trace'), { status: 'failed', progress: 0, errorMessage: message }),
                  updateEvidenceTask(taskId('scenario_triggers'), { status: 'failed', progress: 0, errorMessage: message }),
                ]);
              } else {
                await linkGeneratedNodesToCase(caseId, data);
                await Promise.all([
                  updateEvidenceTask(taskId('latest_sources'), {
                    status: 'completed',
                    progress: 100,
                    resultSummary: 'Latest source sweep linked to Oracle Search response',
                  }),
                  updateEvidenceTask(taskId('source_trace'), {
                    status: 'completed',
                    progress: 100,
                    resultSummary: 'Source trace alignment completed from generated node IDs',
                  }),
                  updateEvidenceTask(taskId('scenario_triggers'), {
                    status: 'completed',
                    progress: 100,
                    resultSummary: 'Scenario trigger scan linked to generated scenarios',
                  }),
                  updateEvidenceTask(taskId('opposing_evidence'), {
                    status: 'pending',
                    progress: 0,
                    resultSummary: 'Opposing evidence search pending until external sources are available',
                  }),
                ]);
                await updateOracleCase(caseId, { status: 'evidence_updated', summary: 'Evidence updated for active case' });
              }
            } catch (err) {
              console.error('Oracle case linking failed', err);
              addNotification('케이스 링크 업데이트 실패: 생성된 분석 데이터는 유지됩니다.', 'warning');
            }
          }

          if (!isCancelled) fetchedResultRef.current = data;
        } catch (err: any) {
          console.error(err);
          if (caseId) {
            try {
              await updateOracleCase(caseId, {
                status: 'evidence_gathering',
                summary: err?.message || 'Oracle search failed.',
              });
              await updateEvidenceTask(taskId('latest_sources'), {
                status: 'failed',
                progress: 0,
                errorMessage: err?.message || 'Oracle search failed.',
              });
            } catch (caseErr) {
              console.error('Oracle case failure update failed', caseErr);
            }
          }
          if (!isCancelled) {
            fetchedResultRef.current = {
              success: false,
              error: 'Oracle search failed',
              message: err?.message || 'Oracle search failed',
            };
          }
        }
      };

      runOracleSearch();

      return () => {
        isCancelled = true;
        evidenceTimers.forEach(clearTimeout);
        setWorkflowStep(-1);
      }; // Reset when unmounted
    }, [query, setCurrentView, setWorkflowStep, user]);

  useEffect(() => {
    if (isFinished) {
      setWorkflowStep(99);
      if (isWorkflowMinimized) {
        addNotification(`Collection Operation Completed: ${query}`, "success");
        onComplete(fetchedResultRef.current);
      }
      return;
    }

    setWorkflowStep(currentStepIndex);

    const currentStep = STEPS[currentStepIndex];
    if (!currentStep) {
      setIsFinished(true);
      return;
    }

    const duration = currentStep.baseDuration + Math.random() * 500;
    const intervalTime = 50;
    const increment = (intervalTime / duration) * 100;
    
    let timer: any;
    let currentProgress = 0;

    timer = setInterval(() => {
      currentProgress += increment;
      if (currentProgress >= 100) {
        clearInterval(timer);
        setProgress(100);
        setTimeout(() => {
          if (currentStepIndex === STEPS.length - 1) {
            // Wait for fetch to complete before finishing
            const checkFetchComplete = setInterval(() => {
               if (fetchedResultRef.current !== null) {
                  clearInterval(checkFetchComplete);
                  setIsFinished(true);
                  
                  // Auto-complete after a short delay
                  setTimeout(() => {
                      const data = fetchedResultRef.current;
                      if (data?.success === false || data?.error || data?.errorCode) {
                         addNotification(`수집 오류: ${data.message || data.error || data.errorCode}`, "warning");
                         onClose();
                         return;
                      } else if (data && data.sourceId) {
                         setSelectedEntity({ type: 'source', id: data.sourceId });
                      }
                      
                      addNotification("✅ 목표 인텔리전스 수집 및 분석이 완료되었습니다.", "success");
                  }, 500);
               }
            }, 500);
            return () => clearInterval(checkFetchComplete);
          } else {
            setCurrentStepIndex(prev => prev + 1);
            setProgress(0);
          }
        }, 400);
      } else {
        setProgress(currentProgress);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [currentStepIndex, isFinished]);

  if (isWorkflowMinimized) {
      return null;
  }

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute top-0 right-0 h-[100dvh] w-full md:w-[480px] bg-[#030612]/95 backdrop-blur-3xl border-l border-white/10 shadow-[-20px_0_60px_rgba(0,0,0,0.8)] z-[200] flex flex-col pointer-events-auto"
    >
      {/* Header */}
      <div className="p-6 border-b border-white/10 shrink-0 flex justify-between items-start">
        <div>
          <div className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest mb-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
            Active Operation
          </div>
          <h2 className="text-xl font-mono text-white tracking-tight">Intelligence Collection</h2>
          <div className="text-sm font-sans text-gray-400 mt-1 truncate max-w-xs">{query}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsWorkflowMinimized(true)} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Hide (Run in Background)">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Steps List */}
      <ExecutionLogger 
        steps={STEPS}
        currentStepIndex={currentStepIndex}
        progress={progress}
        isFinished={isFinished}
      />

      {activeCaseEvidenceTasks?.length > 0 && (
        <div className="mx-6 mb-28 rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-[10px] text-gray-400 shadow-[0_0_20px_rgba(0,0,0,0.35)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-[0.22em] text-gray-600">Evidence Gathering</div>
              <div className="text-cyan-400">Progress: {activeCaseEvidenceSummary?.progress ?? 0}%</div>
            </div>
            <div className="text-right text-[9px] uppercase text-gray-500">
              Evidence count: linked nodes only<br />
              Credibility: {activeCaseEvidenceSummary?.averageCredibility ? `${Math.round(activeCaseEvidenceSummary.averageCredibility)}%` : 'pending'}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {activeCaseEvidenceTasks.slice(0, 9).map((task: any) => {
              const statusIcon = task.status === 'completed' ? '✓' : task.status === 'running' ? '⟳' : task.status === 'failed' ? '!' : '○';
              const statusClass = task.status === 'completed'
                ? 'text-cyan-300'
                : task.status === 'running'
                  ? 'text-cyan-400 animate-pulse'
                  : task.status === 'failed'
                    ? 'text-red-400'
                    : 'text-gray-600';
              return (
                <div key={task.id} className="flex items-center gap-2 truncate rounded border border-white/5 bg-white/[0.02] px-2 py-1">
                  <span className={statusClass}>{statusIcon}</span>
                  <span className="truncate text-gray-300">{task.label}</span>
                  <span className="ml-auto text-gray-600">{task.progress ?? 0}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#030612] via-[#030612] to-transparent pointer-events-none">
        <AnimatePresence>
          {isFinished && (
            <motion.div
               initial={{ opacity: 0, y: 50 }}
               animate={{ opacity: 1, y: 0 }}
               className="flex flex-col gap-5 p-6 rounded-2xl bg-[#0a0a0f] border border-blue-500/50 shadow-[0_-10px_40px_rgba(59,130,246,0.15)] relative overflow-hidden pointer-events-auto"
            >
               <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Network className="w-24 h-24 text-blue-400" />
               </div>
               
               <div className="relative z-10 flex flex-col items-center text-center gap-2 mb-2">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-400/50 flex items-center justify-center text-blue-400 mb-2 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                     <Activity className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-mono text-white tracking-tight uppercase">데이터 융합 완료</h3>
                  <p className="text-[11px] text-blue-200/60 font-sans max-w-[280px]">목표 인텔리전스가 성공적으로 수집 및 병합되어 활성 환경에 주입되었습니다.</p>
               </div>

               <div className="relative z-10 flex flex-col gap-2 mt-2 w-full">
                  {fetchedResultRef.current?.data?.map((item: any) => (
                      <button 
                         key={`${item.type}-${item.data.id}`}
                         onClick={() => {
                             setSelectedEntity({ type: item.type, id: item.data.id });
                             onClose();
                         }}
                         className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/30 transition-all w-full text-left"
                      >
                         <div className={`p-2 rounded-lg ${
                            item.type === 'source' ? 'bg-gray-500/20 text-gray-400' :
                            item.type === 'signal' ? 'bg-cyan-500/20 text-cyan-400' :
                            'bg-violet-500/20 text-violet-400'
                         }`}>
                            {item.type === 'source' ? <FileText className="w-4 h-4" /> :
                             item.type === 'signal' ? <Radar className="w-4 h-4" /> :
                             <BrainCircuit className="w-4 h-4" />}
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">{item.type}</div>
                            <div className="text-sm text-gray-200 truncate">{item.data.title || item.data.name || item.data.headline}</div>
                         </div>
                         <ChevronRight className="w-4 h-4 text-gray-500" />
                      </button>
                  ))}
                  
                  <button onClick={() => {
                     const data = fetchedResultRef.current;
                     if (data && data.sourceId) {
                         setSelectedEntity({ type: 'source', id: data.sourceId });
                     }
                     onClose();
                  }} className="w-full mt-2 py-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition-all font-mono text-xs uppercase tracking-widest">
                     완료 및 닫기
                  </button>
               </div>
            </motion.div>
          )}
         </AnimatePresence>
      </div>
    </motion.div>
  );
};
