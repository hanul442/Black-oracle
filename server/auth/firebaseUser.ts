import firebaseConfig from '../../firebase-applet-config.json';

export interface VerifiedFirebaseUser {
  uid: string;
  email: string | null;
}

const extractBearer = (authorization: unknown) => {
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
};

export const verifyFirebaseUser = async (authorization: unknown): Promise<VerifiedFirebaseUser | null> => {
  const idToken = extractBearer(authorization);
  if (!idToken) return null;

  const apiKey = String((firebaseConfig as any).apiKey || '').trim();
  if (!apiKey) throw new Error('Firebase apiKey is not configured.');

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({}));
  const account = Array.isArray(payload?.users) ? payload.users[0] : null;
  const uid = typeof account?.localId === 'string' ? account.localId.trim() : '';
  if (!uid) return null;

  return {
    uid,
    email: typeof account?.email === 'string' ? account.email : null,
  };
};
