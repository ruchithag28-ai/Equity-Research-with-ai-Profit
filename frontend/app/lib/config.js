const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const normalizeBaseUrl = (value) => value.replace(/\/+$/, '');

export const API_ENDPOINTS = {
  LOGIN: '/api/auth/login',
  SIGNUP: '/api/auth/signup',
  ME: '/api/auth/me',

  ANALYZE_URL: '/api/analyze/url',
  MY_ARTICLES: '/api/analyze/my-articles',
  GET_ARTICLE: '/api/analyze',

  QNA_ASK: '/api/qna/ask',
  NEWS_HEADLINES: '/api/news/headlines',
  NEWS_BY_SECTOR: '/api/news/by-sector',
  SECTOR: '/api/sector',
  SECTOR_PERFORMANCE: '/api/sector/performance',
  SECTOR_PROFITS: '/api/sectors/profits',
  RECOMMENDATIONS: '/api/recommendations',
  TOP_PROFITABLE: '/api/companies/top-profitable',
  PROFIT_REPORT: '/api/reports/profit-summary.pdf',
  FAKE_NEWS_PREDICT: '/api/sector/fake-news/predict',
  QNA_MARKET_OVERVIEW: '/api/qna/market-overview',
  QNA_ARTICLE_OVERVIEW: '/api/qna/article-overview',
  QNA_EXPORT_NOTE: '/api/qna/export-note',
  QNA_DOWNLOAD_OVERVIEW: '/api/qna/download-overview',
  FOREX_TIMESERIES: '/api/forex/timeseries',
  COMMODITIES_TIMESERIES: '/api/commodities/timeseries',
};

export const buildApiUrl = (endpoint) => {
  const cleanEndpoint = endpoint.startsWith('/')
    ? endpoint.slice(1)
    : endpoint;

  return `${normalizeBaseUrl(API_BASE_URL)}/${cleanEndpoint}`;
};
