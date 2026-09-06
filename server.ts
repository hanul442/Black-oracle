import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import searchOracleHandler from './api/search-oracle';
import legacyRssShimHandler from './api/fetch-rss';
import operatorLogHandler from './api/operator-log';
import tradeCasesHandler from './api/trade-cases';
import tradingEmpiricalValidationHandler from './api/trading-empirical-validation';
import tradingGradeHandler from './api/trading-grade';
import tradingReadinessHandler from './api/trading-readiness';
import tradingResearchValidationHandler from './api/trading-research-validation';
import tradingStatusHandler from './api/trading-status';
import { registerTradingRoutes } from './server/trading/routes';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const rssFeeds = [
  { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', type: 'news' },
  { name: 'WSJ Markets', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', type: 'market' },
  { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', type: 'news' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', type: 'tech' },
  { name: 'Reuters', url: 'http://feeds.reuters.com/reuters/topNews', type: 'news' },
  { name: 'Financial Times', url: 'https://www.ft.com/?format=rss', type: 'market' },
];

const generateWithRetry = async (options: any, maxRetries = 2) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await genAI.models.generateContent(options);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
  throw lastError;
};

async function startServer() {
  const app = express();
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const production = process.env.NODE_ENV === 'production';
  const devHost = process.env.DEV_HOST?.trim() || '127.0.0.1';
  const listenHost = production ? '0.0.0.0' : devHost;
  app.use(express.json({ limit: '1mb' }));

  // Trading routes are Paper-only. They do not use Firebase research storage.
  registerTradingRoutes(app);

  // The Vercel operator endpoints are normally packaged as serverless functions. Mount the
  // same read-only handlers ahead of Vite in local development so missing persistence/config
  // returns JSON UNAVAILABLE/503 rather than falling through to index.html and corrupting the
  // operator UI's JSON parser. This does not create a development mock or execution authority.
  if (!production) {
    app.get('/api/operator-log', (req, res) => void operatorLogHandler(req, res));
    app.get('/api/trade-cases', (req, res) => void tradeCasesHandler(req, res));
    app.get('/api/trading-empirical-validation', (req, res) => void tradingEmpiricalValidationHandler(req, res));
    app.get('/api/trading-grade', (req, res) => void tradingGradeHandler(req, res));
    app.get('/api/trading-readiness', (req, res) => void tradingReadinessHandler(req, res));
    app.get('/api/trading-research-validation', (req, res) => void tradingResearchValidationHandler(req, res));
    app.get('/api/trading-status', (req, res) => void tradingStatusHandler(req, res));
  }

  // Research generation is authenticated and compute-only. The browser persists results
  // to /users/{auth.uid}/... under Firestore ownership rules.
  app.post('/api/search-oracle', (req, res) => void searchOracleHandler(req, res));

  // Legacy RSS mutation is intentionally disabled. v0.3 uses source-backed trading evidence.
  app.post('/api/fetch-rss', (req, res) => void legacyRssShimHandler(req, res));

  app.get('/api/feeds', (_req, res) => {
    res.json({ success: true, count: rssFeeds.length, data: rssFeeds, readOnly: true });
  });

  let trendsCache: Record<string, { time: number; data: string[] }> = {};
  app.get('/api/trends', async (req, res) => {
    const region = String(req.query.region || 'global').toLowerCase();
    const cached = trendsCache[region];
    if (cached && Date.now() - cached.time < 60 * 60 * 1000) return res.json({ trends: cached.data });

    if (!process.env.GEMINI_API_KEY) return res.json({ trends: [] });
    try {
      const prompt = region === 'kr'
        ? 'Use Google Search to identify four current South Korea macro, financial-market, regulatory, or liquidity topics. Return only a JSON array of four short Korean strings.'
        : 'Use Google Search to identify four current global macro, financial-market, regulatory, or liquidity topics. Return only a JSON array of four short strings.';
      const modelResponse = await generateWithRetry({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });
      const text = String(modelResponse.text || '').replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      const match = text.match(/\[[\s\S]*\]/);
      const parsed = match ? JSON.parse(match[0]) : [];
      const trends = Array.isArray(parsed) ? parsed.map(String).slice(0, 4) : [];
      trendsCache[region] = { time: Date.now(), data: trends };
      return res.json({ trends });
    } catch (error) {
      console.error('Trend lookup failed:', error);
      return res.json({ trends: [] });
    }
  });

  app.post('/api/briefing', async (req, res) => {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim().slice(0, 8_000) : '';
    const lines = Math.max(1, Math.min(12, Math.trunc(Number(req.body?.lines ?? 5))));
    if (!query) return res.status(400).json({ success: false, error: 'No query provided.' });
    if (!process.env.GEMINI_API_KEY) return res.status(503).json({ success: false, error: 'Briefing model is not configured.' });

    try {
      const modelResponse = await generateWithRetry({
        model: 'gemini-2.5-flash',
        contents: `다음 자료에 대해 정확히 ${lines}문장의 한국어 금융·시장 브리핑을 작성하십시오. 제공된 정보 밖의 사실을 지어내지 말고, 가능한 경우 수치와 불확실성을 명시하십시오.\n\n${query}`,
        config: { temperature: 0.2 },
      });
      return res.json({ success: true, text: String(modelResponse.text || '') });
    } catch (error) {
      console.error('Briefing generation failed:', error);
      return res.status(500).json({ success: false, error: 'Failed to generate briefing.' });
    }
  });

  if (!production) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
    if (!['127.0.0.1', 'localhost', '::1'].includes(devHost)) {
      console.warn('Black Oracle development server is explicitly exposed beyond loopback via DEV_HOST. Keep this limited to trusted networks and update Vite before wider exposure.');
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(port, listenHost, () => {
    console.log(`Black Oracle server listening on http://${listenHost}:${port}`);
  });
}

void startServer();
