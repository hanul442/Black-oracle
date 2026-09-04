import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Crosshair, Layers3, Radio, X } from 'lucide-react';
import { useAppContext } from '../store';

type FieldNode = {
  id: string;
  label: string;
  type: 'signal' | 'hypothesis' | 'scenario' | 'evidence';
  x: number;
  y: number;
  strength: number;
  confidence: number;
  meta?: string;
};

type FieldEdge = {
  from: string;
  to: string;
  weight: number;
};

const palette = {
  cyan: '#43D9E6',
  gold: '#C7A96B',
  risk: '#D66565',
  ivory: '#E9EDF1',
  muted: '#77818C',
};

const nodeColor = (node: FieldNode) => {
  if (node.type === 'scenario' && node.confidence < 35) return palette.risk;
  if (node.type === 'evidence' && node.confidence >= 80) return palette.gold;
  if (node.type === 'signal') return palette.cyan;
  return palette.ivory;
};

const typeLabel: Record<FieldNode['type'], string> = {
  signal: 'Signals',
  hypothesis: 'Hypotheses',
  scenario: 'Scenarios',
  evidence: 'Evidence',
};

export const OracleFieldView: React.FC = () => {
  const {
    signals,
    hypotheses,
    scenarios,
    evidence,
    setCurrentView,
    setSelectedEntity,
  } = useAppContext() as any;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<FieldNode['type'] | 'all'>('all');

  const { nodes, edges } = useMemo(() => {
    const builtNodes: FieldNode[] = [];
    const builtEdges: FieldEdge[] = [];

    const signalItems = (signals || []).slice(0, 8);
    const hypothesisItems = (hypotheses || []).slice(0, 6);
    const scenarioItems = (scenarios || []).slice(0, 6);
    const evidenceItems = (evidence || []).slice(0, 10);

    const ring = (
      items: any[],
      type: FieldNode['type'],
      radiusX: number,
      radiusY: number,
      centerX: number,
      centerY: number,
      offset: number,
    ) => {
      items.forEach((item, index) => {
        const angle = offset + (Math.PI * 2 * index) / Math.max(items.length, 1);
        const confidence = item.signalStrength ?? item.confidence ?? item.probability ?? item.reliability ?? 50;
        const strength = item.signalStrength ?? item.evidenceWeight ?? item.impactScore ?? item.probability ?? 50;

        builtNodes.push({
          id: item.id,
          label: item.title || item.text || item.statement || type,
          type,
          x: centerX + Math.cos(angle) * radiusX,
          y: centerY + Math.sin(angle) * radiusY,
          strength: Math.max(10, Math.min(100, strength)),
          confidence: Math.max(5, Math.min(100, confidence)),
          meta:
            type === 'signal'
              ? item.category
              : type === 'scenario'
                ? `${item.probability ?? 0}% probability`
                : type === 'evidence'
                  ? `${item.reliability ?? 0}% reliability`
                  : item.status,
        });
      });
    };

    ring(signalItems, 'signal', 165, 118, 500, 350, -0.4);
    ring(hypothesisItems, 'hypothesis', 275, 195, 500, 350, 0.35);
    ring(scenarioItems, 'scenario', 375, 248, 500, 350, -0.1);
    ring(evidenceItems, 'evidence', 435, 300, 500, 350, 0.8);

    const nodeIds = new Set(builtNodes.map((node) => node.id));

    hypothesisItems.forEach((hypothesis: any) => {
      const linkedSignals = signalItems.filter((signal: any) => signal.linkedQuestionIds?.includes(hypothesis.questionId));
      (linkedSignals.length ? linkedSignals : signalItems.slice(0, 1)).forEach((signal: any) => {
        if (nodeIds.has(signal.id) && nodeIds.has(hypothesis.id)) {
          builtEdges.push({ from: signal.id, to: hypothesis.id, weight: hypothesis.confidence || 50 });
        }
      });
    });

    scenarioItems.forEach((scenario: any) => {
      if (nodeIds.has(scenario.hypothesisId) && nodeIds.has(scenario.id)) {
        builtEdges.push({ from: scenario.hypothesisId, to: scenario.id, weight: scenario.probability || 50 });
      }
    });

    evidenceItems.forEach((item: any) => {
      const target = item.linkedScenarioBranchId || item.linkedHypothesisId;
      if (target && nodeIds.has(target) && nodeIds.has(item.id)) {
        builtEdges.push({ from: item.id, to: target, weight: item.evidenceWeight || item.reliability || 50 });
      }
    });

    return { nodes: builtNodes, edges: builtEdges };
  }, [signals, hypotheses, scenarios, evidence]);

  const activeNode = nodes.find((node) => node.id === activeId) || null;
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const neighbors = useMemo(() => {
    if (!activeId) return new Set<string>();
    const next = new Set<string>([activeId]);
    edges.forEach((edge) => {
      if (edge.from === activeId) next.add(edge.to);
      if (edge.to === activeId) next.add(edge.from);
    });
    return next;
  }, [activeId, edges]);

  const activate = (node: FieldNode) => {
    setActiveId(node.id);
    setSelectedEntity({ type: node.type, id: node.id });
  };

  const isNodeVisible = (node: FieldNode) => {
    const filterMatch = typeFilter === 'all' || node.type === typeFilter || (activeId ? neighbors.has(node.id) : false);
    const relationMatch = !activeId || neighbors.has(node.id);
    return filterMatch && relationMatch;
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#05070A] text-[#E9EDF1]">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 46%, rgba(67,217,230,0.08), transparent 34%), linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
          backgroundSize: 'auto, 48px 48px, 48px 48px',
        }}
      />

      <div className="pointer-events-none absolute left-4 top-4 z-20 md:left-8 md:top-7">
        <div className="mb-2 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.25em] text-[#77818C] md:text-[9px]">
          <Radio className="h-3 w-3 text-[#43D9E6]" />
          Live intelligence field
        </div>
        <h1 className="text-lg font-medium tracking-[-0.02em] md:text-2xl">Oracle Field</h1>
        <p className="mt-1 hidden max-w-[320px] text-xs leading-relaxed text-[#77818C] sm:block">
          Observe relationships first. Focus a node to isolate the evidence chain.
        </p>
      </div>

      <div className="absolute right-4 top-4 z-20 hidden items-center gap-5 font-mono text-[8px] uppercase tracking-[0.18em] text-[#77818C] md:flex">
        <span>{signals?.length || 0} signals</span>
        <span>{hypotheses?.length || 0} hypotheses</span>
        <span>{scenarios?.length || 0} scenarios</span>
        <span>{evidence?.length || 0} evidence</span>
      </div>

      <div className="absolute left-1/2 top-[68px] z-30 flex -translate-x-1/2 items-center gap-1 border border-white/[0.06] bg-[#070A0E]/78 p-1 backdrop-blur-md md:top-[74px]">
        {(['all', 'signal', 'hypothesis', 'scenario', 'evidence'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setTypeFilter(item)}
            className={`px-2 py-1.5 font-mono text-[6px] uppercase tracking-[0.12em] transition md:px-2.5 md:text-[7px] ${
              typeFilter === item ? 'bg-white/[0.05] text-[#D7DDE3]' : 'text-[#4F5963] hover:text-[#87919B]'
            }`}
          >
            {item === 'all' ? 'All' : typeLabel[item]}
          </button>
        ))}
      </div>

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="fieldCore">
            <stop offset="0%" stopColor="#43D9E6" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#43D9E6" stopOpacity="0" />
          </radialGradient>
        </defs>

        <motion.g
          style={{ transformOrigin: '500px 350px' }}
          animate={{ scale: [1, 1.008, 1], opacity: [0.96, 1, 0.96] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        >
          <circle cx="500" cy="350" r="175" fill="url(#fieldCore)" />
          <circle cx="500" cy="350" r="175" fill="none" stroke="#43D9E6" strokeOpacity="0.05" />
          <circle cx="500" cy="350" r="290" fill="none" stroke="#FFFFFF" strokeOpacity="0.025" />
          <circle cx="500" cy="350" r="405" fill="none" stroke="#FFFFFF" strokeOpacity="0.02" />

          {edges.map((edge, index) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;
            const activeRelation = !activeId || (neighbors.has(edge.from) && neighbors.has(edge.to));
            const filterRelation = typeFilter === 'all' || from.type === typeFilter || to.type === typeFilter || Boolean(activeId);
            const visible = activeRelation && filterRelation;
            return (
              <motion.line
                key={`${edge.from}-${edge.to}-${index}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={activeId && visible ? palette.cyan : '#7D8792'}
                strokeOpacity={visible ? (activeId ? 0.42 : 0.13) : 0.018}
                strokeWidth={0.4 + (edge.weight / 100) * 1.3}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: index * 0.025 }}
              />
            );
          })}

          {edges.slice(0, 14).map((edge, index) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;
            const activeRelation = !activeId || (neighbors.has(edge.from) && neighbors.has(edge.to));
            if (!activeRelation) return null;
            return (
              <motion.circle
                key={`flow-${edge.from}-${edge.to}-${index}`}
                r={1.1 + (edge.weight / 100) * 0.8}
                fill={edge.weight >= 75 ? palette.gold : palette.cyan}
                animate={{
                  cx: [from.x, to.x],
                  cy: [from.y, to.y],
                  opacity: [0, activeId ? 0.9 : 0.35, 0],
                }}
                transition={{
                  duration: 4.5 + (index % 5) * 0.9,
                  delay: index * 0.48,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            );
          })}

          {nodes.map((node, index) => {
            const focused = activeId === node.id;
            const visible = isNodeVisible(node);
            const radius = 4.5 + (node.strength / 100) * 7;
            const color = nodeColor(node);
            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onClick={() => activate(node)}
                onDoubleClick={() => {
                  activate(node);
                  setCurrentView(node.type === 'scenario' ? 'forecast' : 'watchlist');
                }}
                style={{ opacity: visible ? 1 : 0.11, transition: 'opacity 260ms ease' }}
              >
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={radius * 3.4}
                  fill={color}
                  fillOpacity={focused ? 0.1 : 0.022 + (node.strength / 100) * 0.018}
                  stroke={color}
                  strokeOpacity={node.strength > 72 ? 0.08 : 0.025}
                  strokeDasharray={node.strength > 72 ? '2 6' : undefined}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: focused ? [1, 1.09, 1] : [1, 1.025, 1], opacity: 1 }}
                  transition={{
                    opacity: { duration: 0.5, delay: index * 0.02 },
                    scale: { duration: focused ? 3.5 : 7 + (index % 4), repeat: Infinity, ease: 'easeInOut' },
                  }}
                />
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={color}
                  fillOpacity={0.16 + (node.confidence / 100) * 0.58}
                  stroke={color}
                  strokeOpacity={focused ? 0.95 : 0.48}
                  strokeWidth={focused ? 1.5 : 0.8}
                  filter={focused ? 'url(#softGlow)' : undefined}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.45, delay: 0.08 + index * 0.025 }}
                />
                {(focused || (visible && node.strength > 68)) && (
                  <text
                    x={node.x + radius + 8}
                    y={node.y + 3}
                    fill={focused ? '#E9EDF1' : '#9AA4AE'}
                    fontSize={focused ? 11 : 8.5}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    letterSpacing="0.4"
                  >
                    {node.label.length > 30 ? `${node.label.slice(0, 30)}…` : node.label}
                  </text>
                )}
              </g>
            );
          })}

          <g>
            <motion.circle
              cx="500"
              cy="350"
              r="27"
              fill="#05070A"
              stroke="#E9EDF1"
              strokeOpacity="0.36"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: [1, 1.035, 1], opacity: 1 }}
              transition={{ scale: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }}
            />
            <circle cx="500" cy="350" r="4" fill="#43D9E6" opacity="0.9" filter="url(#softGlow)" />
            <text
              x="500"
              y="394"
              textAnchor="middle"
              fill="#77818C"
              fontSize="8"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              letterSpacing="1.6"
            >
              CURRENT STATE
            </text>
          </g>
        </motion.g>
      </svg>

      {!activeNode && (
        <div className="pointer-events-none absolute bottom-[138px] left-1/2 z-20 -translate-x-1/2 text-center lg:bottom-20">
          <div className="mb-2 flex items-center justify-center gap-2 font-mono text-[8px] uppercase tracking-[0.2em] text-[#43D9E6] md:text-[9px]">
            <Crosshair className="h-3 w-3" />
            Select a node to trace
          </div>
          <p className="hidden text-[10px] text-[#77818C] sm:block">Evidence packets move only along real relationships in the field.</p>
        </div>
      )}

      <AnimatePresence>
        {activeNode && (
          <motion.aside
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-[132px] left-1/2 z-30 w-[calc(100%-24px)] max-w-[620px] -translate-x-1/2 border border-white/[0.08] bg-[#090D12]/96 px-4 py-4 shadow-2xl backdrop-blur-xl lg:bottom-16 md:px-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.22em] text-[#77818C]">
                  <span style={{ color: nodeColor(activeNode) }}>{activeNode.type}</span>
                  <span>•</span>
                  <span className="truncate">{activeNode.meta || 'active intelligence'}</span>
                </div>
                <h2 className="truncate text-sm font-medium text-[#E9EDF1] sm:text-base">{activeNode.label}</h2>
              </div>
              <button
                onClick={() => setActiveId(null)}
                className="p-1.5 text-[#77818C] transition hover:bg-white/5 hover:text-white"
                aria-label="Close inspector"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 divide-x divide-white/[0.06] border-y border-white/[0.06] py-3">
              <Metric label="Confidence" value={`${Math.round(activeNode.confidence)}%`} />
              <Metric label="Strength" value={String(Math.round(activeNode.strength))} padded />
              <Metric label="Links" value={String(Math.max(0, neighbors.size - 1))} padded />
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="hidden items-center gap-2 text-[10px] text-[#77818C] sm:flex">
                <Layers3 className="h-3.5 w-3.5" />
                Related nodes stay illuminated while unrelated noise recedes.
              </div>
              <button
                onClick={() => setCurrentView(activeNode.type === 'scenario' ? 'forecast' : 'watchlist')}
                className="ml-auto flex shrink-0 items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[8px] uppercase tracking-[0.16em] text-[#E9EDF1] transition hover:border-[#43D9E6]/40 hover:bg-[#43D9E6]/[0.05] md:text-[9px]"
              >
                Open analysis <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
};

const Metric = ({ label, value, padded = false }: { label: string; value: string; padded?: boolean }) => (
  <div className={padded ? 'pl-4' : ''}>
    <div className="font-mono text-[7px] uppercase tracking-[0.16em] text-[#77818C] md:text-[8px]">{label}</div>
    <div className="mt-1 text-base font-light md:text-lg">{value}</div>
  </div>
);
