import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RefreshCw } from "lucide-react";
import { useAppContext } from "../store";

export const GlobalLoadingOverlay: React.FC = () => {
  const { isIngestingData, isFirebaseLoading } = useAppContext() as any;
  const [isShowing, setIsShowing] = useState(true);
  const [finished, setFinished] = useState(false);
  const [progress, setProgress] = useState(0);

  const isLoading = isIngestingData || isFirebaseLoading;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (!isLoading) {
      setProgress(100);
      setFinished(true);
      const t = setTimeout(() => {
        setIsShowing(false);
      }, 500);
      return () => clearTimeout(t);
    } else {
      setIsShowing(true);
      setFinished(false);
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 99) return prev;
          return prev + Math.floor(Math.random() * 5);
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  return (
    <AnimatePresence>
      {isShowing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8 } }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#000000]/95 backdrop-blur-3xl pointer-events-auto"
        >
          {/* Central Opal Container */}
          <div className="relative w-[600px] h-[600px] flex flex-col justify-center items-center">
            {/* Rotating Rings Component */}
            <svg
              className="absolute inset-0 w-full h-full animate-[spin_40s_linear_infinite]"
              viewBox="0 0 600 600"
            >
              <defs>
                <linearGradient
                  id="ringGrad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="80%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#f1f5f9" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Outer Thin Ring */}
              <circle
                cx="300"
                cy="300"
                r="260"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1"
              />

              {/* Directional Nodes on Outer Ring */}
              <circle
                cx="300"
                cy="40"
                r="10"
                fill="#050505"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1.5"
              />
              <path
                d="M 297 37 L 303 40 L 297 43 Z"
                fill="rgba(255,255,255,0.6)"
                transform="rotate(-90 300 40)"
              />

              <circle
                cx="75"
                cy="430"
                r="10"
                fill="#050505"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1.5"
              />
              <path
                d="M 72 427 L 78 430 L 72 433 Z"
                fill="rgba(255,255,255,0.6)"
                transform="rotate(30 75 430)"
              />

              <circle
                cx="525"
                cy="430"
                r="10"
                fill="#050505"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1.5"
              />
              <path
                d="M 522 427 L 528 430 L 522 433 Z"
                fill="rgba(255,255,255,0.6)"
                transform="rotate(150 525 430)"
              />

              {/* Thick Segmented Inner Ring */}
              <circle
                cx="300"
                cy="300"
                r="210"
                fill="none"
                stroke="url(#ringGrad)"
                strokeWidth="18"
                strokeDasharray="250 15 80 15 350 20 120 15 40 15"
                filter="url(#glow)"
              />
              <circle
                cx="300"
                cy="300"
                r="210"
                fill="none"
                stroke="rgba(255,255,255,0.6)"
                strokeWidth="18"
                strokeDasharray="250 15 80 15 350 20 120 15 40 15"
              />

              {/* Inner Crossing Chords Math (simulating the traces) */}
              <path
                d="M 152 152 Q 300 250 488 210"
                fill="none"
                stroke="url(#ringGrad)"
                strokeWidth="1"
                strokeOpacity="0.4"
              />
              <path
                d="M 120 380 Q 280 400 480 340"
                fill="none"
                stroke="#6366f1"
                strokeWidth="1"
                strokeOpacity="0.4"
              />
              <path
                d="M 200 480 Q 300 350 448 448"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="1"
                strokeOpacity="0.4"
              />
              <path
                d="M 97 250 Q 250 150 400 95"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="1"
                strokeOpacity="0.4"
              />
            </svg>

            {/* Non-rotating texts tracing the ring */}
            <div className="absolute top-[20px] left-1/2 -translate-x-1/2 text-[10px] font-mono text-gray-300 tracking-[0.25em] uppercase px-3 z-10">
              TARGET DISCOVERY
            </div>
            <div className="absolute top-[430px] right-[2px] origin-center -rotate-[60deg] text-[10px] font-mono text-gray-300 tracking-[0.25em] uppercase px-3 z-10">
              MOLECULE DISCOVERY
            </div>
            <div className="absolute top-[430px] left-[2px] origin-center rotate-[60deg] text-[10px] font-mono text-gray-300 tracking-[0.25em] uppercase px-3 z-10">
              CLINICAL DEVELOPMENT
            </div>

            {/* Central Content */}
            <div className="flex flex-col items-center justify-center z-10 w-[300px]">
              <div className="mb-8">
                <h2 className="text-white font-display font-bold tracking-[0.1em] text-3xl mb-1 text-center whitespace-nowrap">
                  BLACK ORACLE
                </h2>
              </div>

              {/* Status indicator */}
              <div className="flex items-center justify-center h-6">
                {finished ? (
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-emerald-400 font-mono text-[10px] tracking-[0.25em] uppercase border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.15)]"
                  >
                    SYSTEM ONLINE
                  </motion.span>
                ) : (
                  <div className="flex flex-col items-center gap-4 w-48">
                    <span className="text-cyan-400 font-mono text-[16px] tracking-widest uppercase tabular-nums">
                      {Math.min(progress, 100)}%
                    </span>
                    <div className="w-full h-0.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-cyan-400 transition-all duration-100 ease-out"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
