import React, { useEffect, useState } from 'react';
import { AppProvider, useAppContext } from './store';
import { TopBar } from './components/TopBar';
import { WorkspaceRail } from './components/WorkspaceRail';
import { MobileNavigation } from './components/MobileNavigation';
import { GlobalLoadingOverlay } from './components/GlobalLoadingOverlay';
import { CollectionWorkflow } from './components/CollectionWorkflow';
import { TutorialOverlay } from './components/TutorialOverlay';
import { LoginView } from './views/LoginView';
import { CommandCenterView } from './views/CommandCenterView';
import { OperationsWithValidationView } from './views/OperationsWithValidationView';
import { OracleFieldView } from './views/OracleFieldView';
import { MobileNexusView } from './views/MobileNexusView';
import { CasesView } from './views/CasesView';
import { CouncilView } from './views/CouncilView';
import { LedgerView } from './views/LedgerView';
import { ForecastOrbitView } from './views/ForecastOrbitView';
import { WatchlistView } from './views/WatchlistView';
import { HypothesisSummaryView } from './views/HypothesisSummaryView';
import { SettingsView } from './views/SettingsView';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle, Info, Search, XCircle } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    currentView,
    addNotification,
    notifications,
    coreInterests,
    workflowQuery,
    setWorkflowQuery,
    isWorkflowMinimized,
    setIsWorkflowMinimized,
    scenarios,
    hypotheses,
    signals,
    user,
  } = useAppContext() as any;

  const [localQuery, setLocalQuery] = useState('');
  const [hasSeenTutorial, setHasSeenTutorial] = useState(() => {
    return localStorage.getItem('oracle_tutorial_seen') === 'true';
  });

  const completeTutorial = () => {
    setHasSeenTutorial(true);
    localStorage.setItem('oracle_tutorial_seen', 'true');
  };

  useEffect(() => {
    if (currentView === 'login') return;

    const intervalMs = 60 * 60 * 1000;
    const fetchAuto = async () => {
      localStorage.setItem('lastAutonomousRun', Date.now().toString());
      try {
        const response = await fetch('/api/fetch-rss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interests: coreInterests, userId: user?.uid }),
        });
        const data = await response.json();
        if (data.success && (data.count > 0 || data.mergedCount > 0)) {
          addNotification(
            `Oracle Field updated: ${data.count || 0} new evidence items, ${data.mergedCount || 0} merged nodes.`,
            'success',
          );
        }
      } catch {
        // Autonomous collection remains silent when the network is unavailable.
      }
    };

    const lastRun = localStorage.getItem('lastAutonomousRun');
    if (!lastRun || Date.now() - Number(lastRun) > intervalMs) fetchAuto();

    const interval = window.setInterval(fetchAuto, intervalMs);
    return () => window.clearInterval(interval);
  }, [currentView, addNotification, coreInterests, user?.uid]);

  const isFieldView = currentView === 'oracle-field' || currentView === 'oracle-feed';
  const isOperationsView = currentView === 'operations';

  const renderView = () => {
    let view: React.ReactNode;
    switch (currentView) {
      case 'login':
        view = <LoginView />;
        break;
      case 'command':
        view = <CommandCenterView />;
        break;
      case 'operations':
        view = <OperationsWithValidationView />;
        break;
      case 'oracle-field':
      case 'oracle-feed':
        view = (
          <>
            <div className="h-full lg:hidden"><MobileNexusView /></div>
            <div className="hidden h-full lg:block"><OracleFieldView /></div>
          </>
        );
        break;
      case 'cases':
        view = <CasesView />;
        break;
      case 'watchlist':
        view = <WatchlistView />;
        break;
      case 'forecast':
        view = <ForecastOrbitView />;
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
    return <div className="h-[100dvh] w-full bg-[#05070A] text-[#E9EDF1]">{renderView()}</div>;
  }

  return (
    <div className="relative flex h-[100dvh] w-full select-none overflow-hidden bg-[#05070A] text-[#E9EDF1]">
      <WorkspaceRail />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        {!hasSeenTutorial && <TutorialOverlay onComplete={completeTutorial} />}

        <main className="relative flex flex-1 overflow-hidden pb-[58px] lg:pb-0">
          <div className="relative h-full min-w-0 flex-1">{renderView()}</div>

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

          <div className="pointer-events-none absolute right-3 top-3 z-[150] flex flex-col gap-2 md:right-4 md:top-4">
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

          {currentView !== 'settings' && currentView !== 'login' && currentView !== 'watchlist' && !isFieldView && !isOperationsView && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-none absolute bottom-[70px] left-1/2 z-40 w-[calc(100%-24px)] max-w-[580px] -translate-x-1/2 lg:bottom-5"
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
                  placeholder="Trace a signal, test a scenario, open a question…"
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

        <footer className="hidden h-5 shrink-0 items-center justify-between border-t border-white/[0.05] bg-[#05070A] px-3 font-mono text-[7px] uppercase tracking-[0.12em] text-[#46515B] lg:flex">
          <span>{signals?.length || 0} signals · {hypotheses?.length || 0} hypotheses · {scenarios?.length || 0} scenarios</span>
          <span className="text-[#6CB3A0]">● field monitor active</span>
        </footer>
      </div>

      <MobileNavigation />
      <GlobalLoadingOverlay />
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