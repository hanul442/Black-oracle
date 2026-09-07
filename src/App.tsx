import React from 'react';
import { AppProvider, useAppContext } from './store';
import { TopBar } from './components/TopBar';
import { WorkspaceRail } from './components/WorkspaceRail';
import { MobileNavigation } from './components/MobileNavigation';
import { GlobalLoadingOverlay } from './components/GlobalLoadingOverlay';
import { CollectionWorkflow } from './components/CollectionWorkflow';
import { RuntimeHeartbeat } from './components/RuntimeHeartbeat';
import { LoginView } from './views/LoginView';
import { TerminalMonitorView } from './views/TerminalMonitorView';
import { TerminalPositionsView } from './views/TerminalPositionsView';
import { TerminalAuditView } from './views/TerminalAuditView';
import { TerminalLabView } from './views/TerminalLabView';
import { PwaRuntimeView } from './views/PwaRuntimeView';
import { SettingsView } from './views/SettingsView';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const STATUS_ONLY_PWA = String(viteEnv?.VITE_STATIC_PWA_STATUS_ONLY || '').toLowerCase() === 'true';

const AppContent: React.FC = () => {
  const {
    currentView,
    notifications,
    workflowQuery,
    setWorkflowQuery,
    isWorkflowMinimized,
    setIsWorkflowMinimized,
  } = useAppContext() as any;

  const renderView = () => {
    switch (currentView) {
      case 'login': return <LoginView />;
      case 'command':
      case 'operations':
      case 'oracle-field':
      case 'oracle-feed': return <TerminalMonitorView />;
      case 'cases':
      case 'watchlist':
      case 'forecast':
      case 'council': return <TerminalPositionsView />;
      case 'ledger':
      case 'hypothesis-summary': return <TerminalAuditView />;
      case 'lab': return <TerminalLabView />;
      case 'settings': return <SettingsView />;
      default: return <TerminalMonitorView />;
    }
  };

  if (currentView === 'login') return <div className="h-[100dvh] w-full bg-[#030405] text-[#d9dde1]">{renderView()}</div>;

  return (
    <div className="relative flex h-[100dvh] w-full select-none overflow-hidden bg-[#030405] text-[#d9dde1]">
      <WorkspaceRail />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <RuntimeHeartbeat />
        <main className="relative flex min-h-0 flex-1 overflow-hidden pb-[46px] lg:pb-0">
          <div className="relative h-full min-w-0 flex-1">{renderView()}</div>
          {workflowQuery && (
            <CollectionWorkflow query={workflowQuery} onClose={() => { setWorkflowQuery(null); setIsWorkflowMinimized(false); }} onComplete={() => { setWorkflowQuery(null); setIsWorkflowMinimized(false); }} />
          )}
          {isWorkflowMinimized && workflowQuery && (
            <button onClick={() => setIsWorkflowMinimized(false)} className="absolute left-1/2 top-2 z-[140] flex -translate-x-1/2 items-center gap-2 border border-[#5a4418] bg-[#090a0b] px-3 py-1.5 font-mono text-[7px] uppercase tracking-[0.08em] text-[#f3a312]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f3a312]" />
              COLLECTING {workflowQuery.length > 28 ? `${workflowQuery.slice(0, 28)}…` : workflowQuery}
            </button>
          )}
          <div className="pointer-events-none absolute right-2 top-2 z-[150] flex flex-col gap-1">
            {(notifications || []).map((notification: any) => (
              <div key={notification.id} className="pointer-events-auto flex w-[min(360px,calc(100vw-16px))] items-start gap-2 border border-[#2b3035] bg-[#090a0b] px-2.5 py-2 font-mono shadow-xl">
                {notification.type === 'error' ? <XCircle className="mt-0.5 h-3.5 w-3.5 text-[#ff6262]" /> : notification.type === 'success' ? <CheckCircle className="mt-0.5 h-3.5 w-3.5 text-[#62d49f]" /> : notification.type === 'warning' ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-[#f3b642]" /> : <Info className="mt-0.5 h-3.5 w-3.5 text-[#77818a]" />}
                <span className="text-[7px] leading-4 text-[#aeb5bb]">{notification.message}</span>
              </div>
            ))}
          </div>
        </main>
        <footer className="hidden h-5 shrink-0 items-center justify-between border-t border-[#202429] bg-[#070809] px-2 font-mono text-[6px] uppercase tracking-[0.08em] text-[#505960] lg:flex">
          <span>BLACK ORACLE / PWA OPERATOR TERMINAL / SUPABASE HEARTBEAT</span>
          <span className="text-[#f3a312]">PAPER EXECUTION</span>
        </footer>
      </div>
      <MobileNavigation />
      <GlobalLoadingOverlay />
    </div>
  );
};

export default function App() {
  if (STATUS_ONLY_PWA) return <PwaRuntimeView />;
  return <AppProvider><AppContent /></AppProvider>;
}
