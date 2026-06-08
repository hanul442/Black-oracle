import React, { useState, useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import {
  Settings,
  Server,
  Database,
  Shield,
  Radio,
  Key,
  HardDrive,
  Cpu,
  Sliders,
  Lock,
  Target,
  Activity,
  Info,
} from "lucide-react";
import { useAppContext, auth } from "../store";

export const SettingsView: React.FC = () => {
  const { 
    sources, signals, questions, hypotheses, scenarios,
    coreInterests, 
    setCoreInterests, 
    addNotification, 
    clearAllData,
    deleteSpecificItems,
    isIngestingData,
    setIsIngestingData,
    setCycleIndex 
  } = useAppContext() as any;

  // Add missing state for local settings
  const [hypothesisThreshold, setHypothesisThreshold] = useState<number>(75);
  const [reliabilityThreshold, setReliabilityThreshold] = useState<number>(60);
  const [activeTab, setActiveTab] = useState<
    "collection" | "nodes" | "security" | "retention"
  >("collection");
  const [isClearing, setIsClearing] = useState(false);
  const [clearProgress, setClearProgress] = useState(0);
  const [selectedItemsToClear, setSelectedItemsToClear] = useState<Set<string>>(new Set());

  const [isDeepContextEnabled, setIsDeepContextEnabled] = useState(() => {
    const val = localStorage.getItem("oracle_deep_ctx");
    return val !== null ? val === "true" : true;
  });
  const [isHighFreqEnabled, setIsHighFreqEnabled] = useState(() => {
    const val = localStorage.getItem("oracle_high_freq");
    return val !== null ? val === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("oracle_deep_ctx", isDeepContextEnabled.toString());
  }, [isDeepContextEnabled]);

  useEffect(() => {
    localStorage.setItem("oracle_high_freq", isHighFreqEnabled.toString());
  }, [isHighFreqEnabled]);

  const [isWipeConfirmed, setIsWipeConfirmed] = useState(false);
  const [syncTimeLeft, setSyncTimeLeft] = useState<number | null>(null);

  const handleSyncProtocol = async () => {
    setIsIngestingData(true);
    setCycleIndex(0); // COLLECTING
    setSyncTimeLeft(12); // Estimated 12 seconds
    
    // Simulate process stages while waiting
    const timer1 = setTimeout(() => setCycleIndex(1), 2000); // NORMALIZING
    const timer2 = setTimeout(() => setCycleIndex(6), 4000); // EXTRACTING_SIGNALS
    const timer3 = setTimeout(() => setCycleIndex(11), 7000); // SCENARIO_UPDATING

    const countdown = setInterval(() => {
        setSyncTimeLeft((prev) => {
           if (prev && prev > 0) return prev - 1;
           return 0;
        });
    }, 1000);

    try {
      const resp = await fetch('/api/fetch-rss', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: (auth.currentUser as any)?.uid, coreInterests: coreInterests })
      });
      const data = await resp.json();
      if (data.success) {
         addNotification(`수집 매개변수 동기화 및 수집 완료 (${(data.sourcesAnalyzed ?? data.count ?? 0)}개 소스)`, 'success');
      } else {
         addNotification(`수집 실패: ${data.error}`, 'error');
      }
    } catch (e) {
      console.error(e);
      addNotification("네트워크 오류 발생", "error");
    } finally {
      clearInterval(countdown);
      setSyncTimeLeft(null);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setIsIngestingData(false);
      setCycleIndex(11);
      setTimeout(() => setCycleIndex(-1), 1000);
    }
  };

  return (
    <div className="w-full h-full p-8 md:p-12 flex flex-col gap-10 bg-[#020510] overflow-y-auto custom-scrollbar relative z-10">
      <header className="flex flex-col md:flex-row justify-between items-start border-b border-white/5 pb-6 shrink-0 gap-4">
        <div>
          <h1 className="text-3xl font-display text-white tracking-tight leading-none mb-2">
            시스템 설정 (SYSTEM CONFIGURATION)
          </h1>
          <p className="font-mono text-[11px] text-gray-500 tracking-widest uppercase">
            운영 매개변수 및 인텔리전스 엔진 구조
          </p>
        </div>
      </header>

      {/* Full-screen popup for data deletion progress */}
      {isClearing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="w-[90%] max-w-md bg-[#0a0d1a] border border-red-500/30 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300">
            {clearProgress < 100 ? (
              <div className="w-12 h-12 rounded-full border-4 border-red-500 border-t-transparent animate-spin mb-2" />
            ) : (
             <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mb-2">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
             </div>
            )}
            <div className="text-center">
              <h3 className="text-xl font-display text-white mb-2">
                {clearProgress < 100 ? "데이터베이스 포맷 중..." : "삭제 완료"}
              </h3>
              <p className="text-sm text-gray-400 font-mono">
                {clearProgress < 100 ? "작업이 완료될 때까지 기다려 주세요..." : "선택한 모든 데이터가 안전하게 삭제되었습니다."}
              </p>
            </div>
            
            <div className="w-full">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-mono text-red-400">
                  진행 상태
                </span>
                <span className="text-xs font-mono text-red-400">
                  {clearProgress}%
                </span>
              </div>
              <div className="h-2 w-full bg-red-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${clearProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8 max-w-7xl">
        {/* Lateral menu */}
        <div className="w-full lg:w-64 flex flex-col gap-2 shrink-0">
          <button
            onClick={() => setActiveTab("collection")}
            className={`flex items-center gap-3 px-5 py-4 ${activeTab === "collection" ? "bg-white/5 border-white/10 text-white shadow-lg" : "hover:bg-white/5 border-transparent text-gray-400"} border rounded-xl text-[13px] font-sans font-medium transition-colors relative overflow-hidden group`}
          >
            {activeTab === "collection" && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 shadow-[0_0_10px_#06b6d4]" />
            )}
            <Radio
              className={`w-4 h-4 ${activeTab === "collection" ? "text-cyan-400" : ""} group-hover:scale-110 transition-transform`}
            />{" "}
            수집 프로토콜
          </button>
          <button
            onClick={() => setActiveTab("nodes")}
            className={`flex items-center gap-3 px-5 py-4 ${activeTab === "nodes" ? "bg-white/5 border-white/10 text-white shadow-lg" : "hover:bg-white/5 border-transparent text-gray-400"} border rounded-xl text-[13px] font-sans transition-colors relative group`}
          >
            {activeTab === "nodes" && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-[0_0_10px_#3b82f6]" />
            )}
            <Cpu
              className={`w-4 h-4 ${activeTab === "nodes" ? "text-blue-400" : ""} group-hover:scale-110 transition-transform`}
            />{" "}
            신경망 처리 노드
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-3 px-5 py-4 ${activeTab === "security" ? "bg-white/5 border-white/10 text-white shadow-lg" : "hover:bg-white/5 border-transparent text-gray-400"} border rounded-xl text-[13px] font-sans transition-colors relative group`}
          >
            {activeTab === "security" && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_10px_#10b981]" />
            )}
            <Shield
              className={`w-4 h-4 ${activeTab === "security" ? "text-emerald-400" : ""} group-hover:scale-110 transition-transform`}
            />{" "}
            접근 관리 및 방어
          </button>
          <button
            onClick={() => setActiveTab("retention")}
            className={`flex items-center gap-3 px-5 py-4 ${activeTab === "retention" ? "bg-white/5 border-white/10 text-white shadow-lg" : "hover:bg-white/5 border-transparent text-gray-400"} border rounded-xl text-[13px] font-sans transition-colors relative group`}
          >
            {activeTab === "retention" && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 shadow-[0_0_10px_#8b5cf6]" />
            )}
            <Database
              className={`w-4 h-4 ${activeTab === "retention" ? "text-violet-400" : ""} group-hover:scale-110 transition-transform`}
            />{" "}
            데이터 보존 정책
          </button>
        </div>

        {/* Main Config Area */}
        <div className="flex-1 flex flex-col gap-6">
          {activeTab === "collection" && (
            <>
              <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                <div className="p-8 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <Sliders className="w-5 h-5 text-gray-400" />
                      <h2 className="text-xl font-display text-white font-medium tracking-wide">
                        핵심 수집 규칙 (Core Directives)
                      </h2>
                    </div>
                    <div className="px-3 py-1 bg-cyan-950/30 rounded text-[9px] font-mono text-cyan-400 border border-cyan-900/50 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />{" "}
                      활성 노드 (Active)
                    </div>
                  </div>
                  <p className="text-[13px] text-gray-400 font-sans mb-8 leading-relaxed">
                    오라클이 자율적으로 모니터링할 주요 의미론적 영역을
                    정의합니다. 항목을 쉼표로 구분하여 입력하면 시스템의 정보
                    수집 휴리스틱이 재배열됩니다.
                  </p>

                  <textarea
                    value={coreInterests}
                    onChange={(e) => setCoreInterests(e.target.value)}
                    className="w-full bg-[#0a0d1a]/50 border border-white/5 rounded-xl p-5 text-gray-200 font-sans text-sm focus:outline-none focus:border-cyan-500/50 transition-colors h-32 resize-none shadow-inner"
                    placeholder="예: 지정학, 반도체 공급망, 차세대 인공지능, 에너지 기후 동향 등"
                  />
                </div>

                <div className="px-8 py-5 border-t border-white/5 bg-[#050814]/80 flex justify-between items-center">
                  <span className="text-[10px] font-mono text-cyan-500 tracking-widest uppercase flex items-center gap-2">
                    {isIngestingData ? "상태: 동기화 진행 중... (Syncing)" : "상태: 동기화 대기 중 (Pending)"}
                    {isIngestingData && syncTimeLeft !== null && (
                      <span className="text-cyan-300">
                        (예상 남은 시간: {syncTimeLeft}초)
                      </span>
                    )}
                  </span>
                  <button
                    onClick={handleSyncProtocol}
                    disabled={isIngestingData}
                    className="bg-cyan-900/40 hover:bg-cyan-800/60 border border-cyan-800 text-cyan-300 text-[10px] font-mono px-6 py-2.5 rounded-lg transition-all shadow-lg uppercase tracking-widest flex items-center gap-2 font-bold disabled:opacity-50"
                  >
                    <Radio className={`w-3 h-3 ${isIngestingData ? 'animate-pulse' : ''}`} /> {isIngestingData ? '동기화 중...' : '프로토콜 동기화'}
                  </button>
                </div>
              </div>

              <div className="bg-black/20 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden flex flex-col relative group">
                <div className="p-8 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <Target className="w-5 h-5 text-gray-400" />
                      <h2 className="text-xl font-display text-gray-300 font-medium tracking-wide">
                        예측 신뢰도 설정 (Confidence)
                      </h2>
                    </div>
                    <div className="px-3 py-1 bg-cyan-950/20 rounded text-[9px] font-mono text-cyan-500 border border-cyan-900/40 uppercase tracking-widest flex items-center gap-2">
                      사용자 정의 활성
                    </div>
                  </div>

                  <p className="text-[13px] text-gray-500 font-sans mb-8 leading-relaxed">
                    자동화된 시나리오 생성 및 인과망 확장에 필요한 최소 확률
                    한계치를 설정합니다. 이 값을 수정하면 시스템의 근본적인 위험
                    수용도(Risk Tolerance)가 변경됩니다.
                  </p>

                  <div className="flex flex-col gap-6">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[12px] font-sans text-gray-400 font-medium">
                          가설 생성 트리거 한계선
                        </span>
                        <span className="text-[11px] font-mono text-cyan-400 tracking-widest">
                          {hypothesisThreshold.toFixed(1)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={hypothesisThreshold}
                        onChange={(e) =>
                          setHypothesisThreshold(Number(e.target.value))
                        }
                        className="w-full h-1 bg-gray-900 rounded-full appearance-none outline-none focus:outline-none cursor-pointer accent-cyan-500 transition-all"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[12px] font-sans text-gray-400 font-medium">
                          데이터 소스 최소 신뢰 필터
                        </span>
                        <span className="text-[11px] font-mono text-blue-400 tracking-widest">
                          {reliabilityThreshold.toFixed(1)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={reliabilityThreshold}
                        onChange={(e) =>
                          setReliabilityThreshold(Number(e.target.value))
                        }
                        className="w-full h-1 bg-gray-900 rounded-full appearance-none outline-none focus:outline-none cursor-pointer accent-blue-500 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "nodes" && (
            <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <Cpu className="w-5 h-5 text-gray-400" />
                <h2 className="text-xl font-display text-white font-medium tracking-wide">
                  신경망 처리 노드 (Neural Nodes)
                </h2>
              </div>
              <p className="text-[13px] text-gray-400 font-sans mb-8 leading-relaxed">
                현재 연결된 글로벌 인텔리전스 노드 및 LLM 프로세서의 상태를
                확인합니다.
              </p>
              <div className="space-y-4">
                {[
                  "Gemini 1.5 Pro",
                  "Gemini Flash",
                  "Semantic Search Engine",
                ].map((node, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-4 bg-white/5 rounded-lg border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-sm font-sans text-gray-300">
                        {node}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h2 className="text-xl font-display text-white font-medium tracking-wide">
                  접근 관리 및 방어 (Security & Access)
                </h2>
              </div>
              <p className="text-[13px] text-gray-400 font-sans mb-8 leading-relaxed">
                시스템의 보안 강도 및 엔드 투 엔드 암호화 키를 관리합니다.
              </p>
              <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-sans text-gray-300">
                    엔드 투 엔드 암호화 (E2EE)
                  </span>
                  <Lock className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-xs text-gray-500">
                  모든 분석 데이터와 수집된 인텔리전스는 AES-256 규격으로
                  암호화됩니다.
                </p>
              </div>

              <div className="mt-8 pt-8 border-t border-white/5">
                <div className="flex items-center gap-3 mb-4">
                  <Sliders className="w-5 h-5 text-gray-400" />
                  <h3 className="text-lg font-display text-white tracking-wide">
                    사용자 인터페이스 (UI Config)
                  </h3>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem("oracle_tutorial_seen");
                    addNotification(
                      "튜토리얼 상태가 초기화되었습니다. 새로고침 시 나타납니다.",
                      "success",
                    );
                  }}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[12px] px-6 py-2.5 rounded-lg transition-all"
                >
                  초기 튜토리얼 다시 보기
                </button>
              </div>

              <div className="mt-8 pt-8 border-t border-white/5">
                <div className="flex items-center gap-3 mb-4">
                  <Cpu className="w-5 h-5 text-violet-400" />
                  <h3 className="text-lg font-display text-white tracking-wide">
                    고도화된 예측 모델 앙상블 (Advanced Modules)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    className={`p-5 rounded-xl border transition-all ${isDeepContextEnabled ? "border-violet-500 bg-violet-900/20" : "border-white/10 bg-white/5"}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="font-bold text-white flex items-center gap-2">
                        <Database className="w-4 h-4 text-violet-400" /> 1. LLM
                        자율 추론 (Semantic Search)
                      </div>
                      <button
                        onClick={() =>
                          setIsDeepContextEnabled(!isDeepContextEnabled)
                        }
                        className={`w-10 h-5 rounded-full relative transition-colors ${isDeepContextEnabled ? "bg-violet-600" : "bg-gray-700"}`}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isDeepContextEnabled ? "translate-x-5" : "translate-x-0"}`}
                        />
                      </button>
                    </div>
                    <p className="text-[12px] text-gray-400 leading-relaxed">
                      입력된 단일 데이터에서 그치지 않고, 자율 에이전트가 연관된
                      백그라운드 웹 문서를 병렬 검색하여 숨겨진 의도와
                      내러티브를 자동 생성합니다.
                    </p>
                  </div>

                  <div
                    className={`p-5 rounded-xl border transition-all ${isHighFreqEnabled ? "border-cyan-500 bg-cyan-900/20" : "border-white/10 bg-white/5"}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-cyan-400" /> 2. 시계열
                        확산망 (Time-Series Vector)
                      </div>
                      <button
                        onClick={() => setIsHighFreqEnabled(!isHighFreqEnabled)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${isHighFreqEnabled ? "bg-cyan-600" : "bg-gray-700"}`}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isHighFreqEnabled ? "translate-x-5" : "translate-x-0"}`}
                        />
                      </button>
                    </div>
                    <p className="text-[12px] text-gray-400 leading-relaxed">
                      과거 데이터 웨이트를 반영하여 시계열 예측 가중치를
                      부여합니다. 단발성 이슈가 아닌 장기 트렌드를 딥 다이브에
                      통합 반영합니다.
                    </p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-blue-950/30 border border-blue-900/50 rounded-lg flex items-center gap-2 text-xs text-blue-300">
                  <Info className="w-4 h-4" /> 두 모듈을 활성화하면 데이터 수집
                  및 질문/가설 생성 단계(워크플로우)에서 앙상블 분석을 거치게
                  되어 시간이 +10초 소요됩니다.
                </div>
              </div>
            </div>
          )}

          {activeTab === "retention" && (
            <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl p-8 shadow-2xl flex flex-col gap-8">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Database className="w-5 h-5 text-violet-400" />
                  <h2 className="text-xl font-display text-white font-medium tracking-wide">
                    데이터 보존 정책 (Retention)
                  </h2>
                </div>
                <p className="text-[13px] text-gray-400 font-sans mb-8 leading-relaxed">
                  수집된 정보의 스토리지 및 보존 주기를 구성합니다.
                </p>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm text-gray-300 mb-2">
                      <span>자동 파기 주기 (Auto-purge)</span>
                      <span className="font-mono text-violet-400">90일</span>
                    </div>
                    <div className="w-full h-1 bg-gray-900 rounded-full">
                      <div className="h-full bg-violet-500 w-[60%] rounded-full"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm text-gray-300 mb-2">
                      <span>현재 스토리지 용량 (Storage Usage)</span>
                      <span className="font-mono text-violet-400">
                        42% (2.1GB/5GB)
                      </span>
                    </div>
                    <div className="w-full h-1 bg-gray-900 rounded-full">
                      <div className="h-full bg-violet-500 w-[42%] rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-6">
                <h3 className="text-red-400 font-medium mb-2">
                  위험 구역 (Danger Zone)
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  현재 데이터베이스에 저장된 모든 소스, 신호, 가설, 시나리오를
                  영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.
                </p>
                <div className="flex flex-col gap-4">
                  <div className="text-sm text-gray-400 mb-2 font-mono">
                    개별 데이터 선택 삭제
                  </div>
                  <div className="max-h-60 overflow-y-auto border border-white/10 rounded-lg bg-black/20 p-2 flex flex-col gap-1 custom-scrollbar">

                      {(() => {
                        const allItems = [
                          ...(sources || []).map((s: any) => ({ _internal_type: 'sources', typeLabel: 'Source', ...s })),
                          ...(signals || []).map((s: any) => ({ _internal_type: 'signals', typeLabel: 'Signal', ...s })),
                          ...(questions || []).map((q: any) => ({ _internal_type: 'questions', typeLabel: 'Question', ...q })),
                          ...(hypotheses || []).map((h: any) => ({ _internal_type: 'hypotheses', typeLabel: 'Hypothesis', ...h })),
                          ...(scenarios || []).map((s: any) => ({ _internal_type: 'scenarios', typeLabel: 'Scenario', ...s })),
                        ];
                        if (allItems.length === 0) {
                          return <div className="text-gray-500 text-xs p-2 text-center">데이터가 없습니다.</div>;
                        }
                        return allItems.map((item) => (
                          <label key={`${item._internal_type}-${item.id}`} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={selectedItemsToClear.has(`${item._internal_type}-${item.id}`)}
                              onChange={(e) => {
                                const newSet = new Set(selectedItemsToClear);
                                if (e.target.checked) newSet.add(`${item._internal_type}-${item.id}`);
                                else newSet.delete(`${item._internal_type}-${item.id}`);
                                setSelectedItemsToClear(newSet);
                              }}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-red-500 accent-red-600"
                            />
                            <div className="flex flex-col overflow-hidden">
                              <div className="text-xs text-gray-300 truncate font-sans">
                                {item.title || item.text || item.description || item.id}
                              </div>
                              <div className="text-[10px] text-gray-600 font-mono">
                                {item.typeLabel}
                              </div>
                            </div>
                          </label>
                        ));
                      })()}
                    </div>
                    {selectedItemsToClear.size > 0 && (
                      <button
                        disabled={isClearing}
                        onClick={async () => {
                          if (!window.confirm(`선택한 ${selectedItemsToClear.size}개의 데이터를 삭제하시겠습니까?`)) return;
                          setIsClearing(true);
                          setClearProgress(0);
                          try {
                            const itemsToDelete = Array.from(selectedItemsToClear).map((val: string) => {
                              const splitValues = val.split('-');
                              const type = splitValues[0];
                              const id = splitValues.slice(1).join('-'); // re-join in case id has hyphen
                              return { type, id };
                            });
                            await deleteSpecificItems(itemsToDelete, (progress: number) => {
                              setClearProgress(progress);
                            });
                            setClearProgress(100);
                            setSelectedItemsToClear(new Set());
                            setTimeout(() => {
                              setIsClearing(false);
                            }, 600);
                          } catch (err) {
                            setIsClearing(false);
                          }
                        }}
                        className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 px-6 py-2 rounded-lg text-sm transition-colors w-full sm:w-auto disabled:opacity-50 flex items-center gap-2 justify-center self-start"
                      >
                        선택한 {selectedItemsToClear.size}개 데이터 삭제
                      </button>
                    )}

                    <div className="w-full h-px bg-white/10 my-4" />

                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-red-950/30 rounded-lg border border-red-900/50 w-full sm:w-auto mt-2">
                        <input 
                            type="checkbox" 
                            checked={isWipeConfirmed} 
                            onChange={(e) => setIsWipeConfirmed(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 outline-none text-red-500 accent-red-600 bg-gray-700" 
                        />
                        <span className="text-sm text-red-300">
                            모든 정보 삭제 위험성을 인지하였으며 일괄 삭제(Wipe All)에 동의합니다.
                        </span>
                    </label>

                    <button
                      disabled={isClearing || !isWipeConfirmed}
                      onClick={async () => {
                        if (!window.confirm("정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
                        setIsClearing(true);
                        setClearProgress(0);
                        try {
                          await clearAllData((progress: number) => {
                            setClearProgress(progress);
                          });
                          setClearProgress(100);
                          setIsWipeConfirmed(false);
                          setTimeout(() => {
                            setIsClearing(false);
                          }, 600);
                        } catch (err) {
                          setIsClearing(false);
                        }
                      }}
                      className="bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30 px-6 py-2 rounded-lg text-sm transition-colors w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center self-start"
                    >
                      모든 데이터베이스 초기화 (Wipe All Data)
                    </button>
                  </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
