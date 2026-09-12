import React from 'react';
import { BlackOracleMobileApp as BlackOracleMobileAppV8Swipe } from './BlackOracleMobileAppV8Swipe';

/**
 * Mobile V8 runs inside a legacy app shell whose #root/body are intentionally
 * overflow-hidden for the desktop console. Give the mobile surface its own
 * viewport-sized vertical scroll container instead of changing the global shell.
 */
export const BlackOracleMobileApp = () => (
  <div
    className="h-[100dvh] w-full overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y"
    style={{ WebkitOverflowScrolling: 'touch' }}
  >
    <BlackOracleMobileAppV8Swipe />
  </div>
);
