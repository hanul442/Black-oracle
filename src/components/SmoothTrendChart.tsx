import React, { useMemo } from 'react';
import { motion } from 'motion/react';

interface SmoothTrendChartProps {
  color: string;
  probability: number; // 0 to 100
  width?: number;
  height?: number;
}

export const SmoothTrendChart: React.FC<SmoothTrendChartProps> = ({ color, probability, width = 300, height = 150 }) => {
  const pathData = useMemo(() => {
    // Generate a smooth path. Start at left middle, end at right (height based on probability)
    // probability 0 -> y = height (bottom)
    // probability 100 -> y = 0 (top)
    
    // Convert probability to y coordinate
    const targetY = height - (probability / 100) * height;
    
    // We will use 4 points for a nice bezier curve
    const p1 = { x: 0, y: height * 0.8 }; 
    const p2 = { x: width * 0.33, y: height * 0.5 + (Math.random() * 40 - 20) };
    const p3 = { x: width * 0.66, y: targetY + (Math.random() * 40 - 20) };
    const p4 = { x: width, y: targetY };
    
    // Smooth bezier curve
    return `M ${p1.x},${p1.y} C ${p2.x},${p1.y} ${p3.x},${p4.y} ${p4.x},${p4.y}`;
  }, [probability, width, height]);

  // Create area path for the gradient below the line
  const areaPath = `${pathData} L ${width},${height} L 0,${height} Z`;

  return (
    <div className="relative pointer-events-none" style={{ width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
          <filter id={`glow-${color.replace('#', '')}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Gradient fill */}
        <motion.path
          d={areaPath}
          fill={`url(#gradient-${color.replace('#', '')})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
        />

        {/* Main Line */}
        <motion.path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          filter={`url(#glow-${color.replace('#', '')})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />

        {/* End glowing dot */}
        <motion.circle
          cx={width}
          cy={height - (probability / 100) * height}
          r="6"
          fill="#ffffff"
          filter={`url(#glow-${color.replace('#', '')})`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.8, duration: 0.5, type: "spring", bounce: 0.5 }}
        />
      </svg>
    </div>
  );
};
