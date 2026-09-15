import { useEffect } from 'react';
import { BlackOracleMobileApp as BlackOracleMobileAppV11_1 } from './BlackOracleMobileAppV11_1';

const V11_DOCUMENT_SCROLL_CLASS = 'bo-v11-document-scroll';

export const BlackOracleMobileApp = () => {
  useEffect(() => {
    document.body.classList.add(V11_DOCUMENT_SCROLL_CLASS);
    return () => document.body.classList.remove(V11_DOCUMENT_SCROLL_CLASS);
  }, []);

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden touch-pan-y">
      <BlackOracleMobileAppV11_1 />
    </div>
  );
};
