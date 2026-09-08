const json = (response: any, status: number, body: Record<string, unknown>) =>
  response.status(status).json(body);

const resolveOpenAIKey = () =>
  process.env.OPENAI_API_KEY?.trim() || process.env.OPEN_AI_API?.trim() || '';

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }

  const configured = Boolean(resolveOpenAIKey());
  const councilModel = process.env.OPENAI_MODEL?.trim() || 'gpt-5.6-terra';
  const activityModel = process.env.OPENAI_ACTIVITY_MODEL?.trim() || 'gpt-5.6-luna';
  const fastModel = process.env.OPENAI_FAST_MODEL?.trim() || 'gpt-5.6-luna';

  return json(response, 200, {
    success: true,
    provider: 'openai',
    configured,
    models: {
      council: councilModel,
      activityBrief: activityModel,
      legacyIntelligence: fastModel,
    },
    councilMode: 'ADVISORY_ONLY',
    secretExposed: false,
  });
}
