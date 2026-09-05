import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radar, FolderOutput, Network, BrainCircuit, Activity, BarChart2, FileText, CheckCircle2, ChevronRight, X, Layers } from 'lucide-react';
import { useAppContext } from '../store';
import { persistResearchResults } from '../lib/persistResearch';
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
  const { setCurrentView, setWorkflowStep, user, setSelectedEntity, addNotification, isWorkflowMinimized, setIsWorkflowMinimized } = useAppContext() as any;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const fetchedResultRef = useRef<any>(null);

  useEffect(() => {
    setCurrentView('watchlist');
    setWorkflowStep(0);

    let cancelled = false;
    const run = async () => {
      if (!user) {
        fetchedResultRef.current = { success: false, error: 'Firebase authentication is required.' };
        return;
      }
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/search-oracle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ query }),
        });
        const data = await response.json();
        if (!response.ok || !data?.success) throw new Error(data?.error || `Research API failed with HTTP ${response.status}.`);
        if (!Array.isArray(data.data)) throw new Error('Research API returned no structured objects.');
        const persistedCount = await persistResearchResults(user.uid, data.data);
        if (!cancelled) fetchedResultRef.current = { ...data, persisted: true, persistedCount };
      } catch (error) {
        if (!cancelled) {
          fetchedResultRef.current = {
            success: false,
            error: error instanceof Error ? error.message : 'Research collection failed.',
          };
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
      setWorkflowStep(-1);
    };
  }, [query, setCurrentView, setWorkflowStep, user]);

  useEffect(() => {
    if (isFinished) {
      setWorkflowStep(99);
      if (isWorkflowMinimized) {
        addNotification(`Collection Operation Completed: ${query}`, 'success');
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
    let currentProgress = 0;

    const timer = setInterval(() => {
      currentProgress += increment;
      if (currentProgress >= 100) {
        clearInterval(timer);
        setProgress(100);
        setTimeout(() => {
          if (currentStepIndex === STEPS.length - 1) {
            const checkFetchComplete = setInterval(() => {
              if (fetchedResultRef.current !== null) {
                clearInterval(checkFetchComplete);
                setIsFinished(true);
                setTimeout(() => {
                  const data = fetchedResultRef.current;
                  if (data?.sourceId && data?.persisted) {
                    setSelectedEntity({ type: 'source', id: data.sourceId });
                  } else if (data?.error) {
                    addNotification(`수집 오류: ${data.error}`, 'error');
                    onClose();
                    return;
                  }
                  addNotification(`✅ 목표 인텔리전스 ${data?.persistedCount || 0}개 객체를 사용자 워크스페이스에 저장했습니다.`, 'success');
                }, 500);
              }
            }, 500);
            return;
          }
          setCurrentStepIndex((previous) => previous + 1);
          setProgress(0);
        }, 400);
      } else {
        setProgress(currentProgress);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [currentStepIndex, isFinished, setWorkflowStep, isWorkflowMinimized, addNotification, onComplete, onClose, query, setSelectedEntity]);

  if (isWorkflowMinimized) return null;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute top-0 right-0 h-[100dvh] w-full md:w-[480px] bg-[#030612]/95 backdrop-blur-3xl border-l border-white/10 shadow-[-20px_0_60px_rgba(0,0,0,0.8)] z-[200] flex flex-col pointer-events-auto"
    >
      <div className="p-6 border-b border-white/10 shrink-0 flex justify-between items-start">
        <div>
          <div className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest mb-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
            Active Operation
          </div>
          <h2 className="text-xl font-mono text-white tracking-tight">Intelligence Collection</h2>
          <div className="text-sm font-sans text-gray-400 mt-1 truncate max-w-xs">{query}</div>
        </div>
        <button onClick={() => setIsWorkflowMinimized(true)} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Hide (Run in Background)">
          <X className="w-4 h-4" />
        </button>
      </div>

      <ExecutionLogger
        steps={STEPS}
        currentStepIndex={currentStepIndex}
        progress={progress}
        isFinished={isFinished}
      />

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
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-mono text-white tracking-tight uppercase">데이터 융합 완료</h3>
                <p className="text-[11px] text-blue-200/60 font-sans max-w-[280px]">분석 결과가 인증된 사용자 워크스페이스에 저장되었습니다. 서버는 Firestore 쓰기 권한을 갖지 않습니다.</p>
              </div>

              <div className="relative z-10 flex flex-col gap-2 mt-2 w-full">
                {fetchedResultRef.current?.data?.slice(0, 8).map((item: any) => (
                  <button
                    key={`${item.type}-${item.data.id}`}
                    onClick={() => {
                      setSelectedEntity({ type: item.type, id: item.data.id });
                      onClose();
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/30 transition-all w-full text-left"
                  >
                    <div className={`p-2 rounded-lg ${item.type === 'source' ? 'bg-gray-500/20 text-gray-400' : item.type === 'signal' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-violet-500/20 text-violet-400'}`}>
                      {item.type === 'source' ? <FileText className="w-4 h-4" /> : item.type === 'signal' ? <Radar className="w-4 h-4" /> : <BrainCircuit className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">{item.type}</div>
                      <div className="text-sm text-gray-200 truncate">{item.data.title || item.data.name || item.data.headline || item.data.text}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                ))}

                <button
                  onClick={() => {
                    const data = fetchedResultRef.current;
                    if (data?.sourceId && data?.persisted) setSelectedEntity({ type: 'source', id: data.sourceId });
                    onClose();
                  }}
                  className="w-full mt-2 py-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 transition-all font-mono text-xs uppercase tracking-widest"
                >
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
