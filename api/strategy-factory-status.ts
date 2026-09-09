export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
    const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
    if (!base || !key) return response.status(503).json({ success: false, available: false, error: 'Supabase is not configured.' });
    const url = new URL(`${base}/rest/v1/black_oracle_strategy_factory_runs`);
    url.searchParams.set('select', 'id,market,timeframe_minutes,bars,candidate_count,seed,started_at,finished_at,status_counts,top_results,factory_version,generation_count,blind_fraction,lifecycle_counts,human_approval_required,execution_authority,promotion_authority');
    url.searchParams.set('order', 'finished_at.desc');
    url.searchParams.set('limit', '5');
    const result = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!result.ok) throw new Error(`Strategy Factory status read failed (${result.status}): ${(await result.text()).slice(0, 240)}`);
    const runs = await result.json();
    return response.status(200).json({
      success: true,
      available: true,
      runs,
      latestRun: runs?.[0] ?? null,
      governance: {
        automaticChampionPromotion: false,
        automaticLiveDeployment: false,
        humanApprovalRequired: true,
      },
    });
  } catch (error) {
    return response.status(500).json({ success: false, available: false, error: error instanceof Error ? error.message : 'Unknown Strategy Factory status error.' });
  }
}
