import React, { useMemo, useState } from 'react';
import { cn } from '../v2/types';
import { formatKrw } from '../v2/financial';

type Point = { timestamp: number; equity: number };
type Range = '1D' | '1W' | '1M' | 'ALL';

const RANGE_MS: Partial<Record<Range, number>> = {
  '1D': 24 * 60 * 60_000,
  '1W': 7 * 24 * 60 * 60_000,
  '1M': 30 * 24 * 60 * 60_000,
};

const signedPct = (value: number | null) => value == null || !Number.isFinite(value)
  ? '—'
  : `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;

export const PortfolioPerformanceChart = ({
  points,
  compact = false,
  className = '',
}: {
  points: Point[];
  compact?: boolean;
  className?: string;
}) => {
  const [range, setRange] = useState<Range>('ALL');
  const cleaned = useMemo(() => points
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.equity) && point.timestamp > 0 && point.equity > 0)
    .sort((a, b) => a.timestamp - b.timestamp), [points]);

  const filtered = useMemo(() => {
    if (range === 'ALL' || cleaned.length < 2) return cleaned;
    const end = cleaned[cleaned.length - 1]?.timestamp ?? Date.now();
    const start = end - (RANGE_MS[range] ?? 0);
    return cleaned.filter((point) => point.timestamp >= start);
  }, [cleaned, range]);

  const active = filtered.length >= 2 ? filtered : [];
  const insufficientRange = cleaned.length >= 2 && filtered.length < 2;

  if (cleaned.length < 2) {
    return (
      <div className={cn('rounded-[22px] border border-[#edf0f2] bg-white p-5', className)}>
        <div className="text-[13px] font-semibold text-[#303840]">운용 성과</div>
        <div className="mt-5 flex h-28 items-center justify-center rounded-2xl bg-[#f7f8f9] px-5 text-center text-[11px] leading-5 text-[#8d969e]">
          자산곡선 표본이 2개 미만입니다. 임의 곡선이나 보간값은 표시하지 않습니다.
        </div>
      </div>
    );
  }

  const source = active.length >= 2 ? active : cleaned;
  const width = 340;
  const equityTop = 16;
  const equityBottom = compact ? 122 : 142;
  const drawdownTop = equityBottom + 22;
  const drawdownBottom = compact ? 174 : 204;
  const rawMin = Math.min(...source.map((point) => point.equity));
  const rawMax = Math.max(...source.map((point) => point.equity));
  const rawSpan = Math.max(rawMax - rawMin, Math.max(Math.abs(rawMax), 1) * 0.0005);
  const pad = rawSpan * 0.1;
  const min = rawMin - pad;
  const max = rawMax + pad;
  const span = max - min;
  const xFor = (index: number) => source.length === 1 ? 0 : (index / (source.length - 1)) * width;
  const yFor = (equity: number) => equityTop + ((max - equity) / span) * (equityBottom - equityTop);

  let runningPeak = source[0].equity;
  const drawdowns = source.map((point) => {
    runningPeak = Math.max(runningPeak, point.equity);
    return runningPeak > 0 ? point.equity / runningPeak - 1 : 0;
  });
  const worstDrawdown = Math.min(...drawdowns, 0);
  const ddSpan = Math.max(Math.abs(worstDrawdown), 0.0001);
  const ddY = (value: number) => drawdownTop + (Math.abs(value) / ddSpan) * (drawdownBottom - drawdownTop);

  const equityPoints = source.map((point, index) => `${xFor(index)},${yFor(point.equity)}`).join(' ');
  const areaPoints = `0,${equityBottom} ${equityPoints} ${width},${equityBottom}`;
  const drawdownPoints = source.map((_, index) => `${xFor(index)},${ddY(drawdowns[index])}`).join(' ');
  const drawdownArea = `0,${drawdownTop} ${drawdownPoints} ${width},${drawdownTop}`;

  const start = source[0].equity;
  const current = source[source.length - 1].equity;
  const change = start > 0 ? current / start - 1 : null;
  const positive = (change ?? 0) >= 0;
  const line = positive ? '#0aa77d' : '#dc5a66';
  const fill = positive ? 'rgba(10,167,125,0.07)' : 'rgba(220,90,102,0.07)';
  const height = compact ? 182 : 214;

  return (
    <div className={cn('rounded-[22px] border border-[#edf0f2] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.035)]', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-[#303840]">운용 성과</div>
          <div className="mt-1 text-[12px] font-semibold" style={{ color: line }}>{signedPct(change)}</div>
        </div>
        <div className="flex rounded-xl bg-[#f3f5f6] p-1">
          {(['1D', '1W', '1M', 'ALL'] as Range[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={cn('min-h-8 rounded-lg px-2.5 text-[11px] font-semibold transition', range === item ? 'bg-white text-[#151a1f] shadow-sm' : 'text-[#7d8791]')}
            >
              {item === 'ALL' ? '전체' : item}
            </button>
          ))}
        </div>
      </div>

      {insufficientRange && range !== 'ALL' && (
        <div className="mt-3 rounded-xl bg-[#fff8ed] px-3 py-2 text-[11px] leading-5 text-[#91672a]">
          선택 기간에는 자산곡선 표본이 부족해 전체 구간을 임시 표시합니다.
        </div>
      )}

      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn('mt-3 w-full overflow-visible', compact ? 'h-[182px]' : 'h-[214px]')} role="img" aria-label={`포트폴리오 자산곡선 ${signedPct(change)}, 최대 드로다운 ${signedPct(worstDrawdown)}`}>
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = equityTop + (equityBottom - equityTop) * ratio;
          return <line key={ratio} x1="0" x2={width} y1={y} y2={y} stroke="#eef1f3" strokeWidth="1" />;
        })}
        <polygon points={areaPoints} fill={fill} />
        <polyline points={equityPoints} fill="none" stroke={line} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={width} cy={yFor(current)} r="3.1" fill={line} stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />

        <line x1="0" x2={width} y1={drawdownTop - 8} y2={drawdownTop - 8} stroke="#e8ecef" strokeWidth="1" />
        <text x="0" y={drawdownTop - 12} fontSize="9" fill="#8f98a1">Drawdown</text>
        <polygon points={drawdownArea} fill="rgba(220,90,102,0.10)" />
        <polyline points={drawdownPoints} fill="none" stroke="#c96a73" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="grid grid-cols-4 gap-2 border-t border-[#eef1f3] pt-3 text-center">
        <div><div className="text-[10px] text-[#8f98a1]">시작</div><div className="mt-1 truncate text-[11px] font-semibold">{formatKrw(start)}</div></div>
        <div><div className="text-[10px] text-[#8f98a1]">최고</div><div className="mt-1 truncate text-[11px] font-semibold">{formatKrw(rawMax)}</div></div>
        <div><div className="text-[10px] text-[#8f98a1]">MDD</div><div className="mt-1 truncate text-[11px] font-semibold text-[#c85b65]">{signedPct(worstDrawdown)}</div></div>
        <div><div className="text-[10px] text-[#8f98a1]">현재</div><div className="mt-1 truncate text-[11px] font-semibold" style={{ color: line }}>{formatKrw(current)}</div></div>
      </div>
    </div>
  );
};