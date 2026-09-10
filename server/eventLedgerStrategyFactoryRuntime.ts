import type { CanonicalEventInput } from './eventLedger';

/**
 * Strategy Factory is research-only, but its canonical events still need an
 * explicit runtime owner so Decision/Experiment replay can distinguish S2
 * research from legacy or future research runtimes.
 */
export const attachStrategyFactoryRuntime = (
  events: CanonicalEventInput[],
  runtimeId: string,
): CanonicalEventInput[] => {
  const normalizedRuntimeId = String(runtimeId ?? '').trim();
  if (!normalizedRuntimeId) throw new Error('Strategy Factory canonical events require a runtime id.');

  return events.map((event) => ({
    ...event,
    runtimeId: normalizedRuntimeId,
  }));
};
