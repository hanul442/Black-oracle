const json = (response: any, status: number, body: Record<string, unknown>) =>
  response.status(status).json(body);

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }

  const configured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-5.4-mini';

  return json(response, 200, {
    success: true,
    provider: 'openai',
    configured,
    model,
    councilMode: 'ADVISORY_ONLY',
    secretExposed: false,
  });
}
