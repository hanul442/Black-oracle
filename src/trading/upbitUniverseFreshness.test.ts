import { describe, expect, it } from 'vitest';
import { evaluateUniverseFreshness } from './upbitUniverseFreshness';

describe('evaluateUniverseFreshness', () => {
  const now = new Date('2026-09-20T14:00:00.000Z');

  it('accepts a snapshot within the allowed age', () => {
    expect(evaluateUniverseFreshness({ observedAt: '2026-09-20T13:56:00.000Z' }, now)).toMatchObject({
      usable: true,
      reason: 'FRESH',
      ageMs: 240_000,
    });
  });

  it('fails closed when the snapshot is stale', () => {
    expect(evaluateUniverseFreshness({ observedAt: '2026-09-20T13:54:59.999Z' }, now)).toMatchObject({
      usable: false,
      reason: 'STALE',
    });
  });

  it('fails closed for timestamps beyond allowed future skew', () => {
    expect(evaluateUniverseFreshness({ observedAt: '2026-09-20T14:00:31.000Z' }, now)).toMatchObject({
      usable: false,
      reason: 'FUTURE_TIMESTAMP',
    });
  });

  it('fails closed for invalid timestamps', () => {
    expect(evaluateUniverseFreshness({ observedAt: 'not-a-date' }, now)).toEqual({
      usable: false,
      reason: 'INVALID_TIMESTAMP',
      ageMs: null,
    });
  });
});
