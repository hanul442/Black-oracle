import React, { lazy, Suspense, useEffect, useState } from 'react';

const DesktopApp = lazy(() => import('./App'));
const MobileApp = lazy(() => import('./mobile/BlackOracleMobileApp').then((module) => ({ default: module.BlackOracleMobileApp })));

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
    <div className="flex flex-col items-center gap-3">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d9dee2] border-t-[#303840]" />
      <div className="text-[11px] font-medium tracking-[0.04em] text-[#87919a]">BLACK ORACLE</div>
    </div>
  </div>
);

export const ResponsiveRoot = () => {
  const desktop = useDesktopViewport();
  return <Suspense fallback={<AppBoot />}>{desktop ? <DesktopApp /> : <MobileApp />}</Suspense>;
};
