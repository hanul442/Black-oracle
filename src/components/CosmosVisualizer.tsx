import React, { useMemo } from 'react';

interface CosmosVisualizerProps {
  seed: string;
  color: string;
  size?: number;
}

const hash = (str: string) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return Math.abs(h);
};

// Generates pseudo-random number 0-1 based on seed and index
const prng = (seedStr: string, index: number) => {
  const h = hash(seedStr + index);
  return (h % 10000) / 10000;
};

export const CosmosVisualizer: React.FC<CosmosVisualizerProps> = ({ seed, color, size = 200 }) => {
  const type = hash(seed) % 6;
  
  const elements = useMemo(() => {
    const paths = [];
    const dots = [];
    const layers = [];

    const cx = size/2;
    const cy = size/2;
    const r = (size/2) * 0.85;

    // Add glowing core and ambient rings
    layers.push(
      <g key="ambient">
        <circle cx={cx} cy={cy} r={r * 0.9} fill={`url(#glowGrad-${seed})`} opacity={0.3} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#glowGrad-${seed})`} strokeWidth={0.5} strokeOpacity={0.5} />
      </g>
    );

    if (type === 0) {
      // Style 0: Fiber optic bundle bursting and magnetic curvature
      for(let i=0; i<200; i++) {
        const angle = prng(seed, i*2) * Math.PI * 2;
        const length = r * (0.2 + 0.8 * prng(seed, i*2+1));
        const curve = prng(seed, i*2+2) * (r * 1.5);
        const x2 = cx + Math.cos(angle) * length;
        const y2 = cy + Math.sin(angle) * length;
        const cX1 = cx + Math.cos(angle + 0.5) * curve;
        const cY1 = cy + Math.sin(angle + 0.5) * curve;
        
        paths.push(
          <path key={`p-${i}`} d={`M ${cx} ${cy} Q ${cX1} ${cY1} ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={prng(seed, i) > 0.8 ? 1.5 : 0.5} strokeOpacity={0.1 + prng(seed, i)*0.4} />
        );
        if (prng(seed, i) > 0.85) {
           dots.push(<circle key={`d-${i}`} cx={x2} cy={y2} r={1.5} fill="#ffffff" fillOpacity={0.8} filter={`url(#glow-${seed})`} />)
        }
      }
    } else if (type === 1) {
      // Style 1: Dense nested wavy woven sphere with phase offsets
      for(let i=0; i<120; i++) {
         const t = prng(seed, i) * Math.PI;
         const phase = prng(seed, i+1) * Math.PI * 2;
         const amp = prng(seed, i+2) * (r * 0.5);
         const pathD = [];
         for (let angle = 0; angle <= Math.PI * 2.1; angle += 0.15) {
            const rad = r * Math.sin(angle/2) + Math.sin(angle * 7 + phase) * amp;
            const x = cx + Math.abs(rad) * Math.cos(angle + t);
            const y = cy + Math.abs(rad) * Math.sin(angle + t * 2);
            if (angle === 0) {
               pathD.push(`M ${x} ${y}`);
            } else {
               pathD.push(`S ${x - 5} ${y - 5}, ${x} ${y}`);
            }
         }
         paths.push(<path key={`p-${i}`} d={pathD.join(' ')} fill="none" stroke={color} strokeWidth={0.3} strokeOpacity={0.3} />);
      }
    } else if (type === 2) {
      // Style 2: 3D Torus/Contour lines with interference mapping
      for(let i=0; i<180; i++) {
        const randR = r * (0.1 + 0.9 * Math.pow(prng(seed, i), 0.7));
        const rot = prng(seed, i+1) * 360;
        const rx = randR * (0.1 + 0.9 * prng(seed, i+2));
        const ry = randR;
        
        paths.push(
          <ellipse key={`e-${i}`} cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot}, ${cx}, ${cy})`} fill="none" stroke={color} strokeWidth={0.4} strokeOpacity={0.3} />
        );
      }
      paths.push(<circle key="core" cx={cx} cy={cy} r={r * 0.2} fill={color} opacity={0.8} filter={`url(#glow-${seed})`} />);
    } else if (type === 3) {
      // Style 3: Sliced planar planetary magnetic dipole
      for(let i=0; i<120; i++) {
        const spread = prng(seed, i);
        const radiusCurve = r * Math.pow(spread, 0.6) * 1.5;
        const sign = prng(seed, i+1) > 0.5 ? 1 : -1;
        
        paths.push(
           <path key={`p-${i}`} d={`M ${cx} ${cy - r} A ${radiusCurve} ${r} 0 0 ${sign === 1 ? 1 : 0} ${cx} ${cy + r}`} fill="none" stroke={color} strokeWidth={0.6} strokeOpacity={0.35} />
        );
         // Inner density
        const rx = r * prng(seed, i*3);
        paths.push(<line key={`l-${i}`} x1={cx - rx} y1={cy - r + (r*2*prng(seed, i))} x2={cx + rx} y2={cy - r + (r*2*prng(seed, i))} stroke={color} strokeWidth={0.2} strokeOpacity={0.4} />);
      }
      paths.push(<circle key="bound" cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.6} filter={`url(#glow-${seed})`} />)
    } else if (type === 4) {
      // Style 4: Particle cloud with geometric constellations
      for(let i=0; i<400; i++) {
        const pR = r * Math.pow(prng(seed, i), 0.6);
        const pAngle = prng(seed, i+1) * Math.PI * 2;
        const px = cx + Math.cos(pAngle) * pR;
        const py = cy + Math.sin(pAngle) * pR;
        const size = prng(seed, i+2) > 0.97 ? 3 : (prng(seed, i+2) > 0.8 ? 1.5 : 0.6);
        dots.push(<circle key={`d-${i}`} cx={px} cy={py} r={size} fill={size > 1.5 ? '#fff' : color} fillOpacity={size > 1.5 ? 1 : 0.5 + prng(seed, i)*0.4} filter={size > 1.5 ? `url(#glow-${seed})` : ''} />);
        
        if (prng(seed, i) > 0.95 && i > 0) {
           const oR = r * Math.pow(prng(seed, i-1), 0.6);
           const oAngle = prng(seed, i) * Math.PI * 2;
           const ox = cx + Math.cos(oAngle) * oR;
           const oy = cy + Math.sin(oAngle) * oR;
           paths.push(<line key={`l-${i}`} x1={px} y1={py} x2={ox} y2={oy} stroke={color} strokeWidth={0.5} strokeOpacity={0.6} />)
        }
      }
    } else {
       // Style 5: Horizontal layered sliced sphere (like reference image)
       for(let i=0; i<30; i++) {
          const yPos = cy - r + (i * (r*2)/30);
          const sliceRadius = Math.sqrt(Math.pow(r, 2) - Math.pow(yPos - cy, 2));
          const height = (r*2)/40;
          
          paths.push(
             <ellipse key={`slice-${i}`} cx={cx} cy={yPos} rx={sliceRadius} ry={height} fill={color} fillOpacity={0.1 + (0.5 * Math.sin(i*0.4))} stroke={color} strokeWidth={1} strokeOpacity={0.8} filter={`url(#glow-${seed})`} />
          );
       }
       for(let i=0; i<15; i++) {
         const yPos = cy - r + (Math.random() * r * 2);
         paths.push(<line key={`h-l-${i}`} x1={cx - r} y1={yPos} x2={cx + r} y2={yPos} stroke="#fff" strokeWidth={1} strokeOpacity={0.4} filter={`url(#glow-${seed})`} />);
       }
    }

    return { paths, dots, layers };
  }, [seed, color, size, type]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
       <defs>
          <filter id={`glow-${seed}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <radialGradient id={`glowGrad-${seed}`} cx="50%" cy="50%" r="50%">
             <stop offset="0%" stopColor={color} stopOpacity="0.4" />
             <stop offset="70%" stopColor={color} stopOpacity="0.1" />
             <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
       </defs>
       {elements.layers}
       <g style={{ transformOrigin: 'center', animation: `spin ${80 + (hash(seed) % 60)}s linear infinite ${hash(seed) % 2 === 0 ? 'reverse' : 'normal'}` }}>
         {elements.paths}
         {elements.dots}
       </g>
    </svg>
  );
};
