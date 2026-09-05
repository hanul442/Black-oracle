export type EvidenceLanguage = 'EN' | 'KO';

export const publisherReliabilityPrior = (publisher: string) => {
  const normalized = publisher.trim().toLowerCase();

  // Global publishers. These are internal operational priors, not objective media ratings.
  if (normalized.includes('reuters')) return 0.90;
  if (normalized.includes('bloomberg')) return 0.88;
  if (normalized.includes('financial times')) return 0.86;
  if (normalized.includes('wall street journal') || normalized.includes('wsj')) return 0.86;
  if (normalized.includes('cnbc')) return 0.80;
  if (normalized.includes('coindesk')) return 0.80;
  if (normalized.includes('the block')) return 0.76;
  if (normalized.includes('decrypt')) return 0.72;
  if (normalized.includes('cointelegraph')) return 0.64;

  // Korean publishers. No language bonus is applied; these are the same kind of operational priors.
  if (normalized.includes('연합뉴스') || normalized.includes('yna')) return 0.84;
  if (normalized.includes('한국경제') || normalized.includes('hankyung')) return 0.76;
  if (normalized.includes('매일경제') || normalized.includes('mk.co.kr')) return 0.76;
  if (normalized.includes('서울경제') || normalized.includes('sedaily')) return 0.74;
  if (normalized.includes('조선비즈') || normalized.includes('chosunbiz')) return 0.74;

  return 0;
};

export const assetSearchTerms = (market: string, language: EvidenceLanguage) => {
  const symbol = market.replace(/^KRW-/, '').toUpperCase();
  const english: Record<string, string[]> = {
    BTC: ['bitcoin', 'btc'],
    ETH: ['ethereum', 'ether', 'eth'],
    XRP: ['xrp', 'ripple'],
    SOL: ['solana', 'sol'],
    USDT: ['tether', 'usdt'],
    TRUMP: ['official trump', 'trump token', '$trump'],
  };
  const korean: Record<string, string[]> = {
    BTC: ['비트코인', 'BTC'],
    ETH: ['이더리움', '이더', 'ETH'],
    XRP: ['XRP', '리플'],
    SOL: ['솔라나', 'SOL'],
    USDT: ['테더', 'USDT'],
    TRUMP: ['트럼프 코인', 'TRUMP'],
  };

  const fallback = [symbol];
  return (language === 'KO' ? korean[symbol] : english[symbol]) || fallback;
};

export const googleNewsRssUrl = (market: string, language: EvidenceLanguage) => {
  const terms = assetSearchTerms(market, language).slice(0, 2);
  const suffix = language === 'KO' ? '가상자산 when:24h' : 'crypto when:24h';
  const query = `${terms.join(' OR ')} ${suffix}`;
  const locale = language === 'KO'
    ? 'hl=ko&gl=KR&ceid=KR:ko'
    : 'hl=en-US&gl=US&ceid=US:en';
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${locale}`;
};
