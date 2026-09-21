import React from 'react';
import { ThinkingOrb } from '../vendor/thinking-orbs/ThinkingOrb';
import type { OrbSize, OrbTheme } from '../vendor/thinking-orbs/types';

export type OracleThinkingPhase =
  | 'boot'
  | 'collect'
  | 'reason'
  | 'council'
  | 'compose'
  | 'idle';

const PHASE_STATE = {
  boot: 'connecting',
  collect: 'searching',
  reason: 'solving',
  council: 'weaving',
  compose: 'composing',
  idle: 'breathing',
} as const;

const PHASE_LABEL: Record<OracleThinkingPhase, string> = {
  boot: 'Connecting BLACK ORACLE',
  collect: 'Collecting market evidence',
  reason: 'Resolving evidence and scenarios',
  council: 'Council agents are deliberating',
  compose: 'Composing BLACK ORACLE output',
  idle: 'BLACK ORACLE ready',
};

type OracleThinkingOrbProps = {
  phase?: OracleThinkingPhase;
  size?: OrbSize;
  theme?: OrbTheme;
  speed?: number;
  paused?: boolean;
  className?: string;
  label?: string;
};

export const OracleThinkingOrb: React.FC<OracleThinkingOrbProps> = ({
  phase = 'reason',
  size = 64,
  theme = 'dark',
  speed = 1,
  paused = false,
  className,
  label,
}) => (
  <ThinkingOrb
    state={PHASE_STATE[phase]}
    size={size}
    theme={theme}
    speed={speed}
    paused={paused}
    className={className}
    aria-label={label ?? PHASE_LABEL[phase]}
  />
);
