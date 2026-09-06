import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type AuditDecision = any;
type AuditPayload = any;

const ACTIONS = ['ALL', 'ENTER', 'EXIT', 'HOLD', 'NO_TRADE'];
const GRADES = ['ALL', 'WEAK', 'PARTIAL', 'STRONG', 'COMPLETE'];
const pct = (value: number | null | undefined, digits = 0) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;
const stamp = (value: number | null | undefined) => value ? new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) : '—';

export const TerminalAuditView: React.FC = () => {
  const [payload, setPayload] = useState<AuditPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('ALL');
  const [grade, setGrade] = useState('ALL');
  const [market, setMarket] = useState('ALL');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/operator-log?limit=96', { cache: 'no-store' });
      const next = await response.json();
      setPayload(next);
      setError(response.ok ? null : next?.error || 'Operator audit request failed.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Operator audit request failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const decisions: AuditDecision[] = payload?.decisions || [];
  const markets = useMemo(() => ['ALL', ...Array.from(new Set(decisions.map((item) => item.market))).sort()], [decisions]);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return decisions.filter((item) => {
      if (action !== 'ALL' && item.decision !== action) return false;
      if (grade !== 'ALL' && item.auditCompleteness?.grade !== grade) return false;
      if (market !== 'ALL' && item.market !== market) return false;
      if (!needle) return true;
      return [
        item.market,
        item.decision,
        item.regime || '',
        item.strategyDisposition || '',
        item.riskDisposition || '',
        item.primaryReason || '',
        ...(item.evidenceIds || []),
        ...(item.auditCompleteness?.missing || []),
      ].join(' ').toLowerCase().includes(needle);
    });
  }, [action, decisions, grade, market, query]);

  const selected = rows.find((item) => `${item.cycleNumber}-${item.market}-${item.timestamp}` === selectedId) || rows[0] || null;
  const executionEvents = decisions.filter((item) => item.decision === 'ENTER' || item.decision === 'EXIT').length;
  const lowTrace = decisions.filter((item) => (item.decision === 'ENTER' || item.decision === 'EXIT') && (item.auditCompleteness?.score ?? 0) < 70).length;
  const evidenceCoverage = decisions.length ? decisions.filter((item) => item.evidenceActiveCount > 0).length / decisions.length : 0;

  return (
    <div className="terminal-screen h-full overflow-hidden bg-[#030405] text-[#d9dde1]">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-8 shrink-0 items-center gap-3 border-b border-[#24282c] bg-[#070809] px-3 font-mono text-[7px] uppercase tracking-[0.08em]">
          <span className="text-[#f3a312]">AUDIT</span>
          <span className="text-[#59636b]">CYCLES <b className="font-normal text-[#c4cbd1]">{payload?.retainedCycles ?? 0}</b></span>
          <span className="text-[#59636b]">DECISIONS <b className="font-normal text-[#c4cbd1]">{decisions.length}</b></span>
          <span className="text-[#59636b]">EXEC <b className="font-normal text-[#c4cbd1]">{executionEvents}</b></span>
          <span className="text-[#59636b]">AVG <b className={(payload?.auditSummary?.averageScore ?? 100) < 70 ? 'font-normal text-[#f3b642]' : 'font-normal text-[#c4cbd1]'}>{payload?.auditSummary?.averageScore ?? 0}%</b></span>
          <span className="text-[#59636b]">WEAK <b className={(payload?.auditSummary?.weak || 0) > 0 ? 'font-normal text-[#f3b642]' : 'font-normal text-[#c4cbd1]'}>{payload?.auditSummary?.weak ?? 0}</b></span>
          <span className="text-[#59636b]">LOW-TRACE <b className={lowTrace > 0 ? 'font-normal text-[#f3b642]' : 'font-normal text-[#c4cbd1]'}>{lowTrace}</b></span>
          <span className="text-[#59636b]">EVID COVER <b className="font-normal text-[#c4cbd1]">{pct(evidenceCoverage)}</b></span>
          {error && <span className="truncate text-[#ff6262]">{error}</span>}
          <button onClick={() => { setLoading(true); void load(); }} className="terminal-action ml-auto"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />REFRESH</button>
        </div>

        <div className="flex h-8 shrink-0 items-center gap-1 overflow-x-auto border-b border-[#24282c] bg-[#050607] px-2 font-mono text-[6px] uppercase tracking-[0.08em]">
          {ACTIONS.map((item) => <button key={item} onClick={() => setAction(item)} className={action === item ? 'terminal-filter terminal-filter-active' : 'terminal-filter'}>{item}</button>)}
          <select value={grade} onChange={(event) => setGrade(event.target.value)} className="terminal-select ml-1">{GRADES.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={market} onChange={(event) => setMarket(event.target.value)} className="terminal-select">{markets.map((item) => <option key={item}>{item}</option>)}</select>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SEARCH REASON / EVIDENCE / LINK" className="h-[23px] min-w-[220px] flex-1 border border-[#24292e] bg-[#070809] px-2 text-[6.5px] text-[#aab2b8] outline-none placeholder:text-[#485159] focus:border-[#624717]" />
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_230px] gap-px bg-[#24282c] xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,.72fr)] xl:grid-rows-1">
          <section className="min-h-0 overflow-auto bg-[#050607] font-mono">
            <div className="sticky top-0 z-10 grid min-w-[1110px] grid-cols-[106px_58px_90px_74px_60px_60px_78px_82px_70px_76px_minmax(300px,1fr)] border-b border-[#282d32] bg-[#0a0b0c] px-2 py-1.5 text-[6px] uppercase tracking-[0.08em] text-[#59636b]">
              <span>TIME</span><span>CYCLE</span><span>MARKET</span><span>ACTION</span><span>SCORE</span><span>CONF</span><span>REGIME</span><span>RISK</span><span>EVID</span><span>AUDIT</span><span>PRIMARY REASON</span>
            </div>
            {rows.map((item) => {
              const id = `${item.cycleNumber}-${item.market}-${item.timestamp}`;
              const active = selected && id === `${selected.cycleNumber}-${selected.market}-${selected.timestamp}`;
              const score = item.auditCompleteness?.score ?? 0;
              const tone = item.riskDisposition === 'REJECT' || score < 50 ? 'text-[#ff6262]' : score < 80 ? 'text-[#f3b642]' : 'text-[#62d49f]';
              return (
                <button key={id} onClick={() => setSelectedId(id)} className={`grid w-full min-w-[1110px] grid-cols-[106px_58px_90px_74px_60px_60px_78px_82px_70px_76px_minmax(300px,1fr)] border-b border-[#15191c] px-2 py-1.5 text-left text-[7px] ${active ? 'bg-[#101113]' : 'hover:bg-[#0a0c0e]'}`}>
                  <span className="text-[#626c74]">{stamp(item.timestamp)}</span><span>#{item.cycleNumber}</span><span className="text-[#c4cbd1]">{item.market}</span><span className={item.decision === 'ENTER' ? 'text-[#62d49f]' : item.decision === 'EXIT' ? 'text-[#f3b642]' : 'text-[#8b949c]'}>{item.decision}</span><span>{item.oracleTradeScore ?? '—'}</span><span>{pct(item.confidence)}</span><span>{item.regime || '—'}</span><span>{item.riskDisposition || '—'}</span><span>{item.evidenceActiveCount || 0}</span><span className={tone}>{score}%</span><span className="truncate pr-2 text-[#9aa3aa]" title={item.primaryReason || ''}>{item.primaryReason || '—'}</span>
                </button>
              );
            })}
            {!rows.length && <div className="py-10 text-center text-[7px] uppercase tracking-[0.08em] text-[#4f585f]">No matching audit records</div>}
          </section>

          <aside className="min-h-0 overflow-auto bg-[#070809] font-mono">
            <div className="sticky top-0 border-b border-[#24282c] bg-[#090a0b] px-2.5 py-2 text-[6px] uppercase tracking-[0.08em] text-[#59636b]">TRACE INSPECTOR</div>
            {selected ? (
              <div className="space-y-2 p-2.5">
                <TraceSection title="DECISION">
                  <KeyRows rows={[
                    ['MARKET', selected.market], ['ACTION', selected.decision], ['ROUTE', selected.strategyDisposition || '—'], ['REGIME', selected.regime || '—'], ['RISK', selected.riskDisposition || '—'], ['TRADE CASE', selected.tradeCaseId || 'NOT LINKED'], ['COUNCIL', selected.councilRunId || 'NOT LINKED'], ['INTEL', selected.intelligencePackageId || 'NOT LINKED'],
                  ]} />
                </TraceSection>
                <TraceSection title="AUDIT COMPLETENESS">
                  <KeyRows rows={[
                    ['SCORE', `${selected.auditCompleteness?.score ?? 0}%`], ['GRADE', selected.auditCompleteness?.grade || '—'], ['PASSED', `${selected.auditCompleteness?.passed ?? 0}/${selected.auditCompleteness?.applicable ?? 0}`], ['MISSING', (selected.auditCompleteness?.missing || []).join(', ') || 'none'],
                  ]} />
                </TraceSection>
                <TraceSection title="DIMENSIONS">
                  <div className="space-y-1">{(selected.auditCompleteness?.dimensions || []).map((item: any) => <div key={item.id} className="grid grid-cols-[110px_72px_1fr] gap-2 border-b border-[#15191c] pb-1 text-[6.5px]"><span className="text-[#68727a]">{item.id}</span><span className={item.state === 'PASS' ? 'text-[#62d49f]' : item.state === 'MISSING' ? 'text-[#ff6262]' : 'text-[#77818a]'}>{item.state}</span><span className="text-[#879199]">{item.reason}</span></div>)}</div>
                </TraceSection>
                <TraceSection title="REASONS / EVIDENCE">
                  <div className="space-y-1 text-[6.5px] leading-4 text-[#879199]">{[selected.primaryReason, ...(selected.reasons || []), ...(selected.riskReasons || []).map((item: string) => `Risk: ${item}`), ...(selected.evidenceIds || []).map((item: string) => `Evidence: ${item}`)].filter(Boolean).map((item: string, index: number) => <div key={`${item}-${index}`}>{item}</div>)}</div>
                </TraceSection>
              </div>
            ) : <div className="p-5 text-[7px] text-[#4f585f]">No audit record selected.</div>}
          </aside>
        </div>
      </div>
    </div>
  );
};

const TraceSection = ({ title, children }: React.PropsWithChildren<{ title: string }>) => <section className="border border-[#20252a] bg-[#050607]"><div className="border-b border-[#20252a] px-2 py-1.5 text-[6px] uppercase tracking-[0.08em] text-[#59636b]">{title}</div><div className="p-2">{children}</div></section>;
const KeyRows = ({ rows }: { rows: Array<[string, string]> }) => <div className="space-y-1">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[100px_minmax(0,1fr)] gap-2 border-b border-[#15191c] pb-1 text-[6.5px]"><span className="text-[#626c74]">{label}</span><span className="break-all text-[#aab2b8]">{value}</span></div>)}</div>;
