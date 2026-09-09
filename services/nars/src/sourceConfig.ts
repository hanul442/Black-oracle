import type { Env, SourceRecord } from './types.ts';

function isSource(value: unknown): value is SourceRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<SourceRecord>;
  return Boolean(v.key && v.name && v.type && v.endpoint && /^https?:\/\//i.test(v.endpoint));
}

export function readSourceConfig(env: Env): SourceRecord[] {
  if (!env.NARS_SOURCE_CONFIG_JSON) return [];
  const parsed = JSON.parse(env.NARS_SOURCE_CONFIG_JSON) as unknown;
  if (!Array.isArray(parsed)) throw new Error('NARS_SOURCE_CONFIG_JSON must be an array');
  return parsed.filter(isSource);
}
