export type AssetClass = 'CRYPTO_SPOT' | 'CRYPTO_PERP' | 'EQUITY';
export type AssetRuntimeMode = 'PAPER' | 'SHADOW' | 'RESEARCH';

export interface TradingInstrument {
  id: string;
  assetClass: AssetClass;
  market: string;
  symbol: string;
  displayName: string;
  aliases: string[];
  exchange?: string;
  quoteCurrency?: string;
  runtimeMode: AssetRuntimeMode;
  executionEnabled: boolean;
  shortEnabled: boolean;
}

const cryptoSpot = (
  symbol: string,
  displayName: string,
  aliases: string[],
  runtimeMode: AssetRuntimeMode = 'PAPER',
): TradingInstrument => ({
  id: `CRYPTO_SPOT:KRW-${symbol}`,
  assetClass: 'CRYPTO_SPOT',
  market: `KRW-${symbol}`,
  symbol,
  displayName,
  aliases: Array.from(new Set([symbol.toLowerCase(), displayName.toLowerCase(), ...aliases.map((item) => item.toLowerCase())])),
  exchange: 'UPBIT',
  quoteCurrency: 'KRW',
  runtimeMode,
  executionEnabled: runtimeMode === 'PAPER',
  shortEnabled: false,
});

const equity = (
  ticker: string,
  displayName: string,
  aliases: string[],
): TradingInstrument => ({
  id: `EQUITY:KRX-${ticker}`,
  assetClass: 'EQUITY',
  market: `KRX-${ticker}`,
  symbol: ticker,
  displayName,
  aliases: Array.from(new Set([ticker.toLowerCase(), displayName.toLowerCase(), ...aliases.map((item) => item.toLowerCase())])),
  exchange: 'KRX',
  quoteCurrency: 'KRW',
  runtimeMode: 'RESEARCH',
  executionEnabled: false,
  shortEnabled: false,
});

/**
 * Canonical coverage registry shared by Trading and NARS entity resolution.
 * Adding an instrument here does not grant execution authority. New asset classes
 * start in RESEARCH/SHADOW until their own data, risk, broker and validation gates pass.
 */
export const TRADING_INSTRUMENTS: TradingInstrument[] = [
  cryptoSpot('BTC', 'Bitcoin', ['비트코인']),
  cryptoSpot('ETH', 'Ethereum', ['Ether', '이더리움']),
  cryptoSpot('XRP', 'XRP', ['Ripple', '리플']),
  cryptoSpot('SOL', 'Solana', ['솔라나']),
  cryptoSpot('DOGE', 'Dogecoin', ['도지코인']),
  cryptoSpot('ADA', 'Cardano', ['카르다노']),
  cryptoSpot('WLD', 'Worldcoin', ['World Network', 'WLD token', '월드코인']),
  cryptoSpot('USDT', 'Tether', ['Tether USD', '테더']),

  // Equity expansion begins as RESEARCH only. Trading authority remains disabled
  // until equity-specific data, session, corporate-action, execution and risk models pass.
  equity('000660', 'SK hynix', ['SK하이닉스', 'SK Hynix', 'SK hynix Inc']),
  equity('005930', 'Samsung Electronics', ['삼성전자', 'Samsung Electronics Co']),
];

export const findTradingInstrument = (marketOrId: string) => {
  const needle = marketOrId.trim().toUpperCase();
  return TRADING_INSTRUMENTS.find((item) => item.id.toUpperCase() === needle || item.market.toUpperCase() === needle) ?? null;
};

export const evidenceAliasesFor = (marketOrId: string) => findTradingInstrument(marketOrId)?.aliases.slice() ?? [];

export const instrumentsByAssetClass = (assetClass: AssetClass) => TRADING_INSTRUMENTS.filter((item) => item.assetClass === assetClass);
