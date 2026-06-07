import React from 'react';
import { motion } from 'motion/react';

interface ProbabilityGaugeProps {
  value: number; // 0 to 100
  label?: string;
  size?: number;
  colorPrimary?: string;
  colorSecondary?: string;
}

export const ProbabilityGauge: React.FC<ProbabilityGaugeProps> = ({ 
  value, 
  label = "CONFIDENCE", 
  size = 120,
  colorPrimary = "#ef4444", 
  colorSecondary = "#dc2626" 
}) => {
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center p-2" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 transform -rotate-90">
        <defs>
          <linearGradient id={`gaugeGrad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorPrimary} stopOpacity="1" />
            <stop offset="100%" stopColor={colorSecondary} stopOpacity="0.8" />
          </linearGradient>
          <filter id={`gaugeGlow-${size}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        
        {/* Animated value track */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#gaugeGrad-${size})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
          filter={`url(#gaugeGlow-${size})`}
        />
      </svg>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div 
          className="text-2xl font-display text-white"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          {Math.round(value)}%
        </motion.div>
        <motion.div 
          className="text-[9px] uppercase font-mono text-gray-400 tracking-widest mt-0.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          {label}
        </motion.div>
      </div>
    </div>
  );
};
