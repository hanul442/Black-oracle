import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Database,
  XCircle,
} from 'lucide-react';
import {
  cn,
  dateTime,
  decimal,
  eventTags,
  eventTypeKo,
  LedgerEvent,
  pct,
  scoreHex,
  scoreText,
  TradeMap,
} from './types';
import { formatKrw } from './financial';

export const Screen = ({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) => (
  <div className={cn('h-full overflow-y-auto pb-[calc(88px+env(safe-area-inset-bottom))] pt-[max(env(safe-area-inset-top),18px)]', padded && 'px-4')}>{children}</div>
);

export const Header = ({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: () => void; right?: React.ReactNode }) => (
  <div className="mb-5 flex items-start justify-between gap-4">
    <div className="min-w-0">
      {back && <button type="button" onClick={back} className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#111418] shadow-sm"><ArrowLeft className="h-5 w-5" /></button>}
      <h1 className="text-[26px] font-semibold tracking-[-0.05em] text-[#13171b]">{title}</h1>
      {subtitle && <p className="mt-1 text-[12px] leading-5 text-[#9299a1]">{subtitle}</p>}
    </div>
    {right}
  </div>
);

export const DetailShell = ({ title, subtitle, onBack, right, children }: { title: string; subtitle?: string; onBack: () => void; right?: React.ReactNode; children: React.ReactNode }) => (
  <div className="h-full overflow-y-auto bg-[#f7f8f9] px-4 pb-[max(env(safe-area-inset-bottom),28px)] pt-[max(env(safe-area-inset-top),18px)]">
    <Header title={title} subtitle={subtitle} back={onBack} right={right} />
    {children}
  </div>
);

export const SectionTitle = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
  <div className="mb-3 flex items-center justify-between">
    <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[#171a1f]">{title}</h2>
    {action && <button type="button" onClick={onAction} className="text-[12px] font-medium text-[#87909a]">{action} ›</button>}
  </div>
);

export const Pill = ({ children, active = false, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) => {
  const className = cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-medium transition', active ? 'bg-[#101820] text-white' : 'bg-[#f0f3f5] text-[#66717b]', onClick && 'cursor-pointer active:scale-[0.98]');
  return onClick ? <button type="button" onClick={onClick} className={className}>{children}</button> : <span className={className}>{children}</span>;
};

export const EmptyCard = ({ title, body }: { title: string; body: string }) => (
  <div className="rounded-2xl border border-[#edf0f2] bg-white px-4 py-8 text-center shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
    <div className="text-[13px] font-semibold text-[#343a40]">{title}</div>
    <div className="mx-auto mt-2 max-w-[280px] text-[11px] leading-5 text-[#98a0a8]">{body}</div>
  </div>
);

export const Metric = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div>
    <div className="text-[9px] font-medium text-[#9aa2aa]">{label}</div>
    <div className="mt-1 text-[12px] font-semibold tracking-[-0.02em] text-[#2d343b]" style={accent ? { color: accent } : undefined}>{value}</div>
  </div>
);

export const Sparkline = ({ values, positive = true, className = '' }: { values: number[]; positive?: boolean; className?: string }) => {
  const cleaned = values.filter((value) => Number.isFinite(value));
  const data = cleaned.length >= 2 ? cleaned : [0.35, 0.48, 0.44, 0.61, 0.58, 0.72];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(max - min, 0.0001);
  const points = data.map((value, index) => `${(index / (data.length - 1)) * 100},${36 - ((value - min) / span) * 30}`).join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={cn('h-12 w-full overflow-visible', className)} aria-hidden="true">
      <polyline points={points} fill="none" stroke={positive ? '#21b58a' : '#ef5b66'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const ScoreGauge = ({ label, value, max = 100, compact = false }: { label: string; value: number | null | undefined; max?: 100 | 1; compact?: boolean }) => {
  const normalized = value == null || !Number.isFinite(value) ? 0 : Math.max(0, Math.min(100, max === 1 ? value * 100 : value));
  const radius = compact ? 20 : 27;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * normalized / 100;
  const size = compact ? 52 : 70;
  const color = scoreHex(value, max);
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
          <circle cx="36" cy="36" r={radius} fill="none" stroke="#edf1f3" strokeWidth={compact ? 6 : 7} />
          <circle cx="36" cy="36" r={radius} fill="none" stroke={color} strokeWidth={compact ? 6 : 7} strokeLinecap="round" strokeDasharray={`${dash} ${circumference - dash}`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold" style={{ color }}>{value == null || !Number.isFinite(value) ? '—' : max === 1 ? `${Math.round(value * 100)}` : `${Math.round(value)}`}</div>
      </div>
      <div className="mt-1 text-[9px] font-medium text-[#8f98a1]">{label}</div>
    </div>
  );
};

export const ScoreBar = ({ label, value, max = 100 }: { label: string; value: number | null | undefined; max?: 100 | 1 }) => {
  const normalized = value == null || !Number.isFinite(value) ? 0 : Math.max(0, Math.min(100, max === 1 ? value * 100 : value));
  const color = scoreHex(value, max);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[10px]"><span className="text-[#7d8791]">{label}</span><span className="font-semibold" style={{ color }}>{value == null || !Number.isFinite(value) ? '—' : max === 1 ? `${decimal.format(value * 100)}%` : scoreText(value)}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-[#edf1f3]"><div className="h-full rounded-full transition-all" style={{ width: `${normalized}%`, backgroundColor: color }} /></div>
    </div>
  );
};

export const StatusChip = ({ value }: { value: string | null | undefined }) => {
  const upper = String(value ?? '').toUpperCase();
  const good = ['APPROVE', 'ENTER', 'BUY', 'PASS', 'OK', 'BULLISH'].includes(upper);
  const bad = ['REJECT', 'EXIT', 'SELL', 'ERROR', 'CRITICAL', 'BEARISH'].includes(upper);
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold', good ? 'bg-[#e7f8f2] text-[#078a68]' : bad ? 'bg-[#fff0f1] text-[#c84d59]' : 'bg-[#fff6e7] text-[#a86d12]')}>{value || '—'}</span>;
};

export const CheckRow = ({ good, label }: { good: boolean; label: string }) => (
  <div className="flex items-start gap-2 rounded-xl bg-white px-3 py-3 text-[11px] leading-5 text-[#68727c]">
    {good ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16a57b]" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#d56b73]" />}
    <span>{label}</span>
  </div>
);

export const ReasonCard = ({ title, body, icon }: { title: string; body: string; icon?: React.ReactNode }) => (
  <div className="rounded-[18px] border border-[#edf0f2] bg-white p-4">
    <div className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef2f5] text-[#43505b]">{icon ?? <Database className="h-4 w-4" />}</span>
      <div><div className="text-[11px] font-semibold text-[#343b42]">{title}</div><div className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-[#7d8791]">{body}</div></div>
    </div>
  </div>
);

export const TagRow = ({ tags }: { tags: string[] }) => <div className="flex flex-wrap gap-1.5">{tags.map((tag) => <span key={tag} className="rounded-md bg-[#eef2f4] px-2 py-1 text-[9px] font-semibold text-[#67727c]">#{tag}</span>)}</div>;

const flatten = (input: unknown, prefix = '', depth = 0): Array<[string, string]> => {
  if (depth > 3 || input == null) return [];
  if (Array.isArray(input)) return input.slice(0, 12).flatMap((value, index) => flatten(value, `${prefix}[${index}]`, depth + 1));
  if (typeof input === 'object') return Object.entries(input as Record<string, unknown>).slice(0, 30).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value != null && typeof value === 'object') return flatten(value, path, depth + 1);
    return [[path, String(value)]] as Array<[string, string]>;
  });
  return [[prefix || 'value', String(input)]];
};

export const EventCard = ({ event, onClick }: { event: LedgerEvent; onClick?: () => void }) => (
  <button type="button" onClick={onClick} className="w-full rounded-[18px] border border-[#edf0f2] bg-white p-4 text-left shadow-[0_7px_22px_rgba(15,23,42,0.035)] active:scale-[0.995]">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><span className="text-[10px] font-semibold text-[#65717c]">{eventTypeKo(event.eventType)}</span>{event.market && <span className="text-[10px] font-semibold text-[#151a1f]">{event.market}</span>}</div>
        <div className="mt-2 text-[13px] font-semibold leading-5 text-[#272d33]">{event.summary}</div>
        {event.reason && <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#8e98a1]">{event.reason}</div>}
        <div className="mt-3"><TagRow tags={eventTags(event)} /></div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2"><span className="text-[9px] text-[#a0a7ae]">{dateTime(event.occurredAt)}</span><ChevronRight className="h-4 w-4 text-[#b2b8be]" /></div>
    </div>
  </button>
);

export const EventTrace = ({ event }: { event: LedgerEvent }) => {
  const rows = [...flatten(event.trace ?? {}), ...flatten(event.links ?? {}, 'links')].slice(0, 50);
  if (!rows.length) return <EmptyCard title="추가 추적 정보 없음" body="이 이벤트에는 summary와 reason 외 별도 trace 필드가 저장되지 않았습니다." />;
  return <div className="overflow-hidden rounded-[18px] border border-[#edf0f2] bg-white">{rows.map(([key, value], index) => <div key={`${key}-${index}`} className={cn('grid grid-cols-[120px_1fr] gap-3 px-4 py-3 text-[10px]', index !== rows.length - 1 && 'border-b border-[#f0f2f4]')}><div className="break-words font-medium text-[#8a949d]">{key}</div><div className="break-words text-[#4b5660]">{value}</div></div>)}</div>;
};

export const ProtectionCard = ({ tradeMap }: { tradeMap: TradeMap | null | undefined }) => {
  if (!tradeMap || (!tradeMap.stopLossPrice && !tradeMap.takeProfit1Price && !tradeMap.takeProfit2Price)) return <EmptyCard title="보호 가격 대기 중" body="현재 판단에는 손절가 / 1차 익절가 / 2차 익절가가 포함된 Trade Map이 없습니다." />;
  return (
    <div className="rounded-[20px] border border-[#edf0f2] bg-white p-4">
      <div className="flex items-center justify-between"><div><div className="text-[12px] font-semibold">동적 보호 계획</div><div className="mt-1 text-[9px] text-[#98a1aa]">아래 값은 모두 자산 1개당 가격이며 거래금액이 아닙니다.</div></div><StatusChip value={tradeMap.status} /></div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4"><Metric label="기준 진입가 · 1개당" value={formatKrw(tradeMap.entryPrice)} /><Metric label="손절가 · 1개당" value={formatKrw(tradeMap.stopLossPrice)} accent="#d95360" /><Metric label="1차 익절가 · 1개당" value={formatKrw(tradeMap.takeProfit1Price)} accent="#0a9f79" /><Metric label="2차 익절가 · 1개당" value={formatKrw(tradeMap.takeProfit2Price)} accent="#087fbf" /></div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#f0f2f4] pt-3"><Metric label="손절 폭" value={pct(tradeMap.expectedRiskPct)} /><Metric label="1차 목표 R" value={scoreText(tradeMap.riskReward1)} /><Metric label="2차 목표 R" value={scoreText(tradeMap.riskReward2)} /></div>
    </div>
  );
};

export const WarningCard = ({ title, body }: { title: string; body: string }) => <div className="rounded-[18px] border border-[#f4dfba] bg-[#fff8ed] p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b87a1e]" /><div><div className="text-[11px] font-semibold text-[#7e561d]">{title}</div><div className="mt-1 text-[10px] leading-5 text-[#9b743c]">{body}</div></div></div></div>;
