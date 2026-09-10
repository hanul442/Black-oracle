import {
  readCouncilCounterfactualReport,
} from '../server/trading/councilCounterfactual';
import { S2_STRATEGY_RESEARCH_RUNTIME_ID } from '../server/trading/strategyShadowPool';

const json = (response: any, status: number, body: Record<string, unknown>) => response.status(status).json(body);

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  const runtimeId = String(request.query?.runtimeId ?? S2_STRATEGY_RESEARCH_RUNTIME_ID).trim();
  if (runtimeId !== S2_STRATEGY_RESEARCH_RUNTIME_ID) {
    return json(response, 400, {
      success: false,
      researchOnly: true,
      error: 'This counterfactual evaluator is currently restricted to the isolated S2 shadow runtime.',
    });
  }
  const limit = Math.max(1, Math.min(500, Math.trunc(Number(request.query?.limit ?? 200)) || 200));

  try {
    const report = await readCouncilCounterfactualReport(runtimeId, limit);
    return json(response, 200, {
      success: true,
      researchOnly: true,
      ...report,
    });
  } catch (error) {
    return json(response, 500, {
      success: false,
      researchOnly: true,
      runtimeId,
      causalClaimAllowed: false,
      policyChangeAuthority: false,
      executionAuthority: false,
      error: error instanceof Error ? error.message : 'Unknown Council counterfactual error.',
    });
  }
}
