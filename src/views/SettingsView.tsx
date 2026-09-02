import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Info,
  Radio,
  RefreshCw,
  Settings,
  Shield,
  Sliders,
  Trash2,
} from 'lucide-react';
import { auth, useAppContext } from '../store';

type SettingsTab = 'collection' | 'engine' | 'security' | 'retention';

export const SettingsView: React.FC = () => {
  const {
    sources,
    signals,
    questions,
    hypotheses,
    scenarios,
    coreInterests,
    setCoreInterests,
    hypothesisThreshold,
    setHypothesisThreshold,
    reliabilityThreshold,
    setReliabilityThreshold,
    addNotification,
    clearAllData,
    deleteSpecificItems,
    isIngestingData,
    setIsIngestingData,
    setCycleIndex,
  } = useAppContext() as any;

  const [activeTab, setActiveTab] = useState<SettingsTab>('collection');
  const [isClearing, setIsClearing] = useState(false);
  const [clearProgress, setClearProgress] = useState(0);
  const [selectedItemsToClear, setSelectedItemsToClear] = useState<Set<string>>(new Set());
  const [isWipeConfirmed, setIsWipeConfirmed] = useState(false);
  const [syncTimeLeft, setSyncTimeLeft] = useState<number | null>(null);

  const [isDeepContextEnabled, setIsDeepContextEnabled] = useState(() => {
    const value = localStorage.getItem('oracle_deep_ctx');
    return value !== null ? value === 'true' : true;
  });
  const [isHighFreqEnabled, setIsHighFreqEnabled] = useState(() => {
    const value = localStorage.getItem('oracle_high_freq');
    return value !== null ? value === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('oracle_deep_ctx', isDeepContextEnabled.toString());
  }, [isDeepContextEnabled]);

  useEffect(() => {
    localStorage.setItem('oracle_high_freq', isHighFreqEnabled.toString());
  }, [isHighFreqEnabled]);

  const allItems = useMemo(() => [
    ...(sources || []).map((item: any) => ({ _internal_type: 'sources', typeLabel: 'Source', ...item })),
    ...(signals || []).map((item: any) => ({ _internal_type: 'signals', typeLabel: 'Signal', ...item })),
    ...(questions || []).map((item: any) => ({ _internal_type: 'questions', typeLabel: 'Question', ...item })),
    ...(hypotheses || []).map((item: any) => ({ _internal_type: 'hypotheses', typeLabel: 'Hypothesis', ...item })),
    ...(scenarios || []).map((item: any) => ({ _internal_type: 'scenarios', typeLabel: 'Scenario', ...item })),
  ], [sources, signals, questions, hypotheses, scenarios]);

  const handleSyncProtocol = async () => {
    setIsIngestingData(true);
    setCycleIndex(0);
    setSyncTimeLeft(12);

    const stageTimers = [
      window.setTimeout(() => setCycleIndex(1), 2000),
      window.setTimeout(() => setCycleIndex(6), 4000),
      window.setTimeout(() => setCycleIndex(11), 7000),
    ];
    const countdown = window.setInterval(() => {
      setSyncTimeLeft((previous) => previous && previous > 0 ? previous - 1 : 0);
    }, 1000);

    try {
      const response = await fetch('/api/fetch-rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: auth.currentUser?.uid, coreInterests }),
      });
      const data = await response.json();
      if (data.success) {
        addNotification(`Field synchronized across ${data.sourcesAnalyzed || 0} sources.`, 'success');
      } else {
        addNotification(data.error || 'Field synchronization failed.', 'error');
      }
    } catch {
      addNotification('Network error while synchronizing the field.', 'error');
    } finally {
      window.clearInterval(countdown);
      stageTimers.forEach(window.clearTimeout);
      setSyncTimeLeft(null);
      setIsIngestingData(false);
      setCycleIndex(11);
      window.setTimeout(() => setCycleIndex(-1), 1000);
    }
  };

  const deleteSelected = async () => {
    if (!selectedItemsToClear.size) return;
    if (!window.confirm(`선택한 ${selectedItemsToClear.size}개의 데이터를 삭제하시겠습니까?`)) return;

    setIsClearing(true);
    setClearProgress(0);
    try {
      const items = Array.from(selectedItemsToClear).map((value) => {
        const [type, ...idParts] = value.split('-');
        return { type, id: idParts.join('-') };
      });
      await deleteSpecificItems(items, (progress: number) => setClearProgress(progress));
      setClearProgress(100);
      setSelectedItemsToClear(new Set());
      window.setTimeout(() => setIsClearing(false), 600);
    } catch {
      setIsClearing(false);
      addNotification('Selected data could not be deleted.', 'error');
    }
  };

  const wipeAll = async () => {
    if (!isWipeConfirmed) return;
    if (!window.confirm('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    setIsClearing(true);
    setClearProgress(0);
    try {
      await clearAllData((progress: number) => setClearProgress(progress));
      setClearProgress(100);
      setIsWipeConfirmed(false);
      window.setTimeout(() => setIsClearing(false), 600);
    } catch {
      setIsClearing(false);
      addNotification('Database wipe failed.', 'error');
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'collection', label: 'Collection', icon: Radio },
    { id: 'engine', label: 'Engine', icon: Cpu },
    { id: 'security', label: 'Access', icon: Shield },
    { id: 'retention', label: 'Data', icon: Database },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] text-[#E9EDF1] custom-scrollbar">
      {isClearing && <ClearOverlay progress={clearProgress} />}

      <div className="mx-auto max-w-7xl px-4 pb-32 pt-6 md:px-8 md:pb-20 md:pt-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/[0.06] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.22em] text-[#43D9E6]">
              <Settings className="h-3.5 w-3.5" /> Operator configuration
            </div>
            <h1 className="text-2xl font-medium tracking-[-0.03em]">System Settings</h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#68727C]">
              Configure collection, analytical thresholds, workspace modules, and retained intelligence without changing trading execution permissions.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-px border border-white/[0.06] bg-white/[0.05]">
            <MiniMetric label="SOURCES" value={(sources || []).length} />
            <MiniMetric label="CASES" value={(questions || []).length} />
            <MiniMetric label="SCENARIOS" value={(scenarios || []).length} />
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[210px_1fr]">
          <nav className="grid grid-cols-4 gap-px self-start border border-white/[0.07] bg-white/[0.05] lg:grid-cols-1">
            {tabs.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex min-h-[52px] items-center justify-center gap-2 bg-[#080C11] px-3 font-mono text-[7px] uppercase tracking-[0.13em] transition lg:justify-start ${active ? 'text-[#DCE2E8]' : 'text-[#59636D] hover:text-[#AEB7C0]'}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? 'text-[#43D9E6]' : ''}`} />
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0">
            {activeTab === 'collection' && (
              <div className="grid gap-4">
                <Panel title="Collection directives" icon={Radio} note={isIngestingData ? 'SYNCING' : 'READY'}>
                  <p className="mb-5 max-w-3xl text-[11px] leading-relaxed text-[#68727C]">
                    Define the semantic domains the collection workflow should prioritize. Separate topics with commas.
                  </p>
                  <textarea
                    value={coreInterests}
                    onChange={(event) => setCoreInterests(event.target.value)}
                    className="h-28 w-full resize-none border border-white/[0.08] bg-[#05070A] p-4 text-[12px] leading-relaxed text-[#CBD2D9] outline-none placeholder:text-[#46505A] focus:border-[#43D9E6]/35"
                    placeholder="Artificial Intelligence, Semiconductor, Global Macro"
                  />
                  <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.05] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-mono text-[7px] uppercase tracking-[0.13em] text-[#59636D]">
                      {isIngestingData && syncTimeLeft !== null ? `estimated ${syncTimeLeft}s remaining` : 'manual synchronization available'}
                    </div>
                    <button
                      onClick={handleSyncProtocol}
                      disabled={isIngestingData}
                      className="flex h-10 items-center justify-center gap-2 border border-[#43D9E6]/25 bg-[#43D9E6]/[0.045] px-4 font-mono text-[7px] uppercase tracking-[0.15em] text-[#BCEFF3] transition hover:bg-[#43D9E6]/[0.075] disabled:opacity-45"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isIngestingData ? 'animate-spin' : ''}`} />
                      {isIngestingData ? 'Synchronizing' : 'Synchronize field'}
                    </button>
                  </div>
                </Panel>

                <Panel title="Decision thresholds" icon={Sliders} note="LIVE STORE VALUES">
                  <Threshold
                    label="Hypothesis formation threshold"
                    value={Number(hypothesisThreshold ?? 65)}
                    onChange={(value) => setHypothesisThreshold(value)}
                    accent="#43D9E6"
                  />
                  <Threshold
                    label="Minimum source reliability"
                    value={Number(reliabilityThreshold ?? 40)}
                    onChange={(value) => setReliabilityThreshold(value)}
                    accent="#C7A96B"
                  />
                </Panel>
              </div>
            )}

            {activeTab === 'engine' && (
              <div className="grid gap-4">
                <Panel title="Analytical modules" icon={Cpu} note="WORKSPACE FLAGS">
                  <p className="mb-5 max-w-3xl text-[11px] leading-relaxed text-[#68727C]">
                    These toggles are workspace preferences stored locally. They do not by themselves prove that a remote model or data source is available.
                  </p>
                  <div className="grid gap-px bg-white/[0.05] md:grid-cols-2">
                    <ModuleToggle
                      icon={Database}
                      title="Deep context"
                      description="Permit collection workflows to request broader contextual analysis when supported by the configured backend."
                      enabled={isDeepContextEnabled}
                      onToggle={() => setIsDeepContextEnabled((value) => !value)}
                      tone="#9B8AFB"
                    />
                    <ModuleToggle
                      icon={Activity}
                      title="Time-series emphasis"
                      description="Bias downstream interpretation toward persistence and longitudinal evidence when supported by available data."
                      enabled={isHighFreqEnabled}
                      onToggle={() => setIsHighFreqEnabled((value) => !value)}
                      tone="#43D9E6"
                    />
                  </div>
                </Panel>

                <Panel title="Current model objects" icon={Activity} note="OBSERVED IN CLIENT STATE">
                  <div className="grid gap-px bg-white/[0.05] sm:grid-cols-2 xl:grid-cols-4">
                    <ObjectCount label="Signals" value={(signals || []).length} />
                    <ObjectCount label="Hypotheses" value={(hypotheses || []).length} />
                    <ObjectCount label="Scenarios" value={(scenarios || []).length} />
                    <ObjectCount label="Questions" value={(questions || []).length} />
                  </div>
                </Panel>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="grid gap-4">
                <Panel title="Access boundary" icon={Shield} note="AUTH PROVIDER">
                  <div className="grid gap-px bg-white/[0.05] sm:grid-cols-2">
                    <StatusBlock
                      icon={CheckCircle2}
                      label="IDENTITY"
                      value={auth.currentUser ? auth.currentUser.email || 'Authenticated user' : 'Legacy/local session'}
                      description="Authentication state is supplied by the configured Firebase identity provider when present."
                      tone="#43D9E6"
                    />
                    <StatusBlock
                      icon={Info}
                      label="CLIENT BOUNDARY"
                      value="No secret display"
                      description="This settings surface does not expose API keys, service-role credentials, or trading secrets."
                      tone="#C7A96B"
                    />
                  </div>
                </Panel>

                <Panel title="Interface state" icon={Settings} note="LOCAL DEVICE">
                  <button
                    onClick={() => {
                      localStorage.removeItem('oracle_tutorial_seen');
                      addNotification('Tutorial state reset. It will appear after refresh.', 'success');
                    }}
                    className="flex h-10 items-center gap-2 border border-white/[0.08] px-4 font-mono text-[7px] uppercase tracking-[0.14em] text-[#9AA4AE] transition hover:border-white/[0.14] hover:text-[#E1E6EB]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Reset onboarding tutorial
                  </button>
                </Panel>
              </div>
            )}

            {activeTab === 'retention' && (
              <div className="grid gap-4">
                <Panel title="Data register" icon={Database} note={`${allItems.length} OBJECTS`}>
                  <p className="mb-4 text-[11px] leading-relaxed text-[#68727C]">
                    Select individual analytical objects for deletion. This list reflects the currently loaded client state.
                  </p>
                  <div className="max-h-[340px] overflow-y-auto border border-white/[0.07] bg-[#05070A] custom-scrollbar">
                    {allItems.map((item: any) => {
                      const key = `${item._internal_type}-${item.id}`;
                      const checked = selectedItemsToClear.has(key);
                      return (
                        <label key={key} className="flex min-h-[48px] cursor-pointer items-center gap-3 border-b border-white/[0.045] px-3 py-2.5 last:border-b-0 hover:bg-white/[0.018]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const next = new Set(selectedItemsToClear);
                              if (event.target.checked) next.add(key);
                              else next.delete(key);
                              setSelectedItemsToClear(next);
                            }}
                            className="h-4 w-4 accent-[#D66565]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[10px] text-[#B8C0C8]">{item.title || item.text || item.description || item.id}</div>
                            <div className="mt-1 font-mono text-[6px] uppercase tracking-[0.11em] text-[#4F5963]">{item.typeLabel}</div>
                          </div>
                        </label>
                      );
                    })}
                    {!allItems.length && <div className="px-4 py-10 text-center font-mono text-[7px] uppercase tracking-[0.14em] text-[#46505A]">No analytical objects loaded</div>}
                  </div>
                  {selectedItemsToClear.size > 0 && (
                    <button
                      onClick={deleteSelected}
                      disabled={isClearing}
                      className="mt-4 flex h-10 items-center gap-2 border border-[#C7A96B]/25 bg-[#C7A96B]/[0.04] px-4 font-mono text-[7px] uppercase tracking-[0.14em] text-[#D8C79F] disabled:opacity-45"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete {selectedItemsToClear.size} selected
                    </button>
                  )}
                </Panel>

                <section className="border border-[#D66565]/20 bg-[#10090B]">
                  <div className="flex items-start gap-3 border-b border-[#D66565]/15 p-4 md:p-5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D66565]" />
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-[#D66565]">Danger zone</div>
                      <p className="mt-2 text-[10px] leading-relaxed text-[#9C777A]">Wipe all loaded intelligence objects. This action is destructive and cannot be reversed from this interface.</p>
                    </div>
                  </div>
                  <div className="p-4 md:p-5">
                    <label className="flex cursor-pointer items-start gap-3 border border-[#D66565]/16 bg-[#0B0708] p-3">
                      <input
                        type="checkbox"
                        checked={isWipeConfirmed}
                        onChange={(event) => setIsWipeConfirmed(event.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[#D66565]"
                      />
                      <span className="text-[10px] leading-relaxed text-[#B18A8D]">I understand that Wipe All permanently deletes the loaded source, signal, question, hypothesis, and scenario records.</span>
                    </label>
                    <button
                      onClick={wipeAll}
                      disabled={isClearing || !isWipeConfirmed}
                      className="mt-4 flex h-10 items-center gap-2 border border-[#D66565]/30 px-4 font-mono text-[7px] uppercase tracking-[0.14em] text-[#D98B8B] transition hover:bg-[#D66565]/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Wipe all data
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Panel = ({ title, icon: Icon, note, children }: any) => (
  <section className="border border-white/[0.07] bg-[#080C11]">
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 md:px-5">
      <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.16em] text-[#87919B]">
        <Icon className="h-3.5 w-3.5 text-[#43D9E6]" /> {title}
      </div>
      <span className="font-mono text-[6px] uppercase tracking-[0.13em] text-[#46505A]">{note}</span>
    </div>
    <div className="p-4 md:p-5">{children}</div>
  </section>
);

const MiniMetric = ({ label, value }: any) => (
  <div className="min-w-[86px] bg-[#080C11] px-3 py-2.5">
    <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]">{label}</div>
    <div className="mt-1 text-sm font-light text-[#CBD2D9]">{value}</div>
  </div>
);

const Threshold = ({ label, value, onChange, accent }: any) => (
  <div className="border-b border-white/[0.05] py-4 first:pt-0 last:border-b-0 last:pb-0">
    <div className="mb-3 flex items-center justify-between gap-4">
      <span className="text-[11px] text-[#9AA4AE]">{label}</span>
      <span className="font-mono text-[8px] tracking-[0.1em]" style={{ color: accent }}>{Number(value).toFixed(1)}%</span>
    </div>
    <input
      type="range"
      min="0"
      max="100"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-1 w-full cursor-pointer appearance-none bg-white/[0.07] outline-none accent-[#43D9E6]"
    />
  </div>
);

const ModuleToggle = ({ icon: Icon, title, description, enabled, onToggle, tone }: any) => (
  <div className="bg-[#070A0E] p-4">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" style={{ color: tone }} />
        <span className="text-[11px] text-[#C4CBD2]">{title}</span>
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={enabled}
        className="relative h-5 w-9 border border-white/[0.09] bg-[#05070A]"
        aria-label={`Toggle ${title}`}
      >
        <span className="absolute top-[3px] h-3 w-3 transition-all" style={{ left: enabled ? 19 : 3, backgroundColor: enabled ? tone : '#4F5963' }} />
      </button>
    </div>
    <p className="mt-3 text-[9px] leading-relaxed text-[#59636D]">{description}</p>
    <div className="mt-3 font-mono text-[6px] uppercase tracking-[0.12em]" style={{ color: enabled ? tone : '#4F5963' }}>{enabled ? 'enabled' : 'disabled'}</div>
  </div>
);

const ObjectCount = ({ label, value }: any) => (
  <div className="bg-[#070A0E] p-4">
    <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]">{label}</div>
    <div className="mt-2 text-2xl font-light text-[#CBD2D9]">{value}</div>
  </div>
);

const StatusBlock = ({ icon: Icon, label, value, description, tone }: any) => (
  <div className="bg-[#070A0E] p-4">
    <div className="flex items-center gap-2 font-mono text-[6px] uppercase tracking-[0.13em]" style={{ color: tone }}><Icon className="h-3.5 w-3.5" />{label}</div>
    <div className="mt-3 text-[11px] text-[#C3CBD2]">{value}</div>
    <p className="mt-2 text-[9px] leading-relaxed text-[#59636D]">{description}</p>
  </div>
);

const ClearOverlay = ({ progress }: { progress: number }) => (
  <div className="fixed inset-0 z-[160] flex items-center justify-center bg-[#05070A]/92 px-5 backdrop-blur-sm">
    <div className="w-full max-w-[420px] border border-[#D66565]/25 bg-[#10090B] p-5">
      <div className="flex items-center gap-3">
        {progress < 100 ? <RefreshCw className="h-4 w-4 animate-spin text-[#D66565]" /> : <CheckCircle2 className="h-4 w-4 text-[#43D9E6]" />}
        <div>
          <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-[#D8B0B0]">{progress < 100 ? 'Mutating database' : 'Operation complete'}</div>
          <div className="mt-1 text-[9px] text-[#805F62]">Do not close the workspace while the operation is running.</div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between font-mono text-[7px] uppercase tracking-[0.12em] text-[#805F62]"><span>progress</span><span>{progress}%</span></div>
      <div className="mt-2 h-px bg-[#D66565]/15"><div className="h-px bg-[#D66565] transition-[width] duration-300" style={{ width: `${progress}%` }} /></div>
    </div>
  </div>
);
