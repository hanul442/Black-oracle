import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { BlackOracleMobileApp as BlackOracleMobileAppV11_1 } from './BlackOracleMobileAppV11_1';

const V11_DOCUMENT_SCROLL_CLASS = 'bo-v11-document-scroll';
const SOURCE_STALE_MS = 90_000;
const SOURCE_NOT_RUN_GRACE_MS = 15_000;

type DataSourceKey = 'runtime' | 'factory' | 'events';
type DataSourceStatus = 'UNKNOWN' | 'OK' | 'ERROR';
type DerivedIssueStatus = 'ERROR' | 'STALE' | 'NOT RUN';

type DataSourceSnapshot = {
  status: DataSourceStatus;
  checkedAt: number | null;
  httpStatus: number | null;
  detail: string | null;
};

type DataSourceIssue = {
  key: DataSourceKey;
  label: string;
  status: DerivedIssueStatus;
  httpStatus: number | null;
  detail: string | null;
};

const SOURCE_LABELS: Record<DataSourceKey, string> = {
  runtime: 'Runtime',
  factory: 'Strategy Lab',
  events: 'Canonical Events',
};

const INITIAL_SOURCE_HEALTH: Record<DataSourceKey, DataSourceSnapshot> = {
  runtime: { status: 'UNKNOWN', checkedAt: null, httpStatus: null, detail: null },
  factory: { status: 'UNKNOWN', checkedAt: null, httpStatus: null, detail: null },
  events: { status: 'UNKNOWN', checkedAt: null, httpStatus: null, detail: null },
};

const sourceFromRequest = (input: RequestInfo | URL): DataSourceKey | null => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const pathname = new URL(raw, window.location.origin).pathname;
  if (pathname === '/api/trading-status') return 'runtime';
  if (pathname === '/api/strategy-factory-status') return 'factory';
  if (pathname === '/api/events') return 'events';
  return null;
};

const payloadError = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (record.success === false || record.ok === false) {
    return typeof record.error === 'string' && record.error.trim() ? record.error : 'API reported failure';
  }
  if (typeof record.error === 'string' && record.error.trim()) return record.error;
  return null;
};

const DataTruthBanner = ({ issues }: { issues: DataSourceIssue[] }) => {
  if (!issues.length) return null;
  const hasError = issues.some((issue) => issue.status === 'ERROR');
  const hasStale = issues.some((issue) => issue.status === 'STALE');
  const title = hasError ? 'DATA GAP' : hasStale ? 'STALE DATA' : 'DATA NOT RUN';
  const summary = issues.map((issue) => {
    const http = issue.status === 'ERROR' && issue.httpStatus ? ` ${issue.httpStatus}` : '';
    return `${issue.label} ${issue.status}${http}`;
  }).join(' · ');

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(max(env(safe-area-inset-bottom),8px)+64px)] z-[120] mx-auto max-w-[680px] rounded-[16px] border border-[#e8d6b5] bg-[#fffaf0]/96 px-4 py-3 text-[#71511f] shadow-[0_12px_36px_rgba(44,34,17,0.12)] backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-bold tracking-[0.14em]">{title}</div>
          <div className="mt-1 truncate text-[9px] font-semibold">{summary}</div>
          <div className="mt-1 text-[8px] leading-4 text-[#8b6d3d]">일부 read model이 확인되지 않았습니다. 마지막 값이 남아 있을 수 있으며 누락값은 추론하지 않습니다.</div>
        </div>
      </div>
    </div>
  );
};

export const BlackOracleMobileApp = () => {
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [sourceHealth, setSourceHealth] = useState<Record<DataSourceKey, DataSourceSnapshot>>(INITIAL_SOURCE_HEALTH);

  useLayoutEffect(() => {
    const previousFetch = window.fetch;

    const monitoredFetch: typeof window.fetch = async (...args) => {
      const source = sourceFromRequest(args[0]);
      try {
        const response = await previousFetch(...args);
        if (source) {
          const checkedAt = Date.now();
          setSourceHealth((previous) => ({
            ...previous,
            [source]: {
              status: response.ok ? 'OK' : 'ERROR',
              checkedAt,
              httpStatus: response.status,
              detail: response.ok ? null : `HTTP ${response.status}`,
            },
          }));

          const probe = response.clone();
          void probe.json().then((payload: unknown) => {
            const apiError = payloadError(payload);
            if (!apiError) return;
            setSourceHealth((previous) => ({
              ...previous,
              [source]: {
                status: 'ERROR',
                checkedAt: Date.now(),
                httpStatus: response.status,
                detail: apiError,
              },
            }));
          }).catch(() => {
            setSourceHealth((previous) => ({
              ...previous,
              [source]: {
                status: 'ERROR',
                checkedAt: Date.now(),
                httpStatus: response.status,
                detail: 'INVALID JSON',
              },
            }));
          });
        }
        return response;
      } catch (error) {
        if (source) {
          setSourceHealth((previous) => ({
            ...previous,
            [source]: {
              status: 'ERROR',
              checkedAt: Date.now(),
              httpStatus: null,
              detail: error instanceof Error ? error.message : 'NETWORK ERROR',
            },
          }));
        }
        throw error;
      }
    };

    window.fetch = monitoredFetch;
    return () => {
      if (window.fetch === monitoredFetch) window.fetch = previousFetch;
    };
  }, []);

  useEffect(() => {
    document.body.classList.add(V11_DOCUMENT_SCROLL_CLASS);
    return () => document.body.classList.remove(V11_DOCUMENT_SCROLL_CLASS);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const issues = useMemo<DataSourceIssue[]>(() => (Object.keys(SOURCE_LABELS) as DataSourceKey[]).flatMap((key) => {
    const source = sourceHealth[key];
    if (source.status === 'ERROR') {
      return [{ key, label: SOURCE_LABELS[key], status: 'ERROR', httpStatus: source.httpStatus, detail: source.detail }];
    }
    if (source.checkedAt != null && now - source.checkedAt > SOURCE_STALE_MS) {
      return [{ key, label: SOURCE_LABELS[key], status: 'STALE', httpStatus: source.httpStatus, detail: source.detail }];
    }
    if (source.status === 'UNKNOWN' && now - mountedAt > SOURCE_NOT_RUN_GRACE_MS) {
      return [{ key, label: SOURCE_LABELS[key], status: 'NOT RUN', httpStatus: null, detail: null }];
    }
    return [];
  }), [mountedAt, now, sourceHealth]);

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden touch-pan-y">
      <BlackOracleMobileAppV11_1 />
      <DataTruthBanner issues={issues} />
    </div>
  );
};
