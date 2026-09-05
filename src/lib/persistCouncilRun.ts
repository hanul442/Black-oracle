import { doc, setDoc } from 'firebase/firestore';
import { db } from '../store';

const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;

type CouncilPersistenceMetadata = {
  id: string;
  ownerUid: string;
  persistedAt: string;
  executionAuthority: false;
};

export const persistCouncilRun = async <T extends Record<string, unknown>>(
  userId: string,
  run: T,
): Promise<T & CouncilPersistenceMetadata> => {
  const uid = userId.trim();
  if (!uid) throw new Error('Authenticated user id is required.');
  const runId = `council_${Date.now()}_${globalThis.crypto.randomUUID()}`.slice(0, 128);
  if (!VALID_ID.test(runId)) throw new Error('Council run id is invalid.');

  const payload = {
    ...run,
    id: runId,
    ownerUid: uid,
    persistedAt: new Date().toISOString(),
    executionAuthority: false as const,
  };
  await setDoc(doc(db, 'users', uid, 'councilRuns', runId), payload);
  return payload;
};
