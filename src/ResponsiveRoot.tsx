import React, { lazy, Suspense, useEffect, useState } from 'react';
import { OracleThinkingOrb } from './components/OracleThinkingOrb';

const DesktopApp = lazy(() => import('./App'));
const MobileApp = lazy(() => import('./mobile/BlackOracleMobileApp').then((module) => ({ default: module.BlackOracleMobileApp })));
const ObservabilityRestore = lazy(() => import('./mobile/ObservabilityRestore').then((module) => ({ default: module.ObservabilityRestore })));
const PositionMonitor = lazy(() => import('./mobile/PositionMonitor').then((module) => ({ default: module.PositionMonitor })));

const desktopQuery = '(min-width: 1024px)';

const useDesktopViewport = () => {
  const [desktop, setDesktop] = useState(() => typeof window === 'undefined' ? false : window.matchMedia(desktopQuery).matches);

  useEffect(() => {
    const media = window.matchMedia(desktopQuery);
    const sync = () => setDesktop(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return desktop;
};

const AppBoot = () => (
  <div className="flex h-[100dvh] w-full items-center justify-center bg-[#f7f8f9] text-[#111418]">
    <div className="flex flex-col items-center gap-4">
      <OracleThinkingOrb phase="boot" size={64} theme="light" />
      <div className="text-[11px] font-medium tracking-[0.08em] text-[#6f7880]">BLACK ORACLE</div>
      <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#a0a7ad]">Connecting core</div>
    </div>
  </div>
);

const DesktopRoot = () => (
  <>
    <DesktopApp />
    <ObservabilityRestore />
    <PositionMonitor />
  </>
);

export const ResponsiveRoot = () => {
  const desktop = useDesktopViewport();
  return <Suspense fallback={<AppBoot />}>{desktop ? <DesktopRoot /> : <MobileApp />}</Suspense>;
};
