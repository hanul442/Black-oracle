import React from 'react';

const fmtKrw = (value: number | null | undefined) => value == null || !Number.isFinite(Number(value))
  ? '—'
  : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Number(value));

const signedPct = (value: number | null | undefined, digits = 2) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number >= 0 ? '+' : ''}${(number * 100).toFixed(digits)}%`;
};

const priceDistance = (current: number, target: number | null | undefined) => {
  const value = Number(target);
  if (!Number.isFinite(current) || current <= 0 || !Number.isFinite(value) || value <= 0) return '—';
  return signedPct((value - current) / current);
};

const formatOpenedAt = (timestamp: number | null | undefined) => {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const holdingAge = (timestamp: number | null | undefined) => {
  if (!timestamp) return '—';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
};

const sourceLabel = (position: any, decision: any) => {
  if (String(position.market ?? '').startsWith('KRW-')) {
    const observedAt = Number(decision?.liquidity?.marketDataTimestamp ?? 0);
    return {
      label: 'UPBIT · LIVE',
      sub: observedAt > 0 ? `observed ${formatOpenedAt(observedAt)}` : 'latest checkpoint mark',
    };
  }
  return {
    label: 'CHECKPOINT MARK',
    sub: 'provider provenance unavailable on legacy position mark',
  };
};

const observedValueArea = (decision: any) => {
  const low = Number(decision?.microstructure?.valueAreaLow);
  const high = Number(decision?.microstructure?.valueAreaHigh);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= low) return null;
  return { low, high };
};

const zoneState = (markPrice: number, zone: { low: number; high: number } | null) => {
  if (!zone) return 'DATA GAP';
  if (markPrice < zone.low) return 'BELOW VALUE AREA';
  if (markPrice > zone.high) return 'ABOVE VALUE AREA';
  return 'IN VALUE AREA';
};

const Cell = ({ label, value, sub, valueClass = 'text-[#D8E0E5]' }: { label: string; value: string; sub?: string; valueClass?: string }) => (
  <div className="min-w-0 border border-white/[0.055] bg-white/[0.012] px-3 py-2.5">
    <div className="font-mono text-[7px] uppercase tracking-[0.14em] text-[#59656F]">{label}</div>
    <div className={`mt-1 truncate font-mono text-[10px] ${valueClass}`}>{value}</div>
    {sub && <div className="mt-1 truncate text-[7px] text-[#4E5963]">{sub}</div>}
  </div>
);

export const PositionTradeCard = ({ position, decisions, onOpen }: { position: any; decisions: any[]; onOpen: () => void }) => {
  const markPrice = Number(position.markPrice ?? 0);
  const entryPrice = Number(position.entryPrice ?? 0);
  const ret = entryPrice > 0 ? (markPrice - entryPrice) / entryPrice : 0;
  const decision = decisions.find((item) => item.market === position.market) ?? null;
  const zone = observedValueArea(decision);
  const zoneStatus = zoneState(markPrice, zone);
  const source = sourceLabel(position, decision);
  const finalTarget = position.takeProfitPrice ?? position.takeProfit2Price ?? decision?.tradeMap?.takeProfit2Price ?? null;
  const structuralInvalidation = decision?.tradeMap?.structuralInvalidationPrice ?? null;
  const mapEntry = decision?.tradeMap?.entryPrice ?? null;
  const initialStop = position.initialStopLossPrice ?? null;
  const pnlPositive = Number(position.unrealizedPnl ?? 0) >= 0;

  return (
    <button onClick={onOpen} className="block w-full px-4 py-4 text-left transition-colors hover:bg-white/[0.015]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-mono text-[11px] text-[#EDF1F4]">{position.market}</div>
            <div className="border border-white/[0.07] px-1.5 py-0.5 font-mono text-[6px] uppercase tracking-[0.12em] text-[#66727C]">{source.label}</div>
          </div>
          <div className="mt-1 text-[8px] text-[#4F5A64]">{source.sub}</div>
        </div>
        <div className="text-right">
          <div className={`font-mono text-[13px] ${pnlPositive ? 'text-[#77B9A5]' : 'text-[#D07D7D]'}`}>{signedPct(ret)}</div>
          <div className={`mt-1 font-mono text-[8px] ${pnlPositive ? 'text-[#5E9C8B]' : 'text-[#B66E6E]'}`}>{Number(position.unrealizedPnl ?? 0) >= 0 ? '+' : ''}₩{fmtKrw(position.unrealizedPnl)}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Cell label="Current" value={`₩${fmtKrw(markPrice)}`} sub={position.updatedAt ? `mark ${formatOpenedAt(position.updatedAt)}` : 'latest checkpoint mark'} />
        <Cell label="Entry" value={`₩${fmtKrw(entryPrice)}`} sub={formatOpenedAt(position.openedAt)} />
        <Cell label="Holding" value={holdingAge(position.openedAt)} sub={`${Number(position.quantity ?? 0).toFixed(6)} units`} />
        <Cell label="Value Area" value={zone ? `₩${fmtKrw(zone.low)}–${fmtKrw(zone.high)}` : 'DATA GAP'} sub={zoneStatus} valueClass={zone ? 'text-[#C4CDD3]' : 'text-[#C7AA71]'} />
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        <Cell label="Stop Loss" value={position.stopLossPrice == null ? '—' : `₩${fmtKrw(position.stopLossPrice)}`} sub={`from now ${priceDistance(markPrice, position.stopLossPrice)}`} valueClass="text-[#D08B8B]" />
        <Cell label="TP1" value={position.takeProfit1Price == null ? '—' : `₩${fmtKrw(position.takeProfit1Price)}`} sub={position.takeProfit1Taken ? 'TAKEN' : `from now ${priceDistance(markPrice, position.takeProfit1Price)}`} valueClass="text-[#8ABAAA]" />
        <Cell label="TP2" value={position.takeProfit2Price == null ? '—' : `₩${fmtKrw(position.takeProfit2Price)}`} sub={`from now ${priceDistance(markPrice, position.takeProfit2Price)}`} valueClass="text-[#8ABAAA]" />
        <Cell label="Final Target" value={finalTarget == null ? '—' : `₩${fmtKrw(finalTarget)}`} sub={`from now ${priceDistance(markPrice, finalTarget)}`} />
        <Cell label="Invalidation" value={structuralInvalidation == null ? '—' : `₩${fmtKrw(structuralInvalidation)}`} sub="latest Trade Map" />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.045] pt-2 font-mono text-[7px] text-[#59656F]">
        <span>map entry {mapEntry == null ? '—' : `₩${fmtKrw(mapEntry)}`}</span>
        <span>initial SL {initialStop == null ? '—' : `₩${fmtKrw(initialStop)}`}</span>
        <span>protection rev {position.protectionRevision ?? 0}</span>
        <span>basis {position.protectionBasis ?? '—'}</span>
        <span>value area = observed volume profile, not intrinsic fair value</span>
      </div>
    </button>
  );
};
