import React, { useRef } from 'react';
import { BlackOracleMobileApp as BlackOracleMobileAppV81 } from './BlackOracleMobileAppV81';

const TAB_LABELS = ['Home', 'Portfolio', 'Positions', 'Activity', 'More'] as const;
const SWIPE_DISTANCE_PX = 56;
const SWIPE_AXIS_RATIO = 1.25;
const SWIPE_MAX_DURATION_MS = 800;

type TouchOrigin = {
  x: number;
  y: number;
  startedAt: number;
};

const bottomNavButtons = () => Array.from(
  document.querySelectorAll<HTMLButtonElement>('div.fixed.inset-x-0.bottom-0 button'),
).filter((button) => TAB_LABELS.includes((button.textContent ?? '').trim() as (typeof TAB_LABELS)[number]));

const activeTabIndex = (buttons: HTMLButtonElement[]) => {
  const active = buttons.findIndex((button) => {
    const label = button.querySelector('span');
    return typeof label?.className === 'string' && label.className.includes('text-[#17191e]');
  });
  return active >= 0 ? active : 0;
};

export const BlackOracleMobileApp = () => {
  const origin = useRef<TouchOrigin | null>(null);
  const suppressClickUntil = useRef(0);

  return (
    <div
      className="min-h-[100dvh] touch-pan-y"
      onTouchStart={(event) => {
        if (event.touches.length !== 1) {
          origin.current = null;
          return;
        }
        const touch = event.touches[0];
        origin.current = { x: touch.clientX, y: touch.clientY, startedAt: Date.now() };
      }}
      onTouchCancel={() => { origin.current = null; }}
      onTouchEnd={(event) => {
        const start = origin.current;
        origin.current = null;
        if (!start || event.changedTouches.length !== 1) return;

        const touch = event.changedTouches[0];
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        const horizontal = Math.abs(dx) >= SWIPE_DISTANCE_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_AXIS_RATIO;
        const quickEnough = Date.now() - start.startedAt <= SWIPE_MAX_DURATION_MS;
        if (!horizontal || !quickEnough) return;

        const buttons = bottomNavButtons();
        if (buttons.length !== TAB_LABELS.length) return;
        const current = activeTabIndex(buttons);
        const next = dx < 0 ? current + 1 : current - 1;
        if (next < 0 || next >= buttons.length) return;

        suppressClickUntil.current = Date.now() + 350;
        buttons[next].click();
      }}
      onClickCapture={(event) => {
        if (Date.now() > suppressClickUntil.current) return;
        const target = event.target as HTMLElement;
        if (target.closest('div.fixed.inset-x-0.bottom-0')) return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <BlackOracleMobileAppV81 />
    </div>
  );
};
