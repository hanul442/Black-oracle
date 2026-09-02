const requiredSupabase = () => {
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase runtime lease requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return { url, serviceRoleKey };
};

const rpc = async (name: string, body: Record<string, unknown>) => {
  const { url, serviceRoleKey } = requiredSupabase();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`Supabase lease RPC ${name} failed (${response.status}): ${responseBody.slice(0, 300)}`);
  }
  return response.json() as Promise<boolean>;
};

export const claimTradingCycleLease = async (
  runtimeId: string,
  owner: string,
  leaseSeconds = 840,
) => rpc('claim_black_oracle_trading_cycle_lease', {
  p_runtime_id: runtimeId,
  p_owner: owner,
  p_lease_seconds: leaseSeconds,
});

export const releaseTradingCycleLease = async (
  runtimeId: string,
  owner: string,
) => rpc('release_black_oracle_trading_cycle_lease', {
  p_runtime_id: runtimeId,
  p_owner: owner,
});
