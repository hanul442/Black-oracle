import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppContext } from '../store';
import { OracleThinkingOrb, type OracleThinkingPhase } from './OracleThinkingOrb';

export const GlobalLoadingOverlay: React.FC = () => {
  const { isIngestingData, isFirebaseLoading } = useAppContext() as any;
  const [isShowing, setIsShowing] = useState(true);
  const [finished, setFinished] = useState(false);

  const isLoading = isIngestingData || isFirebaseLoading;

  useEffect(() => {
    if (isLoading) {
      setIsShowing(true);
      setFinished(false);
      return;
    }

    setFinished(true);
    const timeout = window.setTimeout(() => setIsShowing(false), 420);
    return () => window.clearTimeout(timeout);
  }, [isLoading]);

  const phase: OracleThinkingPhase = finished
    ? 'idle'
    : isIngestingData
      ? 'collect'
      : 'boot';

  const status = finished
    ? 'SYSTEM ONLINE'
    : isIngestingData
      ? 'COLLECTING EVIDENCE'
      : 'CONNECTING DATA SOURCES';

  return (
    <AnimatePresence>
      {isShowing && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.28 } }}
          className="pointer-events-auto fixed inset-0 z-[9999] flex items-center justify-center bg-[#05070A]/96 backdrop-blur-2xl"
        >
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="flex min-w-[220px] flex-col items-center"
          >
            <OracleThinkingOrb phase={phase} size={64} theme="dark" />
            <div className="mt-6 text-[12px] font-semibold tracking-[0.14em] text-[#E8EDF2]">
              BLACK ORACLE
            </div>
            <div className="mt-2 font-mono text-[8px] uppercase tracking-[0.2em] text-[#7E8994]">
              {status}
            </div>
            <div className="mt-5 h-px w-20 bg-white/[0.08]" />
            <div className="mt-3 font-mono text-[7px] uppercase tracking-[0.14em] text-[#46515B]">
              Evidence-governed runtime
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
