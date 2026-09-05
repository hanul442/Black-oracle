import { GoogleGenAI } from '@google/genai';
import { verifyFirebaseUser } from '../server/auth/firebaseUser.js';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
};
const makeId = (prefix: string) => `${prefix}_${globalThis.crypto.randomUUID()}`;

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  response.setHeader('Cache-Control', 'no-store, max-age=0');
  const verifiedUser = await verifyFirebaseUser(request.headers.authorization).catch(() => null);
  if (!verifiedUser) return response.status(401).json({ success: false, error: 'Firebase authentication required.' });

  const query = typeof request.body?.query === 'string' ? request.body.query.trim().slice(0, 500) : '';
  if (!query) return response.status(400).json({ success: false, error: 'Query is required.' });
  if (!process.env.GEMINI_API_KEY) return response.status(503).json({ success: false, error: 'Research model is not configured.' });

  try {
    const prompt = `You are Black Oracle's research generator. Research the exact topic below using Google Search grounding and create a decision-auditable scenario tree.\n\nTOPIC: ${query}\n\nRules:\n- Focus on financial markets, macroeconomics, regulation, geopolitics, market structure, liquidity, and materially relevant technology only.\n- Use current source-grounded facts; never invent evidence.\n- Produce 1-3 analytical questions.\n- For each question produce exactly 3 hypotheses: base/supporting, opposing, neutral.\n- Every hypothesis must have 2-3 scenarios.\n- Scenario probabilities within each hypothesis should be coherent but are analytical estimates, not facts.\n- Include explicit trigger, invalidation, next indicators and expected outcome.\n- Return Korean analytical text where practical.\n- No trade instruction and no execution authority.\n\nReturn JSON only:\n{\n  "summary":"...",\n  "keywords":["..."],\n  "signalType":"MARKET|MACRO|REGULATORY|GEOPOLITICAL|LIQUIDITY|TECHNOLOGY",\n  "signalStrength":0-100,\n  "questions":[{\n    "text":"...",\n    "hypotheses":[{\n      "title":"...",\n      "confidence":0-100,\n      "scenarios":[{\n        "title":"...",\n        "probability":0-100,\n        "impactScore":0-100,\n        "expectedOutcome":"...",\n        "triggerCondition":"...",\n        "invalidationCondition":"...",\n        "nextIndicators":["..."]\n      }]\n    }]\n  }]\n}`;

    const modelResponse = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text = String(modelResponse.text || '').replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Research model did not return JSON.');
    const aiData = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(aiData?.questions) || aiData.questions.length === 0) throw new Error('Research model returned no questions.');

    const groundingChunks = modelResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const searchUrls = groundingChunks.map((chunk: any) => chunk?.web?.uri).filter((value: unknown): value is string => typeof value === 'string' && value.startsWith('http'));

    const signalId = makeId('sig');
    const sourceId = makeId('src');
    const results: Array<{ type: string; data: any }> = [];
    const questionIds: string[] = [];
    const hypothesisIds: string[] = [];
    const scenarioIds: string[] = [];

    for (const question of aiData.questions.slice(0, 3)) {
      const questionId = makeId('q');
      questionIds.push(questionId);
      const linkedHypotheses: string[] = [];

      for (const hypothesis of (Array.isArray(question?.hypotheses) ? question.hypotheses : []).slice(0, 3)) {
        const hypothesisId = makeId('h');
        hypothesisIds.push(hypothesisId);
        linkedHypotheses.push(hypothesisId);
        const linkedScenarios: string[] = [];

        for (const scenario of (Array.isArray(hypothesis?.scenarios) ? hypothesis.scenarios : []).slice(0, 3)) {
          const scenarioId = makeId('sc');
          scenarioIds.push(scenarioId);
          linkedScenarios.push(scenarioId);
          results.push({
            type: 'scenario',
            data: {
              id: scenarioId,
              hypothesisId,
              title: String(scenario?.title || 'Untitled scenario').slice(0, 500),
              probability: clamp(scenario?.probability, 0, 100, 33),
              impactScore: clamp(scenario?.impactScore, 0, 100, 50),
              feasibility: 'Unreviewed',
              triggerCondition: String(scenario?.triggerCondition || 'Not specified').slice(0, 1200),
              invalidationCondition: String(scenario?.invalidationCondition || 'Not specified').slice(0, 1200),
              evidenceIds: [],
              timeline: 'Unspecified',
              expectedOutcome: String(scenario?.expectedOutcome || 'Not specified').slice(0, 1600),
              nextIndicators: (Array.isArray(scenario?.nextIndicators) ? scenario.nextIndicators : []).map(String).slice(0, 8),
              status: 'MONITORING',
              generatedBy: 'research-oracle-v0.3',
              executionAuthority: false,
            },
          });
        }

        results.push({
          type: 'hypothesis',
          data: {
            id: hypothesisId,
            title: String(hypothesis?.title || 'Untitled hypothesis').slice(0, 500),
            description: 'Source-grounded Oracle research hypothesis. Requires Evidence/Council review before use.',
            questionId,
            confidence: clamp(hypothesis?.confidence, 0, 100, 50),
            evidenceIds: [],
            scenarioIds: linkedScenarios,
            status: 'Monitoring',
            generatedBy: 'research-oracle-v0.3',
            executionAuthority: false,
          },
        });
      }

      results.push({
        type: 'question',
        data: {
          id: questionId,
          text: String(question?.text || query).slice(0, 1000),
          signalIds: [signalId],
          hypothesisIds: linkedHypotheses,
        },
      });
    }

    const now = new Date().toISOString();
    const source = {
      id: sourceId,
      title: `Oracle Research: ${query}`,
      sourceName: 'Google Search grounding + Oracle synthesis',
      sourceType: 'search',
      status: 'LIVE',
      originalUrl: searchUrls[0] || '',
      collectedAt: now,
      publishedAt: now,
      reliability: 0,
      reliabilityState: 'UNASSESSED',
      language: 'ko',
      region: 'Global',
      category: String(aiData?.signalType || 'Research'),
      summary: String(aiData?.summary || '').slice(0, 2000),
      rawTextSnippet: searchUrls.slice(0, 12).join('\n'),
      extractedKeywords: (Array.isArray(aiData?.keywords) ? aiData.keywords : []).map(String).slice(0, 12),
      extractedEntities: [],
      linkedSignalIds: [signalId],
      linkedQuestionIds: questionIds,
      linkedHypothesisIds: hypothesisIds,
      linkedScenarioIds: scenarioIds,
      evidenceRole: 'research-source',
      generatedBy: 'research-oracle-v0.3',
    };
    const signal = {
      id: signalId,
      title: `[${String(aiData?.signalType || 'RESEARCH')}] ${query}`.slice(0, 500),
      category: String(aiData?.signalType || 'RESEARCH'),
      signalStrength: clamp(aiData?.signalStrength, 0, 100, 50),
      urgency: 50,
      novelty: 50,
      sourceIds: [sourceId],
      linkedQuestionIds: questionIds,
      summary: String(aiData?.summary || '').slice(0, 1200),
      detectedAt: now,
      generatedBy: 'research-oracle-v0.3',
      executionAuthority: false,
    };

    results.push({ type: 'source', data: source });
    results.push({ type: 'signal', data: signal });

    return response.status(200).json({
      success: true,
      user: { uid: verifiedUser.uid },
      count: results.length,
      data: results,
      query,
      searchUrls,
      sourceId,
      persisted: false,
      executionAuthority: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown research generation error.';
    console.error('Research Oracle error:', error);
    return response.status(500).json({ success: false, error: message });
  }
}
