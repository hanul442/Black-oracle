import React, { useState } from 'react';
import { AppProvider, useAppContext } from './store';
import { TopBar } from './components/TopBar';
import { WorkspaceRail } from './components/WorkspaceRail';
import { DetailBottomSheet } from './components/DetailBottomSheet';
import { GlobalLoadingOverlay } from './components/GlobalLoadingOverlay';
import { CollectionWorkflow } from './components/CollectionWorkflow';
import { TutorialOverlay } from './components/TutorialOverlay';
import { LoginView } from './views/LoginView';
import { CommandCenterView } from './views/CommandCenterView';
import { OperationsWithValidationView } from './views/OperationsWithValidationView';
import { OracleFieldView } from './views/OracleFieldView';
import { CasesView } from './views/CasesView';
import { CouncilView } from './views/CouncilView';
import { LedgerView } from './views/LedgerView';
import { ForecastOrbitView } from './views/ForecastOrbitView';
import { ForecastView } from './views/ForecastView';
import { HypothesisSummaryView } from './views/HypothesisSummaryView';
import { SettingsView } from './views/SettingsView';
import { StrategiesView } from './views/StrategiesView';
import { UnifiedLogView } from './views/UnifiedLogView';
import { BlackOracleMobileApp } from './mobile/BlackOracleMobileApp';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle, Info, Search, XCircle } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    currentView,
    notifications,
    workflowQuery,
    setWorkflowQuery,
    isWorkflowMinimized,
    setIsWorkflowMinimized,
  } = useAppContext() as any;

  const [localQuery, setLocalQuery] = useState('');
  const [hasSeenTutorial, setHasSeenTutorial] = useState(() => localStorage.getItem('oracle_tutorial_seen') === 'true');

  const completeTutorial = () => {
    setHasSeenTutorial(true);
    localStorage.setItem('oracle_tutorial_seen', 'true');
  };

  const isFieldView = currentView === 'oracle-field' || currentView === 'oracle-feed';
  const isOperationsView = currentView === 'operations';
  const isCoreOversightView = currentView === 'strategies' || currentView === 'log';

  const renderView = () => {
    let view: React.ReactNode;
    switch (currentView) {
      case 'login':
        view = <LoginView />;
        break;
      case 'command':
      case 'watchlist':
        view = <CommandCenterView />;
        break;
      case 'strategies':
        view = <StrategiesView />;
        break;
      case 'log':
        view = <UnifiedLogView />;
        break;
      case 'operations':
        view = <OperationsWithValidationView />;
        break;
      case 'oracle-field':
      case 'oracle-feed':
        view = <OracleFieldView />;
        break;
      case 'cases':
        view = <CasesView />;
        break;
      case 'forecast':
        view = <ForecastOrbitView />;
        break;
      case 'forecast-legacy':
        view = <ForecastView />;
        break;
      case 'council':
        view = <CouncilView />;
        break;
      case 'hypothesis-summary':
        view = <HypothesisSummaryView />;
        break;
      case 'ledger':
        view = <LedgerView />;
        break;
      case 'settings':
        view = <SettingsView />;
        break;
      default:
        view = <CommandCenterView />;
    }

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-10"
        >
          {view}
        </motion.div>
      </AnimatePresence>
    );
  };

  if (currentView === 'login') {
    return <div className="h-[100dvh] w-full bg-[#fbfcfd] text-[#111418]">{renderView()}</div>;
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <div className="h-full w-full lg:hidden">
        <BlackOracleMobileApp />
      </div>

      <div className="hidden h-full w-full select-none overflow-hidden bg-[#05070A] text-[#E9EDF1] lg:flex">
        <WorkspaceRail />

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar />
          {!hasSeenTutorial && <TutorialOverlay onComplete={completeTutorial} />}

          <main className="relative flex flex-1 overflow-hidden">
            <div className="relative h-full min-w-0 flex-1">{renderView()}</div>
            {currentView !== 'watchlist' && !isFieldView && !isOperationsView && !isCoreOversightView && <DetailBottomSheet />}

            <AnimatePresence>
              {workflowQuery && (
                <CollectionWorkflow
                  query={workflowQuery}
                  onClose={() => {
                    setWorkflowQuery(null);
                    setIsWorkflowMinimized(false);
                  }}
                  onComplete={() => {
                    setWorkflowQuery(null);
                    setIsWorkflowMinimized(false);
                  }}
                />
              )}
            </AnimatePresence>

            {isWorkflowMinimized && workflowQuery && (
              <button
                onClick={() => setIsWorkflowMinimized(false)}
                className="absolute left-1/2 top-4 z-[140] flex -translate-x-1/2 items-center gap-3 border border-[#43D9E6]/20 bg-[#090D12]/95 px-4 py-2 font-mono text-[8px] uppercase tracking-[0.16em] text-[#77CDD5] backdrop-blur-xl"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#43D9E6]" />
                Collecting: {workflowQuery.length > 24 ? `${workflowQuery.slice(0, 24)}…` : workflowQuery}
              </button>
            )}

            <div className="pointer-events-none absolute right-4 top-4 z-[150] flex flex-col gap-2">
              <AnimatePresence>
                {(notifications || []).map((notification: any) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="pointer-events-auto flex w-[min(320px,calc(100vw-32px))] items-start gap-3 border border-white/[0.08] bg-[#090D12]/95 p-3 shadow-2xl backdrop-blur-xl"
                  >
                    {notification.type === 'error' ? (
                      <XCircle className="mt-0.5 h-4 w-4 text-[#D66565]" />
                    ) : notification.type === 'success' ? (
                      <CheckCircle className="mt-0.5 h-4 w-4 text-[#72B6A0]" />
                    ) : notification.type === 'warning' ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-[#C7A96B]" />
                    ) : (
                      <Info className="mt-0.5 h-4 w-4 text-[#77818C]" />
                    )}
                    <span className="text-[11px] leading-relaxed text-[#D8DEE5]">{notification.message}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {currentView !== 'settings' && currentView !== 'login' && currentView !== 'watchlist' && !isFieldView && !isOperationsView && !isCoreOversightView && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pointer-events-none absolute bottom-5 left-1/2 z-40 w-[calc(100%-24px)] max-w-[580px] -translate-x-1/2"
              >
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const query = localQuery.trim();
                    if (!query) return;
                    setLocalQuery('');
                    setWorkflowQuery(query);
                  }}
                  className="pointer-events-auto flex items-center border border-white/[0.09] bg-[#080C11]/96 p-1.5 shadow-[0_16px_46px_rgba(0,0,0,0.42)] backdrop-blur-2xl focus-within:border-[#43D9E6]/28"
                >
                  <span className="ml-3 mr-2 hidden font-mono text-[7px] uppercase tracking-[0.2em] text-[#70CAD2] sm:inline">Ask Oracle</span>
                  <input
                    type="text"
                    value={localQuery}
                    onChange={(event) => setLocalQuery(event.target.value)}
                    placeholder="Trace a decision, inspect evidence, test a research question…"
                    className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-[12px] text-[#E9EDF1] outline-none placeholder:text-[#4F5963] sm:text-[13px]"
                  />
                  <button
                    type="submit"
                    className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/[0.07] bg-white/[0.02] text-[#7C8791] transition hover:border-[#43D9E6]/25 hover:text-[#DCE3E8]"
                  >
                    <Search className="h-3.5 w-3.5" />
                  </button>
                </form>
              </motion.div>
            )}
          </main>

          <footer className="flex h-5 shrink-0 items-center justify-between border-t border-white/[0.05] bg-[#05070A] px-3 font-mono text-[7px] uppercase tracking-[0.12em] text-[#46515B]">
            <span>BLACK ORACLE UNIFIED CORE · evidence-governed paper runtime</span>
            <span className="text-[#6CB3A0]">● legacy autonomous RSS disabled</span>
          </footer>
        </div>

        <GlobalLoadingOverlay />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
