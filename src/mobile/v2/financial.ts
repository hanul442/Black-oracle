import type { OpenPosition } from './types';

export type MarkedOpenPosition = OpenPosition & {
  updatedAt?: number;
  markPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
};

const finite = (value: number | null | undefined): value is number => value != null && Number.isFinite(value);

export const formatKrw = (value: number | null | undefined, signed = false) => {
  if (!finite(value)) return '—';
  const absolute = Math.abs(value);
  const digits = absolute >= 100 ? 0 : absolute >= 1 ? 2 : absolute >= 0.01 ? 4 : 8;
  const formatted = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(Math.abs(value));
  const sign = value < 0 ? '-' : signed && value > 0 ? '+' : '';
  return `${sign}₩${formatted}`;
};

export const formatQuantity = (value: number | null | undefined) => {
  if (!finite(value)) return '—';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: value >= 1000 ? 2 : value >= 1 ? 6 : 10 }).format(value);
};

export const formatPercent = (value: number | null | undefined, signed = false) => {
  if (!finite(value)) return '—';
  const points = value * 100;
  const sign = signed && points > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(points)}%`;
};

export const positionFinancials = (raw: OpenPosition) => {
  const position = raw as MarkedOpenPosition;
  const costBasis = finite(position.averageCost) && finite(position.quantity) ? position.averageCost * position.quantity : null;
  const markPrice = finite(position.markPrice) ? position.markPrice : null;
  const marketValue = finite(position.marketValue) ? position.marketValue : markPrice != null && finite(position.quantity) ? markPrice * position.quantity : null;
  const unrealizedPnl = finite(position.unrealizedPnl) ? position.unrealizedPnl : marketValue != null && costBasis != null ? marketValue - costBasis : null;
  const unrealizedReturn = unrealizedPnl != null && costBasis != null && costBasis > 0 ? unrealizedPnl / costBasis : null;
  return { fillPrice: finite(position.entryPrice) ? position.entryPrice : null, averageCostPerUnit: finite(position.averageCost) ? position.averageCost : null, quantity: finite(position.quantity) ? position.quantity : null, costBasis, markPrice, marketValue, unrealizedPnl, unrealizedReturn };
};
