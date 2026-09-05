import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../store';

const COLLECTION_BY_TYPE: Record<string, string> = {
  source: 'sources',
  signal: 'signals',
  question: 'questions',
  hypothesis: 'hypotheses',
  scenario: 'scenarios',
  evidence: 'evidence',
  prediction: 'predictions',
  report: 'reports',
};

const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;

export const persistResearchResults = async (
  userId: string,
  items: Array<{ type: string; data: Record<string, unknown> }>,
) => {
  const uid = userId.trim();
  if (!uid) throw new Error('Authenticated user id is required.');
  const accepted = items.filter((item) => {
    const collectionName = COLLECTION_BY_TYPE[item.type];
    const id = typeof item.data?.id === 'string' ? item.data.id : '';
    return Boolean(collectionName && VALID_ID.test(id));
  });
  if (!accepted.length) throw new Error('Research response contained no persistable objects.');
  if (accepted.length > 450) throw new Error('Research response exceeded the client persistence limit.');

  const batch = writeBatch(db);
  for (const item of accepted) {
    const collectionName = COLLECTION_BY_TYPE[item.type];
    const id = String(item.data.id);
    batch.set(doc(db, 'users', uid, collectionName, id), {
      ...item.data,
      ownerUid: uid,
      persistedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
  return accepted.length;
};
