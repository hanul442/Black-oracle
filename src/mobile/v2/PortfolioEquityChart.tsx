import React from 'react';
import { cn } from './types';
import { formatKrw } from './financial';

type PortfolioEquityChartProps = {
  values: number[];
  positive?: boolean;
  className?: string;
};

export const PortfolioEquityChart = ({ values, positive = true, className = '' }: PortfolioEquityChartProps) => {
  const data = values.filter((value) => Number.isFinite(value) && value > 0);
  if (data.length < 2) {
    return (
      <div className={cn('flex h-36 items-center justify-center rounded-2xl bg-[#f7f8f9] px-5 text-center text-[9px] leading-5 text-[#9aa2aa]', className)}>
        자산곡선 표본이 2개 미만입니다. 임의 곡선이나 보간값은 표시하지 않습니다.
      </div>
    );
  }

  const width = 320;
  const height = 176;
  const top = 12;
  const equityBottom = 104;
  const drawdownTop = 128;
  const drawdownBottom = 160;
  const rawMin = Math.min(...data);
  const rawMax = Math.max(...data);
  const rawSpan = Math.max(rawMax - rawMin, Math.max(Math.abs(rawMax), 1) * 0.0005);
  const padding = rawSpan * 0.12;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min;
  const xFor = (index: number) => (index / (data.length - 1)) * width;
  const yFor = (value: number) => top + ((max - value) / span) * (equityBottom - top);
  const points = data.map((value, index) => `${xFor(index)},${yFor(value)}`).join(' ');
  const areaPoints = `0,${equityBottom} ${points} ${width},${equityBottom}`;

  let runningPeak = data[0];
  const drawdowns = data.map((value) => {
    runningPeak = Math.max(runningPeak, value);
    return runningPeak > 0 ? value / runningPeak - 1 : 0;
  });
  const worstDrawdown = Math.min(...drawdowns, 0);
  const drawdownSpan = Math.max(Math.abs(worstDrawdown), 0.0001);
  const drawdownY = (value: number) => drawdownTop + (Math.abs(value) / drawdownSpan) * (drawdownBottom - drawdownTop);
  const drawdownPoints = drawdowns.map((value, index) => `${xFor(index)},${drawdownY(value)}`).join(' ');
  const drawdownArea = `0,${drawdownTop} ${drawdownPoints} ${width},${drawdownTop}`;

  const start = data[0];
  const current = data[data.length - 1];
  const peak = rawMax;
  const currentDelta = start !== 0 ? current / start - 1 : null;
  const lineColor = positive ? '#0aa77d' : '#dc5a66';
  const fillColor = positive ? 'rgba(10,167,125,0.08)' : 'rgba(220,90,102,0.08)';

  return (
    <div className={cn('rounded-2xl bg-[#fbfcfc] px-2 pb-2 pt-3', className)}>
      <div className="mb-2 flex items-end justify-between px-2">
        <div>
          <div className="text-[9px] font-medium text-[#9aa2aa]">Paper equity + drawdown history</div>
          <div className="mt-1 text-[11px] font-semibold text-[#303840]">{currentDelta == null ? '—' : `${currentDelta > 0 ? '+' : ''}${(currentDelta * 100).toFixed(2)}%`}</div>
        </div>
        <div className="text-right"><div className="text-[9px] text-[#9aa2aa]">현재</div><div className="mt-1 text-[11px] font-semibold text-[#303840]">{formatKrw(current)}</div></div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-44 w-full overflow-visible" role="img" aria-label={`포트폴리오 자산곡선과 드로다운. 현재 ${formatKrw(current)}, 최대 드로다운 ${(worstDrawdown * 100).toFixed(2)}%`}>
        {[0.25, 0.5, 0.75].map((ratio) => { const y = top + (equityBottom - top) * ratio; return <line key={ratio} x1="0" x2={width} y1={y} y2={y} stroke="#edf0f2" strokeWidth="1" />; })}
        <polygon points={areaPoints} fill={fillColor} />
        <polyline points={points} fill="none" stroke={lineColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={width} cy={yFor(current)} r="3.2" fill={lineColor} stroke="#ffffff" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />

        <line x1="0" x2={width} y1={drawdownTop - 8} y2={drawdownTop - 8} stroke="#e5e9ec" strokeWidth="1" />
        <text x="0" y={drawdownTop - 11} fontSize="8" fill="#8f98a1">Drawdown</text>
        <polygon points={drawdownArea} fill="rgba(220,90,102,0.10)" />
        <polyline points={drawdownPoints} fill="none" stroke="#c96a73" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="grid grid-cols-4 gap-2 border-t border-[#eef1f3] px-2 pt-2 text-center">
        <div><div className="text-[8px] text-[#a0a7ae]">시작</div><div className="mt-1 truncate text-[9px] font-semibold text-[#5b6570]">{formatKrw(start)}</div></div>
        <div><div className="text-[8px] text-[#a0a7ae]">최고</div><div className="mt-1 truncate text-[9px] font-semibold text-[#5b6570]">{formatKrw(peak)}</div></div>
        <div><div className="text-[8px] text-[#a0a7ae]">MDD</div><div className="mt-1 truncate text-[9px] font-semibold text-[#c85b65]">{(worstDrawdown * 100).toFixed(2)}%</div></div>
        <div><div className="text-[8px] text-[#a0a7ae]">현재</div><div className="mt-1 truncate text-[9px] font-semibold" style={{ color: lineColor }}>{formatKrw(current)}</div></div>
      </div>
    </div>
  );
};