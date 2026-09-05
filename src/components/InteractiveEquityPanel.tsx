import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Crosshair, TrendingDown, WalletCards } from 'lucide-react';

type EquityPoint = { timestamp: number; equity: number };
type StatusPayload = { equityCurve?: EquityPoint[]; portfolio?: { initialEquity?: number } };

const money = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const krw = (value: number) => `₩${money.format(value)}`;
const pct = (value: number, signed = false) => `${signed && value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
const stamp = (timestamp: number) => new Intl.DateTimeFormat('ko-KR', {
  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(timestamp));

export const InteractiveEquityPanel: React.FC = () => {
  const [points, setPoints] = useState<EquityPoint[]>([]);
  const [initialEquity, setInitialEquity] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/trading-status', { cache: 'no-store' });
        const payload = await response.json() as StatusPayload;
        if (cancelled) return;
        const clean = (payload.equityCurve || [])
          .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.equity))
          .sort((a, b) => a.timestamp - b.timestamp);
        setPoints(clean);
        setInitialEquity(Number(payload.portfolio?.initialEquity || clean[0]?.equity || 0));
        setSelectedIndex((previous) => previous == null ? (clean.length ? clean.length - 1 : null) : Math.min(previous, Math.max(0, clean.length - 1)));
      } catch {
        if (!cancelled) setPoints([]);
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const model = useMemo(() => {
    if (!points.length) return { plotted: [] as Array<EquityPoint & { x: number; y: number; drawdown: number; returnPct: number }>, min: 0, max: 0 };
    const values = points.map((point) => point.equity);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    const startTime = points[0].timestamp;
    const endTime = points[points.length - 1].timestamp;
    const timeRange = Math.max(1, endTime - startTime);
    let peak = points[0].equity;
    const plotted = points.map((point) => {
      peak = Math.max(peak, point.equity);
      const drawdown = peak > 0 ? Math.max(0, (peak - point.equity) / peak) : 0;
      const returnPct = initialEquity > 0 ? point.equity / initialEquity - 1 : 0;
      return {
        ...point,
        x: ((point.timestamp - startTime) / timeRange) * 1000,
        y: 250 - ((point.equity - min) / range) * 220 - 15,
        drawdown,
        returnPct,
      };
    });
    return { plotted, min, max };
  }, [points, initialEquity]);

  const selected = selectedIndex == null ? null : model.plotted[selectedIndex] || null;
  const path = model.plotted.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

  const selectFromPointer = (clientX: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || !model.plotted.length) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const targetX = ratio * 1000;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    model.plotted.forEach((point, index) => {
      const distance = Math.abs(point.x - targetX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    setSelectedIndex(nearestIndex);
  };

  return (
    <section className="shrink-0 border-b border-white/[0.06] bg-[#06090D] px-4 py-3 md:px-6 xl:px-8">
      <div className="mx-auto max-w-[1520px]">
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.18em] text-[#70CAD2]">
              <Activity className="h-3.5 w-3.5" /> Interactive equity trace
            </div>
            <div className="mt-1 text-[11px] text-[#77818C]">Tap or move across the chart to inspect the persisted Paper checkpoint at that point.</div>
          </div>
          <div className="font-mono text-[6px] uppercase tracking-[0.11em] text-[#4F5963]">{points.length} persisted points · local inspector</div>
        </div>

        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div
            ref={frameRef}
            onPointerMove={(event) => selectFromPointer(event.clientX)}
            onPointerDown={(event) => selectFromPointer(event.clientX)}
            className="relative h-[210px] touch-none overflow-hidden border border-white/[0.06] bg-[#05080C] md:h-[250px]"
          >
            <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.024) 1px, transparent 1px)', backgroundSize: '20% 25%' }} />
            {model.plotted.length >= 2 ? (
              <svg viewBox="0 0 1000 250" preserveAspectRatio="none" className="relative h-full w-full">
                <path d={path} fill="none" stroke="#8DAAB0" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                {selected && (
                  <>
                    <line x1={selected.x} y1="0" x2={selected.x} y2="250" stroke="#C7A96B" strokeOpacity="0.7" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    <circle cx={selected.x} cy={selected.y} r="5" fill="#05080C" stroke="#C7A96B" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  </>
                )}
              </svg>
            ) : (
              <div className="relative flex h-full items-center justify-center font-mono text-[7px] uppercase tracking-[0.13em] text-[#4F5963]">Awaiting equity history</div>
            )}
          </div>

          <aside className="border border-white/[0.06] bg-[#080C11] p-3.5">
            <div className="flex items-center gap-2 font-mono text-[6px] uppercase tracking-[0.15em] text-[#59636D]"><Crosshair className="h-3 w-3" /> Selected checkpoint</div>
            {selected ? (
              <div className="mt-3 space-y-2">
                <InspectorRow icon={WalletCards} label="EQUITY" value={krw(selected.equity)} />
                <InspectorRow icon={Activity} label="TOTAL P&L" value={pct(selected.returnPct, true)} tone={selected.returnPct >= 0 ? 'positive' : 'negative'} />
                <InspectorRow icon={TrendingDown} label="DRAWDOWN" value={pct(selected.drawdown)} tone={selected.drawdown > 0 ? 'negative' : undefined} />
                <div className="border-t border-white/[0.055] pt-2 font-mono text-[7px] text-[#68737D]">{stamp(selected.timestamp)}</div>
                <div className="text-[8px] leading-relaxed text-[#4F5963]">This inspector uses persisted equity history only. It does not infer missing trades or market events.</div>
              </div>
            ) : (
              <div className="mt-4 font-mono text-[7px] uppercase tracking-[0.12em] text-[#4F5963]">No checkpoint selected.</div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
};

const InspectorRow = ({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone?: 'positive' | 'negative' }) => (
  <div className="flex items-center justify-between gap-3 border border-white/[0.05] bg-[#05080C] px-3 py-2.5">
    <span className="flex items-center gap-2 font-mono text-[6px] uppercase tracking-[0.12em] text-[#59636D]"><Icon className="h-3 w-3" />{label}</span>
    <span className={`font-mono text-[9px] ${tone === 'positive' ? 'text-[#72B6A0]' : tone === 'negative' ? 'text-[#D66565]' : 'text-[#AAB3BC]'}`}>{value}</span>
  </div>
);
