import firebaseConfig from '../firebase-applet-config.json';

const NARS_VIEWS = [
  ['documents', 'documents'],
  ['events', 'events'],
  ['metrics', 'metrics'],
  ['debt', 'cutover_debt'],
  ['errors', 'errors'],
] as const;

const json = (response: any, status: number, body: Record<string, unknown>) => {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  return response.status(status).json(body);
};

const bearerToken = (authorization: unknown) => {
  if (typeof authorization !== 'string') return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const allowedViewer = (uid: string) => {
  const configured = String(process.env.NARS_ALLOWED_FIREBASE_UIDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.length === 0 || configured.includes(uid);
};

const verifyFirebaseViewer = async (authorization: unknown) => {
  const token = bearerToken(authorization);
  if (!token) return null;

  const apiKey = process.env.FIREBASE_WEB_API_KEY?.trim() || firebaseConfig.apiKey;
  if (!apiKey) return null;

  const authResponse = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!authResponse.ok) return null;

  const payload = await authResponse.json() as { users?: Array<{ localId?: string; email?: string }> };
  const viewer = payload.users?.[0];
  if (!viewer?.localId || !allowedViewer(viewer.localId)) return null;
  return { uid: viewer.localId, email: viewer.email ?? null };
};

const invokeNars = async (
  supabaseUrl: string,
  serviceRole: string,
  view: string,
  limit: number,
) => {
  const query = new URLSearchParams({ view, limit: String(limit) });
  const upstream = await fetch(
    supabaseUrl.replace(/\/$/, '') + '/functions/v1/nars-live-wire?' + query.toString(),
    {
      headers: {
        authorization: 'Bearer ' + serviceRole,
        apikey: serviceRole,
      },
      signal: AbortSignal.timeout(12_000),
    },
  );
  const payload = await upstream.json().catch(() => ({
    ok: false,
    error: 'invalid_upstream_response',
  }));
  if (!upstream.ok) {
    throw new Error(
      typeof payload?.error === 'string'
        ? payload.error
        : 'NARS Live Wire returned HTTP ' + upstream.status,
    );
  }
  return payload;
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }

  try {
    const viewer = await verifyFirebaseViewer(request.headers.authorization);
    if (!viewer) {
      return json(response, 401, { success: false, error: 'Authenticated Black Oracle session required.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!supabaseUrl || !serviceRole) {
      return json(response, 503, { success: false, error: 'NARS server connection is not configured.' });
    }

    const limit = Math.min(100, Math.max(10, Number.parseInt(String(request.query?.limit ?? '60'), 10) || 60));
    const settled = await Promise.allSettled(
      NARS_VIEWS.map(async ([key, view]) => [
        key,
        await invokeNars(supabaseUrl, serviceRole, view, limit),
      ] as const),
    );

    const data: Record<string, unknown> = {};
    const errors: Array<{ view: string; error: string }> = [];
    settled.forEach((result, index) => {
      const key = NARS_VIEWS[index][0];
      if (result.status === 'fulfilled') {
        data[result.value[0]] = result.value[1];
      } else {
        errors.push({
          view: key,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown upstream error',
        });
      }
    });

    return json(response, errors.length === NARS_VIEWS.length ? 502 : 200, {
      success: errors.length < NARS_VIEWS.length,
      partial: errors.length > 0,
      generatedAt: new Date().toISOString(),
      viewer: { uid: viewer.uid },
      data,
      errors,
      automaticRetirement: false,
    });
  } catch (error) {
    return json(response, 502, {
      success: false,
      error: error instanceof Error ? error.message : 'NARS log request failed.',
      automaticRetirement: false,
    });
  }
}
