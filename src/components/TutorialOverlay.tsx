import React from "react";
import { motion } from "motion/react";
import {
  Search,
  MousePointer2,
  Layers,
  Activity,
  ArrowRight,
  ScanLine,
  Settings,
  Radar,
  ListTodo
} from "lucide-react";

export const TutorialOverlay: React.FC<{ onComplete: () => void }> = ({
  onComplete,
}) => {
  return (
    <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 mt-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0a0f18] border border-cyan-900/50 rounded-2xl w-full max-w-[800px] overflow-hidden shadow-[0_0_100px_rgba(6,182,212,0.15)] flex flex-col max-h-[85vh]"
      >
        <div className="p-8 shrink-0 border-b border-white/5">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="bg-cyan-500/20 p-2.5 rounded-lg border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                <ScanLine className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  ORACLE SYSTEM 매뉴얼
                </h1>
                <p className="text-sm text-cyan-400/70 font-mono mt-1">
                  CORE_OPERATIONAL_GUIDE_V2
                </p>
              </div>
            </div>
            <button
              onClick={onComplete}
              className="text-gray-500 hover:text-white transition-colors flex items-center gap-1 bg-white/5 px-4 py-2 rounded-full text-xs font-bold border border-white/10 hover:bg-white/10"
            >
              닫기 (Close) <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Feature 1 */}
            <div className="bg-white/5 hover:bg-white/10 transition-colors border border-white/10 p-5 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-teal-500/20 p-2 rounded border border-teal-500/30">
                  <MousePointer2 className="w-4 h-4 text-teal-400" />
                </div>
                <h3 className="text-white font-medium text-lg">
                  뷰어 캔버스 (Space View)
                </h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                가운데 거대한 우주 화면에서 데이터를 시각화합니다. 화면을 <strong>드래그</strong>하거나 <strong>휠로 확대/축소</strong>해 탐색하세요. 노드를 클릭하면 연관된 상하위 노드들만 모이는 <strong>집중 모드(Focus)</strong>가 활성화되며 하단에 시트가 나타납니다.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white/5 hover:bg-white/10 transition-colors border border-white/10 p-5 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-blue-500/20 p-2 rounded border border-blue-500/30">
                  <Radar className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-white font-medium text-lg">
                  AI 자동 데이터 수집 (REFRESH)
                </h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                우측 상단의 <strong>[데이터 동기화]</strong> 버튼을 누르면 AI가 사용자 설정 <strong>핵심 수집 규칙</strong>을 바탕으로 최신 글로벌 데이터를 수집하고 분류합니다.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white/5 hover:bg-white/10 transition-colors border border-white/10 p-5 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-indigo-500/20 p-2 rounded border border-indigo-500/30">
                  <Search className="w-4 h-4 text-indigo-400" />
                </div>
                <h3 className="text-white font-medium text-lg">
                  워크플로우 질의 (Workflow)
                </h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                상단 검색창에 <strong>기업/주제/질문</strong>을 입력하면, AI가 그에 국한된 자료를 집중적으로 딥러닝 검색하여 당신만의 <strong>맞춤형 시나리오 궤도</strong>를 즉각 구축합니다.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white/5 hover:bg-white/10 transition-colors border border-white/10 p-5 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-amber-500/20 p-2 rounded border border-amber-500/30">
                  <Layers className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="text-white font-medium text-lg">
                  하단 네비게이션 뷰 (Views)
                </h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                하단 메뉴에서 모드를 전환합니다. <strong>FORECAST</strong> 뷰에서는 전체 경제 시나리오와 경고 목록을 리포트 형식으로 파악할 수 있으며, 가설 목록도 열람 가능합니다.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white/5 hover:bg-white/10 transition-colors border border-white/10 p-5 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-violet-500/20 p-2 rounded border border-violet-500/30">
                  <Activity className="w-4 h-4 text-violet-400" />
                </div>
                <h3 className="text-white font-medium text-lg">
                  노드 연쇄 피드백 (가지치기)
                </h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                캔버스에서 노드를 선택 후 시트에서 <strong>[해당 노드 삭제]</strong>를 누르세요. 해당 노드와 <strong>연계된 하단 구조들이 연쇄적으로 삭제</strong>되며 동시에 "이 데이터가 틀린 이유"를 입력하면 다음 분석부터 그 방면을 피합니다.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white/5 hover:bg-white/10 transition-colors border border-white/10 p-5 rounded-xl md:col-span-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-rose-500/20 p-2 rounded border border-rose-500/30">
                  <Settings className="w-4 h-4 text-rose-400" />
                </div>
                <h3 className="text-white font-medium text-lg">
                  시스템 설정 (Settings)
                </h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                상단 <strong>설정 톱니바퀴 버튼</strong>을 눌러 진입합니다. <strong>맞춤 수집 규칙(관심분야) 설정</strong>을 통한 <strong>프로토콜 동기화(Sync)</strong> 및 <strong>데이터베이스 포맷 (Wipe All)</strong> 기능을 제공합니다.
              </p>
            </div>

          </div>

          <div className="mt-8 bg-cyan-950/20 border border-cyan-800/50 rounded-xl p-5">
            <h4 className="text-cyan-400 font-bold mb-2 font-mono flex items-center gap-2">
              <ListTodo className="w-4 h-4" /> 데이터 우선순위 
            </h4>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="bg-white/10 px-2 py-1 rounded text-gray-300 border border-white/5">💡 1. 팩트 (Source)</span>
              <span className="text-gray-500 py-1">→</span>
              <span className="bg-white/10 px-2 py-1 rounded text-gray-300 border border-white/5">📡 2. 신호 (Signal)</span>
              <span className="text-gray-500 py-1">→</span>
              <span className="bg-white/10 px-2 py-1 rounded text-gray-300 border border-white/5">❓ 3. 의문 (Question)</span>
              <span className="text-gray-500 py-1">→</span>
              <span className="bg-white/10 px-2 py-1 rounded text-gray-300 border border-white/5">⚡ 4. 가설 (Hypothesis)</span>
              <span className="text-gray-500 py-1">→</span>
              <span className="bg-white/10 px-2 py-1 rounded border border-amber-500/30 text-amber-300">🔥 5. 결과 시나리오 (Scenario)</span>
            </div>
            <p className="mt-4 text-xs text-cyan-300/60 font-sans">오라클 시스템은 위 구조를 기반으로 모든 정보를 연관지어 글로벌 이슈를 추론합니다.</p>
          </div>

        </div>

        <div className="p-6 bg-[#050812] border-t border-white/5 flex justify-end">
          <button
            onClick={onComplete}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-8 py-3 rounded-lg transition-colors flex items-center gap-2 text-sm shadow-[0_0_15px_rgba(6,182,212,0.4)]"
          >
            시스템 가동 <Activity className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
