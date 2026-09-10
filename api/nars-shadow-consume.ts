const json = (response: any, status: number, body: Record<string, unknown>) =>
  response.status(status).json(body);

const isAuthorizedScheduler = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Bearer ')) return false;
  const presented = authorization.slice('Bearer '.length);
  const accepted = [process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return accepted.some((secret) => secret === presented);
};

const boundedLimit = (value: unknown) => {
  const parsed = Number(value ?? 12);
  if (!Number.isFinite(parsed)) return 12;
  return Math.max(1, Math.min(50, Math.trunc(parsed)));
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown NARS shadow consume error.';

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }

  if (!isAuthorizedScheduler(request.headers.authorization)) {
    return json(response, 401, { success: false, error: 'Unauthorized NARS shadow invocation.' });
  }

  const runtimeId = process.env.TRADING_RUNTIME_ID?.trim() || 'black-oracle-paper';
  if (runtimeId !== 'black-oracle-paper-s2-shadow') {
    return json(response, 409, {
      success: false,
      runtimeId,
      error: 'NARS shadow consume endpoint is restricted to black-oracle-paper-s2-shadow.',
    });
  }

  if ((process.env.TRADING_PERSISTENCE_BACKEND ?? '').toLowerCase() !== 'supabase') {
    return json(response, 503, {
      success: false,
      runtimeId,
      error: 'NARS shadow consume requires TRADING_PERSISTENCE_BACKEND=supabase.',
    });
  }

  const limit = boundedLimit(request.query?.limit);
  const startedAt = Date.now();

  try {
    // Use the same build-generated runtime bundle as the Paper scheduler so Node never
    // has to resolve the runtime's extensionless TypeScript imports at request time.
    // @ts-ignore build-generated module is replaced by esbuild before deployment packaging.
    const runtimeModule: any = await import('../server/trading/runtime-bundle.mjs');
    const consumeNarsEvidencePackets = runtimeModule.consumeNarsEvidencePackets;
    if (typeof consumeNarsEvidencePackets !== 'function') {
      throw new Error('Trading runtime bundle is missing consumeNarsEvidencePackets.');
    }

    const results = await consumeNarsEvidencePackets(limit) as Array<Record<string, any>>;
    const statusCounts = results.reduce<Record<string, number>>((acc, item) => {
      const status = String(item?.status ?? 'UNKNOWN').toUpperCase();
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});
    const evidenceIds = Array.from(new Set(
      results.flatMap((item) => Array.isArray(item?.evidenceIds) ? item.evidenceIds.map(String) : []),
    ));

    return json(response, 200, {
      success: true,
      runtimeId,
      advisoryOnly: true,
      executionAuthority: false,
      startedAt,
      finishedAt: Date.now(),
      limit,
      processed: results.length,
      statusCounts,
      analyzed: statusCounts.ANALYZED ?? 0,
      mapped: statusCounts.MAPPED ?? 0,
      unmapped: statusCounts.UNMAPPED ?? 0,
      errors: statusCounts.ERROR ?? 0,
      evidenceIds,
      results,
    });
  } catch (error) {
    console.error('NARS shadow consume failed:', error);
    return json(response, 500, {
      success: false,
      runtimeId,
      advisoryOnly: true,
      executionAuthority: false,
      startedAt,
      finishedAt: Date.now(),
      error: errorMessage(error),
    });
  }
}
