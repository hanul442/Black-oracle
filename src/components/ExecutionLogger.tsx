import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Clock } from 'lucide-react';

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  icon: React.FC<any>;
  baseDuration: number;
}

interface ExecutionLoggerProps {
  steps: WorkflowStep[];
  currentStepIndex: number;
  progress: number;
  isFinished: boolean;
}

export const ExecutionLogger: React.FC<ExecutionLoggerProps> = ({
  steps,
  currentStepIndex,
  progress,
  isFinished
}) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (isFinished) {
      setTimeLeft(0);
      return;
    }

    let remainingTime = 0;
    // Add remaining time for current step
    const currentStep = steps[currentStepIndex];
    if (currentStep) {
      remainingTime += currentStep.baseDuration * (1 - progress / 100);
    }
    
    // Add full time for pending steps
    for (let i = currentStepIndex + 1; i < steps.length; i++) {
        remainingTime += steps[i].baseDuration;
    }

    setTimeLeft(remainingTime);
  }, [steps, currentStepIndex, progress, isFinished]);

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-[250px] scrollbar-hide flex flex-col gap-4 relative">
      {!isFinished && (
         <div className="sticky top-0 z-20 flex justify-end mb-4">
            <div className="px-3 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-xs font-mono flex items-center gap-2 shadow-[0_4px_15px_rgba(6,182,212,0.2)] backdrop-blur-md">
                <Clock className="w-3.5 h-3.5" />
                <span>예상 소요 시간: {Math.max(1, Math.ceil(timeLeft / 1000))}초</span>
            </div>
         </div>
      )}

      {steps.map((step, index) => {
        const isActive = index === currentStepIndex && !isFinished;
        const isCompleted = index < currentStepIndex || isFinished;
        const isPending = index > currentStepIndex && !isFinished;

        if (isPending) {
          return (
            <div key={step.id} className="opacity-20 flex items-start gap-4 p-4 rounded-xl border border-white/5 bg-white/5 grayscale">
              <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center shrink-0 border border-white/10">
                <step.icon className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-mono text-gray-400 uppercase tracking-widest">{step.title}</div>
              </div>
            </div>
          );
        }

        return (
          <motion.div 
            key={step.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col gap-3 p-4 rounded-xl border transition-all duration-500 ${isActive ? 'bg-cyan-950/20 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]' : 'bg-black/40 border-white/10'}`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border transition-colors ${isCompleted ? 'bg-green-950/40 border-green-500/50 text-green-400' : 'bg-cyan-950/40 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'}`}>
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-end mb-1">
                  <div className={`text-sm font-mono uppercase tracking-widest ${isActive ? 'text-cyan-300' : 'text-gray-300'}`}>{step.title}</div>
                  {isActive && (
                    <div className="text-xs font-mono text-cyan-400">{Math.floor(progress)}%</div>
                  )}
                </div>
                <div className={`text-[12px] font-sans leading-relaxed ${isActive ? 'text-cyan-100/70' : 'text-gray-500'}`}>
                  {step.description}
                </div>
              </div>
            </div>
            
            {isActive && (
              <div className="w-full h-1 bg-black rounded-full overflow-hidden mt-1 border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "linear", duration: 0.1 }}
                  className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                />
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};
