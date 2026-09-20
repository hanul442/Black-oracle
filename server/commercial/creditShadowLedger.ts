import type {
  CreditActionType,
  CreditLedgerEntry,
  CreditWalletBalance,
  CreditWalletBucket,
} from '../../src/commercial/creditContracts';

const dbConfig = () => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  return base && key
    ? {
        base,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    : null;
};

const balanceEffect = (entry: CreditLedgerEntry) => {
  switch (entry.kind) {
    case 'GRANT':
    case 'PURCHASE':
    case 'REVERSAL':
    case 'ADJUSTMENT':
      return entry.credits;
    case 'DEBIT':
      return -entry.credits;
    case 'RESERVE':
    case 'RELEASE':
      return 0;
  }
};

export type CreditLedgerSnapshot = CreditWalletBalance & {
  reservedCredits: number;
  availableCredits: number;
};

export const projectCreditLedger = (
  accountId: string,
  entries: CreditLedgerEntry[],
): CreditLedgerSnapshot => {
  const bucketTotals: Record<CreditWalletBucket, number> = {
    RECURRING_PLAN: 0,
    PROMOTIONAL: 0,
    PURCHASED: 0,
  };
  const openReserves = new Map<string, number>();

  for (const entry of [...entries].sort((a, b) => a.occurredAt - b.occurredAt || a.entryId.localeCompare(b.entryId))) {
    if (entry.accountId !== accountId) continue;

    bucketTotals[entry.bucket] += balanceEffect(entry);

    if (entry.kind === 'RESERVE') {
      openReserves.set(entry.entryId, entry.credits);
    }

    if ((entry.kind === 'RELEASE' || entry.kind === 'DEBIT') && entry.relatedEntryId) {
      openReserves.delete(entry.relatedEntryId);
    }
  }

  const recurringPlanCredits = Math.max(0, bucketTotals.RECURRING_PLAN);
  const promotionalCredits = Math.max(0, bucketTotals.PROMOTIONAL);
  const purchasedCredits = Math.max(0, bucketTotals.PURCHASED);
  const reservedCredits = [...openReserves.values()].reduce((sum, value) => sum + value, 0);
  const total = recurringPlanCredits + promotionalCredits + purchasedCredits;

  return {
    accountId,
    recurringPlanCredits,
    promotionalCredits,
    purchasedCredits,
    reservedCredits,
    availableCredits: Math.max(0, total - reservedCredits),
    updatedAt: entries.reduce((max, entry) => entry.accountId === accountId ? Math.max(max, entry.occurredAt) : max, 0),
  };
};

export const appendShadowCreditEntry = async (entry: CreditLedgerEntry) => {
  const db = dbConfig();
  if (!db) return { persisted: false };

  const response = await fetch(`${db.base}/rest/v1/black_oracle_credit_ledger_shadow`, {
    method: 'POST',
    headers: { ...db.headers, Prefer: 'return=minimal' },
    body: JSON.stringify({
      entry_id: entry.entryId,
      account_id: entry.accountId,
      bucket: entry.bucket,
      kind: entry.kind,
      credits: entry.credits,
      action_type: entry.actionType ?? null,
      quote_id: entry.quoteId ?? null,
      job_id: entry.jobId ?? null,
      related_entry_id: entry.relatedEntryId ?? null,
      occurred_at: new Date(entry.occurredAt).toISOString(),
      reason: entry.reason,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Shadow Credit ledger write failed (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }
  return { persisted: true };
};

export const readShadowCreditEntries = async (
  accountId: string,
  limit = 5000,
): Promise<CreditLedgerEntry[]> => {
  const db = dbConfig();
  if (!db) return [];
  const safeLimit = Math.max(1, Math.min(10_000, Math.trunc(limit)));
  const url = new URL(`${db.base}/rest/v1/black_oracle_credit_ledger_shadow`);
  url.searchParams.set('account_id', `eq.${accountId}`);
  url.searchParams.set('select', '*');
  url.searchParams.set('order', 'occurred_at.asc,recorded_at.asc');
  url.searchParams.set('limit', String(safeLimit));

  const response = await fetch(url, {
    headers: db.headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Shadow Credit ledger read failed (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }

  const rows = await response.json() as any[];
  return rows.map((row) => ({
    entryId: String(row.entry_id),
    accountId: String(row.account_id),
    bucket: String(row.bucket) as CreditWalletBucket,
    kind: String(row.kind) as CreditLedgerEntry['kind'],
    credits: Number(row.credits),
    actionType: row.action_type == null ? null : String(row.action_type) as CreditActionType,
    quoteId: row.quote_id == null ? null : String(row.quote_id),
    jobId: row.job_id == null ? null : String(row.job_id),
    relatedEntryId: row.related_entry_id == null ? null : String(row.related_entry_id),
    occurredAt: Date.parse(row.occurred_at),
    reason: String(row.reason ?? ''),
  }));
};

export const readShadowCreditBalance = async (accountId: string) =>
  projectCreditLedger(accountId, await readShadowCreditEntries(accountId));
