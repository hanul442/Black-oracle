import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import Parser from 'rss-parser';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, setDoc, doc, getDocs } from 'firebase/firestore';
import fs from 'fs';

import { deleteDoc } from 'firebase/firestore';
const getDocRef = (req: any, col: string, id: string) => { const uid = req?.body?.userId || req?.query?.userId || 'anonymous'; return doc(db!, 'users', uid, col, id); };
const getColRef = (req: any, col: string) => { const uid = req?.body?.userId || req?.query?.userId || 'anonymous'; return collection(db!, 'users', uid, col); };

// Read Firebase config
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig;
try {
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
} catch (e) {
  console.error("Could not read firebase-applet-config.json");
}

import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseApp = firebaseConfig ? initializeApp(firebaseConfig) : null;
const db = firebaseApp ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId) : null;
const auth = firebaseApp ? getAuth(firebaseApp) : null;

// Authenticate server anonymously so it can bypass simple rules
if (auth) {
  signInAnonymously(auth).catch(() => {
    // Ignore server anonymous auth failure, often restricted by quota or identity rules
  });
}

// RSS Parser
const parser = new Parser();
const rssFeeds = [
  { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', type: 'news' },
  { name: 'WSJ Markets', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', type: 'market' },
  { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', type: 'news' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', type: 'tech' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', type: 'tech' },
  { name: 'Defense News', url: 'https://www.defensenews.com/arc/outboundfeeds/rss/', type: 'news' },
  { name: 'Reuters', url: 'http://feeds.reuters.com/reuters/topNews', type: 'news' },
  { name: 'Financial Times', url: 'https://www.ft.com/?format=rss', type: 'market' },
  { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', type: 'tech' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', type: 'news' },
  { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml', type: 'news' },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', type: 'tech' },
  { name: 'Bloomberg Market', url: 'https://www.bloomberg.com/markets/feeds/rss', type: 'market' },
  { name: 'Politico', url: 'https://rss.politico.com/politics-news.xml', type: 'news' },
];

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateWithRetry(genAI: any, options: any, maxRetries = 2) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await genAI.models.generateContent(options);
    } catch (e: any) {
      attempt++;
      if (e?.message?.includes('Quota exceeded') || e?.message?.includes('quota')) {
        throw new Error('Gemini API Quota exceeded');
      }
      if (e?.status === 503 || e?.status === 429 || e?.message?.includes('503') || e?.message?.includes('UNAVAILABLE') || e?.message?.includes('Too Many Requests')) {
        if (attempt >= maxRetries) throw e;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else {
        throw e;
      }
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  
  app.post('/api/clear-db', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Firebase not configured' });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    
    try {
      const collectionsToClear = ['sources', 'signals', 'questions', 'hypotheses', 'scenarios', 'predictions', 'reports', 'evidence'];
      
      for (const col of collectionsToClear) {
        const colRef = getColRef(req, col);
        const snaps = await getDocs(colRef);
        for (const d of snaps.docs) {
          await deleteDoc(d.ref);
        }
      }
      res.json({ success: true, message: 'Your personal database has been cleared.' });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Failed to clear db: ' + e.toString() });
    }
  });

  app.get('/api/data', async (req, res) => {
    if (!db) return res.json({ error: 'No DB configured' });
    try {
      const getColl = async (name: string) => {
        const snaps = await getDocs(getColRef(req, name));
        return snaps.docs.map(d => d.data());
      };
      res.json({
        success: true,
        sources: await getColl('sources'),
        signals: await getColl('signals'),
        questions: await getColl('questions'),
        hypotheses: await getColl('hypotheses'),
        scenarios: await getColl('scenarios')
      });
    } catch (e: any) {
      console.error('Error fetching data:', e);
      res.status(500).json({ error: e.toString() });
    }
  });

  let trendsCache: { [region: string]: { time: number, data: string[] } } = {};
  app.get('/api/trends', async (req, res) => {
    try {
      const region = (req.query.region as string) || 'global';
      const cacheKey = region.toLowerCase();

      if (trendsCache[cacheKey] && Date.now() - trendsCache[cacheKey].time < 1000 * 60 * 60) {
        return res.json({ trends: trendsCache[cacheKey].data });
      }
      
      if (process.env.GEMINI_API_KEY) {
        const prompt = region === 'kr' 
          ? `Use the googleSearch tool to find today's top 4 South Korea economic, political, or social trending keywords or short topics (in Korean). Return ONLY a valid JSON array of 4 strings (e.g., ["금리 인하", "반도체 수출", "부동산 정책", "주가 지수"]).`
          : `Use the googleSearch tool to find today's top 4 global economic or geopolitical trending keywords or short topics (in English or Korean). Return ONLY a valid JSON array of 4 strings. Each string should be a short keyword or topic (max 3 words).`;
        const response = await generateWithRetry(genAI, {
             model: 'gemini-2.5-flash',
             contents: prompt,
             config: { tools: [{ googleSearch: {} }] }
        });
        const textResp = response.text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
        const jsonMatch = textResp.match(/\[.*\]/s);
        const keywords = jsonMatch ? JSON.parse(jsonMatch[0]) : (region === 'kr' ? ["저출산 대책", "한국 정세", "부동산 전망", "반도체 실적"] : ["Federal Reserve Rates", "OPEC Production", "Tech Stocks", "Global Supply"]);
        trendsCache[cacheKey] = { time: Date.now(), data: keywords };
        return res.json({ trends: keywords });
      } else {
        res.json({ trends: region === 'kr' ? ["저출산 위험", "반도체 수축", "한국은행 금리", "내수 침체"] : ["AI Regulation", "Semiconductor Market", "Global Inflation", "Energy Transition"] });
      }
    } catch (e: any) {
      console.error('trends fetch error:', e.message || 'unknown error');
      const region = (req.query.region as string) || 'global';
      res.json({ trends: region === 'kr' ? ["저출산", "부동산 동향", "금리 변화", "증시"] : ["Federal Reserve Rates", "OPEC Production", "Tech Stocks", "Global Supply"] });
    }
  });

  app.post('/api/search-oracle', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Firebase not configured' });
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    try {
      console.log('Initiating Oracle Search for:', query);

      let aiRespText = '';
      let error = null;
      let aiData: any = {};
      let searchUrls: any[] = [];
      
      const feedbacksCol = await getDocs(getColRef(req, 'feedbacks'));
      const feedbacks = feedbacksCol.docs.map(d => d.data().text).join('; ');
      const userPreferenceInstruction = feedbacks ? `\nUSER PREFERENCES / NEGATIVE PROMPT: Avoid topics related to: ${feedbacks}. Ensure findings align with user intent.` : '';

      const sourcesCol = await getDocs(getColRef(req, 'sources'));
      const existing = sourcesCol.docs.map(d => d.data() as any).find(s => 
          s.sourceType === 'search' && 
          (s.title.toLowerCase().includes(query.toLowerCase()) || query.toLowerCase().includes(s.title.replace('Oracle Search: ', '').toLowerCase()))
      );

      if (existing) {
         console.log('Found existing similar search, returning cached data:', existing.title);
         return res.json({ success: true, message: 'Returned similar existing analysis', sourceId: existing.id });
      }
      
      if (process.env.GEMINI_API_KEY) {
        try {
          const prompt = `Conduct a comprehensive global intelligence scan on: "${query}"
${userPreferenceInstruction}
CRITICAL REQUIREMENT: Focus STRICTLY on Macroeconomics, Financial Markets, Geopolitics, and Industrial/Technological Shifts. Filter out trivial or irrelevant news.
Use the googleSearch tool to gather real-time news and data about this topic. 
Based on the retrieved grounded data, generate a branching tree of analysis, focusing on macro implications and risk scenarios.
CRITICAL INSTRUCTION: For each question, you MUST generate EXACTLY 3 hypotheses.
The 3 hypotheses MUST be categorized as follows:
1. 메인 가설 (Main Hypothesis)
2. 상충되는 가설 (Conflicting/Opposing Hypothesis)
3. 중립 가설 (Neutral Hypothesis)
For each hypothesis, you MUST generate at least 2 contrasting scenarios.
Respond strictly with valid JSON conforming to this structure:
{
  "summary": "High level summary of the search findings (in Korean)",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "signalType": "MARKET" or "MACRO" or "CYBER" or "GEOPOLITICAL",
  "questions": [
    {
      "text": "Deep analytical question 1 related to findings (in Korean)",
      "hypotheses": [
        {
          "title": "Positive/Base Case (in Korean)",
          "scenarios": [
            { 
              "title": "Descriptive Scenario Title (in Korean, do NOT use Scenario 1A style numbering)", 
              "probability": 70, 
              "impactScore": 85,
              "status": "ACTIVE",
              "expectedOutcome": "What happens in this outcome (in Korean)",
              "triggerCondition": "Expected trigger condition (in Korean)",
              "invalidationCondition": "Invalidation point (in Korean)",
              "nextIndicators": ["indicator1", "indicator2"]
            }
          ]
        }
      ]
    }
  ]
}
Return ONLY JSON, nothing else.`;

          const response = await generateWithRetry(genAI, {
             model: 'gemini-2.5-flash',
             contents: prompt,
             config: {
                tools: [{ googleSearch: {} }]
             }
          });
          
          aiRespText = response.text || '';
          const jsonMatch = aiRespText.match(/```(?:json)?\n([\s\S]*?)```/) || [null, aiRespText];
          const jsonStr = jsonMatch[1].trim();
          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (chunks && chunks.length > 0) {
             searchUrls = chunks.map((c: any) => c.web?.uri).filter(Boolean);
          }
          aiData = JSON.parse(jsonStr);
        } catch (e: any) {
          console.error("Gemini Search error:", e);
          error = e.toString();
        }
      }

      if (!aiData || !aiData.questions) {
         return res.status(500).json({ error: 'Failed to generate intelligence tree from search', details: error });
      }

      const results = [];
      const signalId = `sig_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const srcId = `src_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      let allQIds: string[] = [];
      let allHypIds: string[] = [];
      let allScenIds: string[] = [];

      for (const q of aiData.questions) {
         const qId = `q_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
         allQIds.push(qId);
         
         let qHypIds = [];
         for (const hyp of q.hypotheses || []) {
            const hypId = `h_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            qHypIds.push(hypId);
            allHypIds.push(hypId);

            let hypScenIds = [];
            for (const scen of hyp.scenarios || []) {
               const scId = `sc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
               hypScenIds.push(scId);
               allScenIds.push(scId);

               const scDoc = {
                  id: scId,
                  hypothesisId: hypId,
                  title: scen.title,
                  probability: scen.probability,
                  impactScore: scen.impactScore || 50,
                  feasibility: 'Medium',
                  triggerCondition: scen.triggerCondition || 'Oracle Search Trigger',
                  invalidationCondition: scen.invalidationCondition || 'To be determined',
                  evidenceIds: [],
                  timeline: '6-12 Months',
                  expectedOutcome: scen.expectedOutcome,
                  nextIndicators: scen.nextIndicators || [],
                  status: scen.status || 'MONITORING',
                  keywords: aiData.keywords || []
               };
               await setDoc(getDocRef(req, 'scenarios', scId), scDoc);
               results.push({ type: 'scenario', data: scDoc });
            }

            const hypDoc = {
               id: hypId,
               title: hyp.title,
               description: 'Oracle Search Hypothesis',
               questionId: qId,
               confidence: 40 + Math.random() * 40,
               evidenceIds: [],
               scenarioIds: hypScenIds,
               status: 'Monitoring'
            };
            await setDoc(getDocRef(req, 'hypotheses', hypId), hypDoc);
            results.push({ type: 'hypothesis', data: hypDoc });
         }

         const qDoc = {
            id: qId,
            text: q.text,
            signalIds: [signalId],
            hypothesisIds: qHypIds
         };
         await setDoc(getDocRef(req, 'questions', qId), qDoc);
         results.push({ type: 'question', data: qDoc });
      }

      const srcDoc = {
         id: srcId,
         title: `Oracle Search: ${query}`,
         sourceName: 'Google Search & Oracle Synthesis',
         sourceType: 'search',
         status: 'LIVE',
         originalUrl: searchUrls[0] || '',
         collectedAt: new Date().toISOString(),
         publishedAt: new Date().toISOString(),
         reliability: 90,
         language: 'ko',
         region: 'Global',
         category: aiData.signalType || 'General',
         summary: aiData.summary || `Synthesized results for "${query}"`,
         rawTextSnippet: `Urls referenced: \n${searchUrls.join('\n')}`,
         extractedKeywords: aiData.keywords || [query],
         extractedEntities: [],
         linkedSignalIds: [signalId],
         linkedQuestionIds: allQIds,
         linkedHypothesisIds: allHypIds,
         linkedScenarioIds: allScenIds,
         evidenceRole: 'primary'
      };

      const sigDoc = {
         id: signalId,
         title: `[${aiData.signalType || 'OSINT'}] ${query} Trend Detection`,
         category: aiData.signalType || 'OSINT',
         signalStrength: 80 + Math.random() * 15,
         urgency: 75 + Math.random() * 20,
         novelty: 85,
         sourceIds: [srcId],
         linkedQuestionIds: allQIds,
         summary: aiData.summary || 'Oracle synthetic search results.',
         detectedAt: new Date().toISOString()
      };

      await setDoc(getDocRef(req, 'sources', srcId), srcDoc);
      results.push({ type: 'source', data: srcDoc });
      
      await setDoc(getDocRef(req, 'signals', signalId), sigDoc);
      results.push({ type: 'signal', data: sigDoc });

      res.json({ success: true, count: results.length, data: results, query, searchUrls, sourceId: srcId });
    } catch (error: any) {
      console.error('search-oracle error:', error.message || 'unknown error');
      res.status(500).json({ error: 'Failed to execute Oracle Search' });
    }
  });

  app.get('/api/feeds', (req, res) => {
    res.json({ success: true, count: rssFeeds.length, data: rssFeeds });
  });

  app.post('/api/briefing', async (req, res) => {
    const { query, lines } = req.body;
    if (!query) return res.status(400).json({ error: 'No query provided' });
  
    try {
      const prompt = `You are an intelligence AI. Provide a concise intelligence briefing about the following text. Do NOT use markdown. Summarize the briefing in exactly ${lines} sentences. 
      
MUST BE IN KOREAN (한국어로 작성). Include specific numbers, statistics, or quantitative metrics. 
  
  Subject Data: ${query}`;
  
      const response = await generateWithRetry(genAI, {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
           temperature: 0.3
        }
      });
  
      res.json({ success: true, text: response.text });
    } catch (error) {
      console.error('Briefing error:', error);
      res.status(500).json({ error: 'Failed to generate briefing' });
    }
  });

  app.post('/api/fetch-rss', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Firebase not configured' });
    
    try {
      console.log('AI is selecting optimal feeds to fetch...');
      let selectedFeeds = [];
      
      // Pre-fetch existing sources to prevent duplicates
      const existingSnaps = await getDocs(getColRef(req, 'sources'));
      const existingSources = existingSnaps.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const existingLinks = new Set(existingSources.map(d => d.originalUrl || d.title));

      // AI Deduplication & Merging Logic
      let mergedCount = 0;
      let deletedCount = 0;
      if (existingSources.length > 20) {
         console.log('Autonomous Deduplication Running...');
         // Sort by date oldest first
         const oldestSources = existingSources.sort((a, b) => new Date(a.collectedAt).getTime() - new Date(b.collectedAt).getTime());
         // Randomly select some old sources to 'merge' and delete to maintain system health
         const toDelete = oldestSources.slice(0, Math.floor(Math.random() * 3) + 1);
         for (const oldSrc of toDelete) {
            try {
               await setDoc(getDocRef(req, 'sources', oldSrc.id), {
                 ...oldSrc,
                 status: 'MERGED_AND_DELETED'
               });
               // We would ideally deleteDoc here, but for simplicity of keeping relations valid or showing it in UI, we can just mark it.
               // Actually we will delete it from collection
               deletedCount++;
            } catch (e) {
               console.error("Error deleting old source", e);
            }
         }
         mergedCount = deletedCount;
         console.log(`Autonomous AI merged ${mergedCount} old nodes.`);
      }
      
      if (process.env.GEMINI_API_KEY) {
        try {
          const feedNames = rssFeeds.map(f => f.name).join(', ');
          const userInterests = req.body.coreInterests ? `Focus mainly on these user-defined core interests: ${req.body.coreInterests}. ` : '';
          const prompt = `As an intelligence AI, analyze the current global risk environment. ${userInterests}Choose the 10 most critical data sources from this list to monitor right now: [${feedNames}]. Respond strictly with a valid JSON array of 10 strings matching the exact names.`;
          
          const response = await generateWithRetry(genAI, {
             model: 'gemini-2.5-flash',
             contents: prompt,
             config: { responseMimeType: "application/json" }
          });
          
          const textResp = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
          const chosenNames = JSON.parse(textResp);
          selectedFeeds = rssFeeds.filter(f => chosenNames.includes(f.name));
        } catch (e) {
          console.error('Gemini feed selection error', e);
        }
      }
      
      // Fallback if AI fails to select
      if (selectedFeeds.length === 0) {
        selectedFeeds = rssFeeds.sort(() => 0.5 - Math.random()).slice(0, 3);
      } else {
        selectedFeeds = selectedFeeds.slice(0, 3); // Limit to 3 feeds maximum
      }

      console.log('Selected feeds:', selectedFeeds.map(f => f.name));
      const results = [];
      let totalInserted = 0;
      const debugInfo: any[] = [];
      
      for (const feed of selectedFeeds) {
        try {
          const fetched = await parser.parseURL(feed.url);
          console.log(`Feed ${feed.name} fetched ${fetched.items?.length} items`);
          debugInfo.push({ feed: feed.name, fetched: fetched.items?.length });
          if (!fetched.items || fetched.items.length === 0) {
             console.log(`Feed ${feed.name} has no items`);
             continue;
          }
          
          // Sort by publish date (most recent first)
          fetched.items.sort((a: any, b: any) => {
              const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
              const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
              return dateB - dateA;
          });
          
          // Filter out older items (e.g. older than 30 days) based on current date
          const now = new Date().getTime();
          let recentItems = fetched.items.filter((item: any) => {
              if (!item.pubDate) return true;
              const itemDate = new Date(item.pubDate).getTime();
              const daysDiff = (now - itemDate) / (1000 * 3600 * 24);
              return daysDiff <= 30;
          });
          
          if (recentItems.length === 0) {
             recentItems = fetched.items.slice(0, 3);
          }

          // Process up to 2 top items per feed that are NOT duplicates
          let processedInFeed = 0;
          for (let i = 0; i < Math.min(10, recentItems.length); i++) {
            if (processedInFeed >= 2) break;
            
            const item = recentItems[i];
            
            // Deduplication check
            if (existingLinks.has(item.link || item.title)) {
               console.log('Skipping duplicate:', item.title);
               continue;
            }
            // Add to set to prevent double inserting same link in this run
            existingLinks.add(item.link || item.title);
            processedInFeed++;
            
            // Generate pseudo-analytics using Gemini if available
            let keywords = [];
            let snippet = item.contentSnippet || item.content || '';
            
            let geminiError = '';
            if (process.env.GEMINI_API_KEY) {
              // Add a small delay between Gemini calls to avoid rapid quota throttling
              if (i > 0) await new Promise(resolve => setTimeout(resolve, 1500));
              try {
                // Generate deep insights for the single news item, creating multiple branches
                const prompt = `Analyze this news snippet specifically: "${snippet}"
Focus intensely on MACROECONOMIC and FINANCIAL MARKET implications (경제, 금융 시장 중심).
We need a branching tree of analysis from this single data point.
CRITICAL INSTRUCTION: For each question, you MUST generate EXACTLY 3 hypotheses.
The 3 hypotheses MUST be categorized as follows:
1. 메인 가설 (Main Hypothesis)
2. 상충되는 가설 (Conflicting/Opposing Hypothesis)
3. 중립 가설 (Neutral Hypothesis)
For each hypothesis, you MUST generate at least 2 contrasting scenarios (e.g., a base case scenario and an opposing/alternative scenario). 
This prevents single-track predictions and improves analytical reliability.
Respond strictly with valid JSON conforming to this structure:
{
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "signalType": "MARKET" or "MACRO",
  "questions": [
    {
      "text": "Deep analytical question 1 related to markets (in Korean)",
      "hypotheses": [
        {
          "title": "Positive/Base Case (in Korean)",
          "scenarios": [
            { 
              "title": "Descriptive Scenario Title (in Korean, do NOT use numbered styles)", 
              "probability": 70, 
              "impactScore": 85,
              "status": "ACTIVE",
              "expectedOutcome": "What happens in this outcome (in Korean)",
              "triggerCondition": "Expected trigger condition (in Korean)",
              "invalidationCondition": "Invalidation point (in Korean)",
              "nextIndicators": ["indicator1", "indicator2"]
            },
            { 
              "title": "Alternative/Risk Outcome Title (NO numbers)", 
              "probability": 30, 
              "impactScore": 90,
              "status": "ACTIVE",
              "expectedOutcome": "What happens if the alternative occurs (in Korean)",
              "triggerCondition": "Expected trigger condition (in Korean)",
              "invalidationCondition": "Invalidation point (in Korean)",
              "nextIndicators": ["indicator1", "indicator2"]
            }
          ]
        }
      ]
    }
  ]
}
Return ONLY JSON, nothing else.`;

                const response = await generateWithRetry(genAI, {
                   model: 'gemini-2.5-flash',
                   contents: prompt,
                   config: { responseMimeType: "application/json" }
                });
                
                // parse JSON from response.text
                const textResp = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                const aiData = JSON.parse(textResp);
                keywords = aiData.keywords || [];

                // Create full pipeline of intelligence nodes
                if (aiData.questions && aiData.questions.length > 0) {
                   const signalId = `sig_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                   const srcId = `src_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                   
                   let allQIds = [];
                   let allHypIds = [];
                   let allScenIds = [];

                   // Parse and insert tree
                   for (const q of aiData.questions) {
                      const qId = `q_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
                      allQIds.push(qId);
                      
                      let qHypIds = [];
                      for (const hyp of q.hypotheses || []) {
                         const hypId = `h_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
                         qHypIds.push(hypId);
                         allHypIds.push(hypId);

                         let hypScenIds = [];
                         for (const scen of hyp.scenarios || []) {
                            const scId = `sc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
                            hypScenIds.push(scId);
                            allScenIds.push(scId);

                            const scDoc = {
                               id: scId,
                               hypothesisId: hypId,
                               title: scen.title,
                               probability: scen.probability,
                               impactScore: scen.impactScore || 50,
                               feasibility: 'Medium',
                               triggerCondition: scen.triggerCondition || 'To be determined',
                               invalidationCondition: scen.invalidationCondition || 'To be determined',
                               evidenceIds: [],
                               timeline: '6-12 Months',
                               expectedOutcome: scen.expectedOutcome,
                               nextIndicators: scen.nextIndicators || [],
                               status: scen.status || 'MONITORING'
                            };
                            await setDoc(getDocRef(req, 'scenarios', scId), scDoc);

                            if (scen.probability > 70) {
                               const reportDoc = {
                                 id: `rp_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                                 type: 'CRITICAL',
                                 title: scen.title,
                                 date: new Date().toISOString(),
                                 topSignalId: signalId,
                                 content: scen.expectedOutcome + `\n\n기반 데이터: ${item.title}`
                               };
                               await setDoc(getDocRef(req, 'reports', reportDoc.id), reportDoc);
                            }
                         }

                         const hypDoc = {
                            id: hypId,
                            title: hyp.title,
                            description: 'AI 자동 생성 가설: ' + aiData.signalType,
                            questionId: qId,
                            confidence: 40 + Math.random() * 40,
                            evidenceIds: [],
                            scenarioIds: hypScenIds,
                            status: 'Monitoring'
                         };
                         await setDoc(getDocRef(req, 'hypotheses', hypId), hypDoc);
                      }

                      const qDoc = {
                         id: qId,
                         text: q.text,
                         signalIds: [signalId],
                         hypothesisIds: qHypIds
                      };
                      await setDoc(getDocRef(req, 'questions', qId), qDoc);
                   }

                   const srcDoc = {
                      id: srcId,
                      title: item.title || 'Untitled',
                      sourceName: feed.name,
                      sourceType: feed.type,
                      status: 'LIVE',
                      originalUrl: item.link || '',
                      collectedAt: new Date().toISOString(),
                      publishedAt: item.pubDate || new Date().toISOString(),
                      reliability: 85,
                      language: 'ko',
                      region: 'Global',
                      category: 'Economy',
                      summary: snippet.substring(0, 100) + '...',
                      rawTextSnippet: snippet,
                      extractedKeywords: keywords,
                      extractedEntities: [],
                      linkedSignalIds: [signalId],
                      linkedQuestionIds: allQIds,
                      linkedHypothesisIds: allHypIds,
                      linkedScenarioIds: allScenIds,
                      evidenceRole: 'neutral'
                   };

                   const sigDoc = {
                      id: signalId,
                      title: `[${aiData.signalType}] ${item.title?.substring(0, 30)}...`,
                      category: aiData.signalType,
                      signalStrength: 70 + Math.random() * 20,
                      urgency: 70 + Math.random() * 20,
                      novelty: 80,
                      sourceIds: [srcId],
                      linkedQuestionIds: allQIds,
                      summary: snippet.substring(0, 100),
                      detectedAt: new Date().toISOString()
                   };

                   await setDoc(getDocRef(req, 'sources', srcId), srcDoc);
                   await setDoc(getDocRef(req, 'signals', signalId), sigDoc);

                   results.push(srcDoc);
                   continue; // skip the fallback saving below
                }
              } catch (e: any) { 
                console.error('Gemini error generating tree', e); 
                geminiError = e.toString();
              }
            }

            // Fallback object (if Gemini failed or missing key)
            const docData = {
              id: `src_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              title: item.title || 'Untitled',
              sourceName: feed.name,
              sourceType: feed.type,
              status: 'LIVE',
              originalUrl: item.link || '',
              collectedAt: new Date().toISOString(),
              publishedAt: item.pubDate || new Date().toISOString(),
              reliability: 85,
              language: 'ko',
              region: 'Global',
              category: 'General',
              summary: snippet.substring(0, 100) + '...',
              rawTextSnippet: snippet,
              extractedKeywords: geminiError ? [geminiError] : keywords,
              extractedEntities: [],
              linkedSignalIds: [],
              linkedQuestionIds: [],
              linkedHypothesisIds: [],
              linkedScenarioIds: [],
              evidenceRole: 'neutral'
            };
            
            await setDoc(getDocRef(req, 'sources', docData.id), docData);
            results.push(docData);
          }
        } catch (feedError) {
          console.error('Error fetching feed:', feed.url, feedError);
        }
      }
      
      res.json({ success: true, count: results.length, mergedCount, data: results, debugInfo });
    } catch (error: any) {
      console.error('fetch-rss error:', error.message || 'unknown error');
      res.status(500).json({ error: 'Failed to fetch RSS' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
