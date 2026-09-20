import type { ReportType } from './contracts';

export const ANALYST_REGISTRY_VERSION = 1 as const;

export type AnalystClass = 'DOMAIN_LEAD' | 'SPECIALIST' | 'RED_TEAM';
export type AnalystCostClass = 'LIGHT' | 'STANDARD' | 'HEAVY';

export type ReportAnalystDefinition = {
  analystId: string;
  title: string;
  analystClass: AnalystClass;
  domain: string;
  supportedReportTypes: readonly ReportType[];
  evidenceDomains: readonly string[];
  costClass: AnalystCostClass;
  alwaysRequired: boolean;
  methodVersion: string;
  promptVersion: string;
};

export const DOMAIN_LEAD_BY_REPORT_TYPE: Readonly<Record<ReportType, string>> = {
  MARKET: 'market_lead',
  INDUSTRY: 'industry_lead',
  SECTOR: 'sector_lead',
  COMPANY: 'company_research_lead',
  SECURITY: 'security_lead',
  EVENT: 'event_catalyst_lead',
  CRYPTO: 'crypto_lead',
};

export const REPORT_ANALYST_REGISTRY: readonly ReportAnalystDefinition[] = [
  {
    analystId: 'market_lead',
    title: 'Chief Market Analyst',
    analystClass: 'DOMAIN_LEAD',
    domain: 'market',
    supportedReportTypes: ['MARKET'],
    evidenceDomains: ['macro', 'cross_asset', 'rates', 'fx', 'commodities', 'market_breadth'],
    costClass: 'STANDARD',
    alwaysRequired: true,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'industry_lead',
    title: 'Industry Lead Analyst',
    analystClass: 'DOMAIN_LEAD',
    domain: 'industry',
    supportedReportTypes: ['INDUSTRY'],
    evidenceDomains: ['industry', 'supply_chain', 'demand', 'capacity', 'policy'],
    costClass: 'STANDARD',
    alwaysRequired: true,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'sector_lead',
    title: 'Sector Lead Analyst',
    analystClass: 'DOMAIN_LEAD',
    domain: 'sector',
    supportedReportTypes: ['SECTOR'],
    evidenceDomains: ['sector', 'relative_strength', 'valuation', 'flows', 'macro'],
    costClass: 'STANDARD',
    alwaysRequired: true,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'company_research_lead',
    title: 'Company Research Lead',
    analystClass: 'DOMAIN_LEAD',
    domain: 'company',
    supportedReportTypes: ['COMPANY'],
    evidenceDomains: ['fundamentals', 'earnings', 'filings', 'industry', 'management'],
    costClass: 'STANDARD',
    alwaysRequired: true,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'security_lead',
    title: 'Security Lead Analyst',
    analystClass: 'DOMAIN_LEAD',
    domain: 'security',
    supportedReportTypes: ['SECURITY'],
    evidenceDomains: ['valuation', 'technical', 'flows', 'fundamentals', 'catalyst', 'macro'],
    costClass: 'STANDARD',
    alwaysRequired: true,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'event_catalyst_lead',
    title: 'Event & Catalyst Lead Analyst',
    analystClass: 'DOMAIN_LEAD',
    domain: 'event',
    supportedReportTypes: ['EVENT'],
    evidenceDomains: ['event', 'news', 'filings', 'policy', 'market_reaction'],
    costClass: 'STANDARD',
    alwaysRequired: true,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'crypto_lead',
    title: 'Crypto Lead Analyst',
    analystClass: 'DOMAIN_LEAD',
    domain: 'crypto',
    supportedReportTypes: ['CRYPTO'],
    evidenceDomains: ['crypto_market', 'technical', 'liquidity', 'macro', 'network', 'event'],
    costClass: 'STANDARD',
    alwaysRequired: true,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },

  {
    analystId: 'fundamental_valuation',
    title: 'Fundamental & Valuation Analyst',
    analystClass: 'SPECIALIST',
    domain: 'fundamental_valuation',
    supportedReportTypes: ['COMPANY', 'SECURITY', 'SECTOR', 'INDUSTRY'],
    evidenceDomains: ['fundamentals', 'valuation', 'filings', 'earnings'],
    costClass: 'STANDARD',
    alwaysRequired: false,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'earnings_expectations',
    title: 'Earnings & Expectations Analyst',
    analystClass: 'SPECIALIST',
    domain: 'earnings',
    supportedReportTypes: ['COMPANY', 'SECURITY', 'EVENT'],
    evidenceDomains: ['earnings', 'consensus', 'guidance', 'filings'],
    costClass: 'STANDARD',
    alwaysRequired: false,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'technical_structure',
    title: 'Technical & Market Structure Analyst',
    analystClass: 'SPECIALIST',
    domain: 'technical',
    supportedReportTypes: ['MARKET', 'SECTOR', 'SECURITY', 'CRYPTO'],
    evidenceDomains: ['price', 'volume', 'technical', 'support_resistance'],
    costClass: 'LIGHT',
    alwaysRequired: false,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'flow_liquidity',
    title: 'Flow & Liquidity Analyst',
    analystClass: 'SPECIALIST',
    domain: 'flow',
    supportedReportTypes: ['MARKET', 'SECTOR', 'SECURITY', 'CRYPTO'],
    evidenceDomains: ['flows', 'liquidity', 'volume', 'positioning'],
    costClass: 'LIGHT',
    alwaysRequired: false,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'macro_cross_asset',
    title: 'Macro & Cross-Asset Analyst',
    analystClass: 'SPECIALIST',
    domain: 'macro',
    supportedReportTypes: ['MARKET', 'INDUSTRY', 'SECTOR', 'SECURITY', 'EVENT', 'CRYPTO'],
    evidenceDomains: ['macro', 'rates', 'fx', 'commodities', 'cross_asset'],
    costClass: 'STANDARD',
    alwaysRequired: false,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'industry_structure',
    title: 'Industry Structure Analyst',
    analystClass: 'SPECIALIST',
    domain: 'industry',
    supportedReportTypes: ['INDUSTRY', 'SECTOR', 'COMPANY', 'SECURITY'],
    evidenceDomains: ['industry', 'supply_chain', 'capacity', 'competition', 'demand'],
    costClass: 'STANDARD',
    alwaysRequired: false,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'policy_regulation',
    title: 'Policy & Regulation Analyst',
    analystClass: 'SPECIALIST',
    domain: 'policy',
    supportedReportTypes: ['MARKET', 'INDUSTRY', 'SECTOR', 'COMPANY', 'EVENT', 'CRYPTO'],
    evidenceDomains: ['policy', 'regulation', 'government', 'legal'],
    costClass: 'STANDARD',
    alwaysRequired: false,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'event_catalyst',
    title: 'Event & Catalyst Analyst',
    analystClass: 'SPECIALIST',
    domain: 'event',
    supportedReportTypes: ['COMPANY', 'SECURITY', 'EVENT', 'CRYPTO'],
    evidenceDomains: ['event', 'news', 'filings', 'catalyst'],
    costClass: 'LIGHT',
    alwaysRequired: false,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'sentiment_news',
    title: 'News & Sentiment Analyst',
    analystClass: 'SPECIALIST',
    domain: 'sentiment',
    supportedReportTypes: ['MARKET', 'INDUSTRY', 'SECTOR', 'COMPANY', 'SECURITY', 'EVENT', 'CRYPTO'],
    evidenceDomains: ['news', 'sentiment', 'social'],
    costClass: 'LIGHT',
    alwaysRequired: false,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'crypto_market_structure',
    title: 'Crypto Market Structure Analyst',
    analystClass: 'SPECIALIST',
    domain: 'crypto_structure',
    supportedReportTypes: ['CRYPTO'],
    evidenceDomains: ['crypto_market', 'liquidity', 'derivatives', 'network'],
    costClass: 'STANDARD',
    alwaysRequired: false,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
  {
    analystId: 'adversarial_research',
    title: 'Adversarial Research Analyst',
    analystClass: 'RED_TEAM',
    domain: 'red_team',
    supportedReportTypes: ['MARKET', 'INDUSTRY', 'SECTOR', 'COMPANY', 'SECURITY', 'EVENT', 'CRYPTO'],
    evidenceDomains: ['counterevidence', 'assumptions', 'data_gaps'],
    costClass: 'STANDARD',
    alwaysRequired: false,
    methodVersion: '1.0',
    promptVersion: '1.0',
  },
] as const;

const ANALYST_BY_ID = new Map(REPORT_ANALYST_REGISTRY.map((item) => [item.analystId, item] as const));

export const reportAnalystById = (analystId: string) => ANALYST_BY_ID.get(analystId) ?? null;

export const domainLeadForReportType = (reportType: ReportType) =>
  reportAnalystById(DOMAIN_LEAD_BY_REPORT_TYPE[reportType]);
