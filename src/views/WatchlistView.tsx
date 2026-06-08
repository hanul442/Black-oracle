import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useAnimationFrame,
  useMotionValue,
  useTransform,
  animate,
} from "motion/react";
import * as d3 from "d3";
import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from "react-zoom-pan-pinch";
import {
  AlertTriangle,
  Eye,
  ShieldCheck,
  HelpCircle,
  FileText,
  Cpu,
  Database,
  Search,
} from "lucide-react";
import { useAppContext } from "../store";

export const WatchlistView: React.FC = () => {
  const {
    sources,
    signals,
    questions,
    hypotheses,
    scenarios,
    selectedEntity,
    setSelectedEntity,
    workflowStep,
    isNodeLinkedToActiveCase,
  } = useAppContext() as any;
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"critical" | null>(null);
  const [activeListModal, setActiveListModal] = useState<
    "signals" | "hypotheses" | "scenarios" | "all" | null
  >(null);

  useEffect(() => {
    // Optional resize handler logic
  }, []);

  const actualSelectedNode = selectedEntity
    ? (() => {
        if (selectedEntity.type === "source") return `src-${selectedEntity.id}`;
        if (selectedEntity.type === "signal") return `sig-${selectedEntity.id}`;
        if (selectedEntity.type === "question") return `q-${selectedEntity.id}`;
        if (selectedEntity.type === "hypothesis")
          return `hyp-${selectedEntity.id}`;
        if (
          selectedEntity.type === "scenario" ||
          selectedEntity.type === "branch"
        )
          return `scen-${selectedEntity.id}`;
        return null;
      })()
    : null;

  const visualAnchorRef = useRef<string | null>(null);
  const interactionFocusNode = actualSelectedNode || hoveredNode;
  
  if (!interactionFocusNode) {
    visualAnchorRef.current = null;
  } else {
    const getLevel = (nStr: string) => {
        if (!nStr) return -1;
        if (nStr.startsWith('src-')) return 0;
        if (nStr.startsWith('sig-')) return 1;
        if (nStr.startsWith('q-')) return 2;
        if (nStr.startsWith('hyp-')) return 3;
        if (nStr.startsWith('scen-')) return 4;
        return -1;
    };
    const cur = visualAnchorRef.current;
    if (cur && getLevel(interactionFocusNode) > getLevel(cur)) {
      // Keep current layout anchor when focusing on a child node
    } else {
      visualAnchorRef.current = interactionFocusNode;
    }
  }

  const layoutFocusNode = visualAnchorRef.current;
  const effectiveFocusNode = interactionFocusNode;

  // We include all nodes. Dimming handles the visual clutter.
  // TODO: Future Decision Web should become Source → Evidence → Signal → Thesis → Scenario → Decision using deterministic compact COGNEX-style rectangular blocks.
  // If we're in the middle of a workflow (workflowStep is a number >= 0), we progressively reveal items
  const showSignals =
    workflowStep === undefined || workflowStep === -1 || workflowStep >= 1;
  const showQuestions =
    workflowStep === undefined || workflowStep === -1 || workflowStep >= 3;
  const showHypotheses =
    workflowStep === undefined || workflowStep === -1 || workflowStep >= 4;
  const showScenarios =
    workflowStep === undefined || workflowStep === -1 || workflowStep >= 5;

  // Show all nodes as requested
  const activeSources = sources;
  const activeSignals = showSignals ? signals : [];
  const activeQuestions = showQuestions ? questions : [];
  const activeHypotheses = showHypotheses ? hypotheses : [];
  const activeScenarios = showScenarios ? scenarios : [];

  // Determines which nodes get permanent labels
  const isPrimaryNode = (type: string, index: number) => {
    if (type === "scenario") return index < 8;
    if (type === "hypothesis") return index < 8;
    if (type === "question") return index < 10;
    if (type === "signal") return index < 12;
    if (type === "source") return index < 15;
    return false;
  };

  // Ring Geometry Math
  const size = 3600;
  const center = size / 2;

  // Single robust outer ring
  const baseRadius = 1400;

  const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++)
      hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    return Math.abs(hash);
  };

  const buildNodeExt = (
    s: any,
    type: string,
    shortCode: string,
    i: number,
    prefix: string,
  ) => {
    // Derive scoring traits with deterministic backfill
    const prob =
      s.probability !== undefined
        ? s.probability
        : s.confidence !== undefined
          ? s.confidence
          : getHash(s.id + "prob") % 100;
    const conf =
      s.reliabilityScore !== undefined
        ? s.reliabilityScore
        : s.reliability !== undefined
          ? s.reliability
          : getHash(s.id + "rel") % 100;
    const imp =
      s.impactScore !== undefined
        ? s.impactScore
        : s.impact !== undefined
          ? s.impact
          : getHash(s.id + "imp") % 100;

    let title = s.title || s.text || "";
    if (type === "source") {
      title = title.replace(/^(?:oracle|web\s*)?search\s*[:\-]\s*/i, "").trim();
      // Fallback just in case it's in the string and not at the start
      if (title.toLowerCase().startsWith("oracle search")) {
        title = title.replace(/^oracle search/i, "").trim();
      }
    }

    return {
      id: `${prefix}-${s.id}`,
      rId: s.id,
      shortCode,
      title,
      type,
      data: s,
      isPrimary: isPrimaryNode(type, i),
      score: {
        probability: prob,
        confidence: conf,
        impact: imp,
        recency: Math.random() > 0.7,
      },
    };
  };

  const allNodes: any[] = useMemo(
    () => [
      ...activeSources.map((s: any, i: number) =>
        buildNodeExt(s, "source", "SRC", i, "src"),
      ),
      ...activeSignals.map((s: any, i: number) =>
        buildNodeExt(s, "signal", "SIG", i, "sig"),
      ),
      ...activeQuestions.map((s: any, i: number) =>
        buildNodeExt(s, "question", "QUE", i, "q"),
      ),
      ...activeHypotheses.map((s: any, i: number) =>
        buildNodeExt(s, "hypothesis", "HYP", i, "hyp"),
      ),
      ...activeScenarios.map((s: any, i: number) =>
        buildNodeExt(s, "scenario", "SCN", i, "scen"),
      ),
    ],
    [
      activeSources,
      activeSignals,
      activeQuestions,
      activeHypotheses,
      activeScenarios,
    ],
  );

  const allNodeIds = useMemo(
    () => new Set(allNodes.map((n) => n.id)),
    [allNodes],
  );

  // Build intelligent relationship links (independent of positions)
  const links = useMemo(() => {
    const l: any[] = [];

    // Connect Source -> Signal
    activeSignals.forEach((sig: any) => {
      if (sig.sourceIds && sig.sourceIds.length > 0) {
        sig.sourceIds.forEach((sId: string) => {
          if (allNodeIds.has(`src-${sId}`) && allNodeIds.has(`sig-${sig.id}`)) {
            l.push({
              source: `src-${sId}`,
              target: `sig-${sig.id}`,
              type: "source-signal",
            });
          }
        });
      }
    });

    // Connect Signal -> Question
    activeQuestions.forEach((q: any) => {
      if (q.signalIds && q.signalIds.length > 0) {
        q.signalIds.forEach((sId: string) => {
          if (allNodeIds.has(`sig-${sId}`) && allNodeIds.has(`q-${q.id}`)) {
            l.push({
              source: `sig-${sId}`,
              target: `q-${q.id}`,
              type: "signal-question",
            });
          }
        });
      }
    });

    // Connect Question -> Hypothesis
    activeHypotheses.forEach((h: any) => {
      if (h.questionId) {
        if (
          allNodeIds.has(`q-${h.questionId}`) &&
          allNodeIds.has(`hyp-${h.id}`)
        ) {
          l.push({
            source: `q-${h.questionId}`,
            target: `hyp-${h.id}`,
            type: "question-hypothesis",
          });
        }
      }
    });

    // Connect Hypothesis -> Scenario
    activeScenarios.forEach((sc: any) => {
      if (sc.hypothesisId) {
        if (
          allNodeIds.has(`hyp-${sc.hypothesisId}`) &&
          allNodeIds.has(`scen-${sc.id}`)
        ) {
          l.push({
            source: `hyp-${sc.hypothesisId}`,
            target: `scen-${sc.id}`,
            type: "hypothesis-scenario",
          });
        }
      }
    });

    activeHypotheses.forEach((h: any) => {
      if (h.scenarioIds && Array.isArray(h.scenarioIds)) {
        h.scenarioIds.forEach((scenId: string) => {
          if (
            allNodeIds.has(`hyp-${h.id}`) &&
            allNodeIds.has(`scen-${scenId}`)
          ) {
            // Check if link already exists to prevent duplicates
            const exists = l.find((link) => link.source === `hyp-${h.id}` && link.target === `scen-${scenId}`);
            if (!exists) {
              l.push({
                source: `hyp-${h.id}`,
                target: `scen-${scenId}`,
                type: "hypothesis-scenario",
              });
            }
          }
        });
      }
    });

    // Analyze hypothesis relations based on shared data
    activeHypotheses.forEach((h1: any, i: number) => {
      activeHypotheses.slice(i + 1).forEach((h2: any) => {
        let relatedScore = 0;

        if (h1.questionId && h2.questionId && h1.questionId === h2.questionId) {
          relatedScore += 2;
        }

        if (h1.title && h2.title) {
          // Remove generic prefixes/suffixes and particle words
          const cleanTitle = (t: string) =>
            t.replace(/(가설|메인|상충되는|중립|:|\[|\]|\(|\))/g, "").trim();
          const words1 = cleanTitle(h1.title)
            .split(" ")
            .filter((w) => w.length > 2);
          const words2 = cleanTitle(h2.title)
            .split(" ")
            .filter((w) => w.length > 2);
          const intersection = words1.filter((w: string) => words2.includes(w));
          if (intersection.length > 0) {
            relatedScore += intersection.length * 4; // Boost weight of actual word overlap
          }
        }

        // Extremely strict threshold to prevent clutter
        if (relatedScore >= 6) {
          if (
            allNodeIds.has(`hyp-${h1.id}`) &&
            allNodeIds.has(`hyp-${h2.id}`)
          ) {
            l.push({
              source: `hyp-${h1.id}`,
              target: `hyp-${h2.id}`,
              type: "hypothesis-hypothesis",
              score: relatedScore,
            });
          }
        }
      });
    });

    // Add some random cross-connections if data is sparse to maintain orbital aesthetic
    if (l.length < 10) {
      activeSignals.forEach((sig: any, i: number) => {
        if (activeSources[i])
          l.push({
            source: `src-${activeSources[i].id}`,
            target: `sig-${sig.id}`,
            type: "synthetic",
          });
        if (activeQuestions[i % activeQuestions.length])
          l.push({
            source: `sig-${sig.id}`,
            target: `q-${activeQuestions[i % activeQuestions.length].id}`,
            type: "synthetic",
          });
      });
    }

    const uniqueLinksMap = new Map<string, any>();
    l.forEach((link) => {
      uniqueLinksMap.set(`${link.source}-${link.target}`, link);
    });
    return Array.from(uniqueLinksMap.values());
  }, [
    activeSources,
    activeSignals,
    activeQuestions,
    activeHypotheses,
    activeScenarios,
    allNodeIds,
  ]);

  // Compute distances from focused node (0 = self, 1 = direct connection, 2 = indirect, etc)
  const computeDistances = (targetNodeId: string | null) => {
    const distances: Record<string, number> = {};
    if (!targetNodeId) return distances;

    distances[targetNodeId] = 0;

    // Traverse UP (source/parent direction)
    const upQueue: string[] = [targetNodeId];
    let upHead = 0;
    while (upHead < upQueue.length) {
      const curr = upQueue[upHead++];
      const currentDist = distances[curr];
      if (currentDist > 4) continue;
      links.forEach((l: any) => {
        const s = typeof l.source === "object" ? l.source.id : l.source;
        const t = typeof l.target === "object" ? l.target.id : l.target;
        if (t === curr && distances[s] === undefined) {
          distances[s] = currentDist + 1;
          upQueue.push(s);
        }
      });
    }

    // Traverse DOWN (target/child direction)
    const downQueue: string[] = [targetNodeId];
    let downHead = 0;
    while (downHead < downQueue.length) {
      const curr = downQueue[downHead++];
      const currentDist = distances[curr];
      if (currentDist > 4) continue;
      links.forEach((l: any) => {
        const s = typeof l.source === "object" ? l.source.id : l.source;
        const t = typeof l.target === "object" ? l.target.id : l.target;
        if (s === curr && distances[t] === undefined) {
          distances[t] = currentDist + 1;
          downQueue.push(t);
        }
      });
    }

    return distances;
  };

  const nodeDistances = useMemo(() => computeDistances(effectiveFocusNode), [effectiveFocusNode, links]);
  const layoutDistances = useMemo(() => computeDistances(layoutFocusNode), [layoutFocusNode, links]);

  // "원래는 렌더링하지말고 합류하는 느낌으로 해 클릭하면"
  const renderedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    allNodes.forEach((node) => {
      let shouldRender = false;

      if (workflowStep !== undefined && workflowStep !== -1) {
        shouldRender = true;
      } else if (searchQuery) {
        const isSearchMatch =
          node.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.shortCode?.toLowerCase().includes(searchQuery.toLowerCase());
        shouldRender = isSearchMatch;
      } else if (effectiveFocusNode && layoutFocusNode) {
        const layoutDist = layoutDistances[node.id];
        const interactionDist = nodeDistances[node.id];
        shouldRender = (layoutDist !== undefined && layoutDist <= 1) || (interactionDist !== undefined && interactionDist <= 1);
      } else if (effectiveFocusNode) {
        const dist = nodeDistances[node.id];
        shouldRender = dist !== undefined && dist <= 1;
      } else {
        shouldRender = node.type === "source";
      }

      if (activeFilter === "critical") {
        const isCritical =
          node.type === "scenario" && node.score.probability > 70;
        if (!isCritical) shouldRender = false;
      }

      if (shouldRender) {
        ids.add(node.id);
      }
    });
    return ids;
  }, [
    allNodes,
    workflowStep,
    searchQuery,
    effectiveFocusNode,
    layoutFocusNode,
    nodeDistances,
    layoutDistances,
    activeFilter,
  ]);

  const isConnectedToHovered = (id: string) => {
    return nodeDistances[id] !== undefined;
  };

  // Rotation state
  const rotation = useMotionValue(0);
  const invertRotation = useTransform(
    rotation,
    (r) => -parseFloat(String(r) || "0"),
  );
  const isDragging = useRef(false);

  const nodePositions = useMemo(() => {
    const basePositions: Record<
      string,
      {
        x: number;
        y: number;
        angle: number;
        isLeft: boolean;
        entryDelay: number;
        entryDuration: number;
      }
    > = {};

    const typeOrder: Record<string, number> = {
      source: 1,
      signal: 2,
      question: 3,
      hypothesis: 4,
      scenario: 5,
    };

    // 1. 관련된 노드들이 인접하도록 계층적 정렬
    const sortedNodes = [...allNodes].sort((a, b) => {
      if (a.type !== b.type)
        return (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);

      // 같은 타입 내에서 부모 ID 기준으로 정렬하여 겹침 방지 및 관계성 유지
      if (a.type === "signal")
        return (a.sourceIds?.[0] || "").localeCompare(b.sourceIds?.[0] || "");
      if (a.type === "question")
        return (a.signalIds?.[0] || "").localeCompare(b.signalIds?.[0] || "");
      if (a.type === "hypothesis")
        return (a.questionId || "").localeCompare(b.questionId || "");
      if (a.type === "scenario")
        return (a.hypothesisId || "").localeCompare(b.hypothesisId || "");
      return 0;
    });

    const typeCounts: Record<string, number> = {};
    const typeIndices: Record<string, number> = {};
    sortedNodes.forEach((n) => {
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
      typeIndices[n.type] = 0;
    });

    sortedNodes.forEach((n) => {
      const index = typeIndices[n.type]++;
      const count = Math.max(1, typeCounts[n.type]);
      
      // Full 360 degree circle for idle mode
      const angle = (index / count) * Math.PI * 2;

      // 넓은 궤도로 분포
      let targetR = baseRadius * 1.0; // sources
      if (n.type === "signal") targetR = baseRadius * 0.85;
      if (n.type === "question") targetR = baseRadius * 0.70;
      if (n.type === "hypothesis") targetR = baseRadius * 0.55;
      if (n.type === "scenario") targetR = baseRadius * 0.40;

      const finalX = center + targetR * Math.cos(angle);
      const finalY = center + targetR * Math.sin(angle);

      const isLeft = Math.cos(angle) < 0;

      const entryDelay = effectiveFocusNode ? 0 : Math.random() * 0.4 + typeOrder[n.type] * 0.2;
      const entryDuration = effectiveFocusNode ? 0.4 : 2.0 + Math.random() * 2.0;

      basePositions[n.id] = {
        x: finalX,
        y: finalY,
        angle,
        isLeft,
        entryDelay,
        entryDuration,
      };
    });

    return basePositions;
  }, [allNodes, center, baseRadius, layoutFocusNode, layoutDistances, rotation, effectiveFocusNode]);

  // Rotation state moved above nodePositions

  useAnimationFrame((time, delta) => {
    if (isDragging.current) return;

    if (!effectiveFocusNode) {
      // Restore idle drift for better visual liveliness
      rotation.set(rotation.get() + delta * 0.0015);
    } else {
      // Do not rotate when focused
    }
  });

  // Draw bundled/smooth curve
  const drawCurve = (id1: string, id2: string, linkType: string = "") => {
    const p1 = nodePositions[id1];
    const p2 = nodePositions[id2];
    if (!p1 || !p2) return "";

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate normal vector
    const nx = -dy / (dist || 1);
    const ny = dx / (dist || 1);

    // Pull outward by 15% of distance to create a gentle arc instead of crazy loops
    const curveAmount = dist * 0.15;
    
    // Flip curve direction based on relative position to create organic webbing
    const flip = (p1.x > center) ? 1 : -1;
    
    const cx = p1.x + dx * 0.5 + nx * curveAmount * flip;
    const cy = p1.y + dy * 0.5 + ny * curveAmount * flip;
    
    return `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`;
  };

  const getNodeColorStyles = (node: any) => {
    const { probability } = node.score;
    let baseStyle =
      "border-white/50 bg-white/20 text-white font-bold drop-shadow-md";

    if (node.type === "source")
      baseStyle =
        "text-slate-200 border-slate-500/80 bg-slate-800/80 hover:bg-slate-700 font-bold";
    else if (node.type === "signal")
      baseStyle =
        "text-teal-200 border-teal-500/90 bg-teal-900/90 hover:bg-teal-800 shadow-[0_0_15px_rgba(45,212,191,0.6)] font-bold";
    else if (node.type === "question")
      baseStyle =
        "text-amber-200 border-amber-500/90 bg-amber-900/90 hover:bg-amber-800 font-bold shadow-[0_0_10px_rgba(251,191,36,0.4)]";
    else if (node.type === "hypothesis") {
      if (probability < 30)
        baseStyle =
          "text-slate-300 border-slate-500/80 bg-slate-900/80 font-bold";
      else if (probability < 70)
        baseStyle =
          "text-violet-200 border-violet-400/90 bg-violet-900/90 hover:bg-violet-800 font-bold shadow-[0_0_10px_rgba(167,139,250,0.4)]";
      else
        baseStyle =
          "text-fuchsia-100 border-fuchsia-400/100 bg-fuchsia-800/90 shadow-[0_0_20px_rgba(232,121,249,0.7)] font-bold ring-2 ring-fuchsia-400/50";
    } else if (node.type === "scenario") {
      if (probability < 40)
        baseStyle =
          "text-slate-300 border-slate-500/80 bg-slate-900/80 font-bold";
      else if (probability < 60)
        baseStyle =
          "text-teal-200 border-teal-500/80 bg-teal-900/90 font-bold shadow-[0_0_10px_rgba(45,212,191,0.4)]";
      else if (probability < 80)
        baseStyle =
          "text-orange-200 border-orange-500/80 bg-orange-900/90 font-bold shadow-[0_0_15px_rgba(251,146,60,0.5)]";
      else
        baseStyle =
          "text-red-100 border-red-500/100 bg-red-800/90 shadow-[0_0_25px_rgba(239,68,68,0.8)] ring-2 ring-red-500/50 font-bold";
    }

    if (node.score.recency) {
      baseStyle += " animate-pulse-slow";
    }

    return baseStyle;
  };

  const getNodeColorHex = (type: string, score: any) => {
    if (type === "signal") return "#2dd4bf"; // teal-400
    if (type === "question") return "#fbbf24"; // amber-400
    if (type === "hypothesis") return "#a78bfa"; // violet-400
    if (type === "scenario") {
      if (score.probability < 40) return "#94a3b8"; // slate-400
      if (score.probability < 60) return "#2dd4bf"; // teal-400
      if (score.probability < 80) return "#fb923c"; // orange-400
      return "#f43f5e"; // rose-500
    }
    return "#94a3b8"; // slate-400 for sources
  };

  const getStrokeProps = (
    link: any,
    isHovered: boolean,
    isPrimary: boolean,
    srcDist: number,
    tgtDist: number,
  ) => {
    const srcNode = allNodes.find((n) => n.id === link.source);
    const tgtNode = allNodes.find((n) => n.id === link.target);
    const { probability, confidence, impact } = tgtNode?.score || {
      probability: 50,
      confidence: 50,
      impact: 50,
    };
    const isCritical = tgtNode?.type === "scenario" && probability >= 80;

    let color = tgtNode
      ? getNodeColorHex(tgtNode.type, tgtNode.score)
      : "rgba(255,255,255,1)";
    let strokeWidth = 3;
    let strokeOpacity = 0.6;
    let dashArray =
      link.type === "synthetic" || confidence < 40 ? "6 12" : "none";

    if (link.type === "hypothesis-hypothesis") {
      color = "#f472b6"; // pink-400 for correlation
      dashArray = "4 6";
      strokeWidth = Math.min(5, (link.score || 1) * 2);
    }

    if (activeFilter === "critical") {
      strokeOpacity = 0;
      color = "rgba(255,255,255,0)";
    } else if (effectiveFocusNode) {
      const isDirect =
        link.source === effectiveFocusNode ||
        link.target === effectiveFocusNode;
      if (isDirect) {
        strokeWidth =
          link.type === "hypothesis-hypothesis"
            ? strokeWidth + 2
            : impact > 70
              ? 5
              : 4;
        strokeOpacity = link.type === "hypothesis-hypothesis" ? 1.0 : 1.0;
      } else {
        strokeOpacity = 0.0;
        color = "rgba(255,255,255,0)";
      }
    } else if (isHovered) {
      strokeWidth = impact > 70 ? 5 : 4;
      strokeOpacity = 1.0;
    } else if (!effectiveFocusNode) {
      strokeOpacity =
        link.type === "hypothesis-hypothesis" ? 0.0 : isPrimary ? 0.6 : 0.15; // Drop non-primary and hypothesis links heavily when idle
    } else {
      strokeOpacity = 0.15; // Fade unrelated nodes strongly
    }

    return { color, strokeWidth, strokeOpacity, dashArray };
  };

  return (
    <div
      className="w-full h-full flex flex-col relative overflow-hidden AnalysisRingMonitor"
      style={{
        background:
          "radial-gradient(circle at 50% 50%, #0a0f25 0%, #020510 60%, #000000 100%)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setSelectedEntity(null);
      }}
    >
      <header className="absolute top-4 left-4 right-4 flex justify-end items-center z-20 pointer-events-none">
        <div className="flex gap-4 pointer-events-auto">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-teal-400 uppercase tracking-widest mb-1">
              실시간 활성 신호
            </span>
            <button
              onClick={() => setActiveListModal("signals")}
              className="text-2xl font-mono text-white leading-none text-left transition-all hover:text-teal-300 hover:drop-shadow-[0_0_8px_rgba(45,212,191,0.8)]"
            >
              {activeSignals.length}
            </button>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-violet-400 uppercase tracking-widest mb-1">
              진행 중인 가설
            </span>
            <button
              onClick={() => setActiveListModal("hypotheses")}
              className="text-2xl font-mono text-white leading-none text-left transition-all hover:text-violet-300 hover:drop-shadow-[0_0_8px_rgba(167,139,250,0.8)]"
            >
              {activeHypotheses.length}
            </button>
          </div>
          <div className="flex flex-col text-left">
            <span
              className="text-[10px] font-mono text-red-500 uppercase tracking-widest mb-1 cursor-pointer transition-opacity hover:opacity-80"
              onClick={() =>
                setActiveFilter((prev) =>
                  prev === "critical" ? null : "critical",
                )
              }
              title="필터 토글"
            >
              핵심 위협 시나리오 (필터)
            </span>
            <button
              onClick={() => setActiveListModal("scenarios")}
              className={`text-2xl font-mono leading-none text-left transition-all duration-300 hover:text-red-300 hover:drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] ${activeFilter === "critical" ? "text-red-300 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" : "text-red-400"}`}
            >
              {
                activeScenarios.filter((s) => (s as any).probability > 70)
                  .length
              }
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full h-full relative overflow-hidden pointer-events-auto">
        <TransformWrapper
          initialScale={typeof window !== "undefined" ? Math.max(0.05, Math.min(window.innerWidth, window.innerHeight) / 3000) : 0.3}
          minScale={0.05}
          maxScale={4}
          centerOnInit={true}
          limitToBounds={false}
          onPanningStart={() => {
            isDragging.current = true;
          }}
          onPanningStop={() => {
            isDragging.current = false;
          }}
          onWheelStart={() => {
          }}
          onPinchingStart={() => {
          }}
        >
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{
              width: size,
              height: size,
            }}
          >
            <div
              className="relative shrink-0 flex items-center justify-center transition-transform duration-300"
              style={{ width: size, height: size }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedEntity(null);
              }}
            >
              {/* Decorative Orbital Layers Background (SVG for Safari stability) */}
              <svg
                className="absolute inset-0 pointer-events-none mix-blend-screen"
                style={{ width: size, height: size }}
              >
                {/* Scenarios at 0.25 */}
                <circle cx={center} cy={center} r={baseRadius * 0.25} fill="none" className="stroke-red-900/30" />
                {/* Hypothesis at 0.45 */}
                <circle cx={center} cy={center} r={baseRadius * 0.45} fill="none" className="stroke-violet-900/30" strokeDasharray="8 8" />
                {/* Question at 0.65 */}
                <circle cx={center} cy={center} r={baseRadius * 0.65} fill="none" className="stroke-blue-900/30" strokeDasharray="4 8" />
                {/* Signal at 0.85 */}
                <circle cx={center} cy={center} r={baseRadius * 0.85} fill="none" className="stroke-teal-900/30" strokeDasharray="12 12" />
                {/* Source at 1.0 */}
                <circle cx={center} cy={center} r={baseRadius * 1.0} fill="none" className="stroke-slate-700/40" />
                {/* Rotating half-circles for sweeps */}
                <g
                  style={{
                    transformOrigin: `${center}px ${center}px`,
                    animation: "spin 80s linear infinite",
                  }}
                >
                  <circle
                    cx={center}
                    cy={center}
                    r={baseRadius}
                    fill="none"
                    className="stroke-teal-500/40"
                    strokeWidth="2"
                    strokeDasharray={`${baseRadius * Math.PI * 0.5} ${baseRadius * Math.PI * 1.5}`}
                  />
                </g>
                <g
                  style={{
                    transformOrigin: `${center}px ${center}px`,
                    animation: "spin-reverse 60s linear infinite",
                  }}
                >
                  <circle
                    cx={center}
                    cy={center}
                    r={baseRadius}
                    fill="none"
                    className="stroke-violet-500/40"
                    strokeWidth="2"
                    strokeDasharray={`${baseRadius * Math.PI * 0.5} ${baseRadius * Math.PI * 1.5}`}
                    strokeDashoffset={`${baseRadius * Math.PI}`}
                  />
                </g>
              </svg>

              {/* Crosshairs */}
              <div className="absolute left-1/2 top-[10%] bottom-[10%] w-[1px] bg-gradient-to-b from-transparent via-white/5 to-transparent pointer-events-none translate-x-[-50%]" />
              <div className="absolute top-1/2 left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none translate-y-[-50%]" />

              {/* Radar sweep effect (subtle) */}
              <div
                className="absolute pointer-events-none rounded-full origin-center"
                style={{
                  left: center - baseRadius,
                  top: center - baseRadius,
                  width: baseRadius * 2,
                  height: baseRadius * 2,
                  background:
                    "conic-gradient(from 0deg, transparent 75%, rgba(34, 211, 238, 0.05) 100%)",
                }}
              />

              {/* BLACK ORACLE CORE REMOVED to keep center open for flow */}

              {/* SVGs and Nodes Wrapper for Synchronized Orbital Drift */}
              <motion.div
                className="absolute inset-0 touch-none"
                style={{ x: rotation }}
                transformTemplate={({ x }) =>
                  `rotate(${parseFloat(String(x) || "0")}deg)`
                }
              >
                {/* SVGs for Connections */}
                <svg
                  width={size}
                  height={size}
                  className="absolute inset-0 pointer-events-none z-0"
                >
                  <AnimatePresence>
                    {links.map((link, i) => {
                      if (
                        !renderedNodeIds.has(link.source) ||
                        !renderedNodeIds.has(link.target)
                      )
                        return null;

                      const srcDist = nodeDistances[link.source] ?? 99;
                      const tgtDist = nodeDistances[link.target] ?? 99;
                      const isHovered = effectiveFocusNode
                        ? srcDist <= 6 && tgtDist <= 6
                        : false;

                      const srcNode = allNodes.find(
                        (n) => n.id === link.source,
                      );
                      const tgtNode = allNodes.find(
                        (n) => n.id === link.target,
                      );
                      const isPrimaryPath =
                        srcNode?.isPrimary && tgtNode?.isPrimary;

                      const { color, strokeWidth, strokeOpacity, dashArray } =
                        getStrokeProps(
                          link,
                          isHovered,
                          !!isPrimaryPath,
                          srcDist,
                          tgtDist,
                        );

                      // Performance optimization: skip rendering invisible or faint paths to save DOM depth
                      if (strokeOpacity <= 0) return null;
                      if (
                        !effectiveFocusNode &&
                        strokeOpacity < 0.1 &&
                        i % 4 !== 0
                      )
                        return null; // Drop 75% of faint paths randomly

                      // Apply sweeping trace animation for active paths (only for close connections to save performance)
                      const shouldAnimate =
                        strokeOpacity > 0.3 &&
                        (isHovered ||
                          isPrimaryPath ||
                          (effectiveFocusNode && srcDist <= 1));

                      return (
                        <motion.g
                          key={`chord-${link.source}-${link.target}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.5 }}
                        >
                          <motion.path
                            d={drawCurve(link.source, link.target, link.type)}
                            fill="none"
                            stroke={color}
                            strokeWidth={strokeWidth}
                            strokeOpacity={strokeOpacity}
                            strokeDasharray={dashArray}
                            className="transition-all duration-300"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: strokeOpacity }}
                            transition={{ duration: effectiveFocusNode ? 0.6 : 2, ease: "easeOut" }}
                          />
                          {shouldAnimate && (
                            <>
                              <circle
                                r={isHovered ? "4" : "2"}
                                fill={isHovered ? "#ef4444" : color}
                              >
                                <animateMotion
                                  dur={
                                    isHovered
                                      ? "1.5s"
                                      : 2 + Math.random() * 3 + "s"
                                  }
                                  repeatCount="indefinite"
                                  path={drawCurve(
                                    link.source,
                                    link.target,
                                    link.type,
                                  )}
                                />
                              </circle>
                              {isHovered && (
                                <circle r="2" fill="#ffffff">
                                  <animateMotion
                                    dur="1.5s"
                                    repeatCount="indefinite"
                                    path={drawCurve(
                                      link.source,
                                      link.target,
                                      link.type,
                                    )}
                                  />
                                </circle>
                              )}
                            </>
                          )}
                        </motion.g>
                      );
                    })}
                  </AnimatePresence>
                </svg>

                {/* Nodes */}
                <div className="absolute inset-0 pointer-events-auto">
                  <AnimatePresence>
                    {allNodes.map((node) => {
                      if (!renderedNodeIds.has(node.id)) return null;

                      const pos = nodePositions[node.id];
                      if (!pos) return null;
                      const dist = nodeDistances[node.id] ?? 99;
                      const isHovered = hoveredNode === node.id;
                      const isFocused = effectiveFocusNode === node.id;
                      const isSearchMatch = searchQuery
                        ? node.title
                            ?.toLowerCase()
                            .includes(searchQuery.toLowerCase()) ||
                          node.shortCode
                            ?.toLowerCase()
                            .includes(searchQuery.toLowerCase())
                        : true;

                      // Dimming logic
                      let containerClass = "opacity-100 z-20";
                      let nodeRingClass = "";

                      const isCritical =
                        node.type === "scenario" && node.score.probability > 70;

                      if (activeFilter === "critical") {
                        containerClass =
                          "opacity-100 z-50 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]";
                      } else if (effectiveFocusNode) {
                        if (dist === 0) {
                          containerClass =
                            "opacity-100 z-50 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]";
                          nodeRingClass = "ring-4 ring-white scale-125";
                        } else if (dist === 1) {
                          containerClass =
                            "opacity-100 z-40 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]";
                          nodeRingClass = "ring-2 ring-white/70 scale-110";
                        } else {
                          containerClass = "opacity-0 z-0 pointer-events-none hidden";
                        }
                      }

                      const nodeStyles = getNodeColorStyles(node);
                      const isCaseLinkedNode = Boolean(isNodeLinkedToActiveCase?.(node.type, node.rId));

                      // 가시성 향상을 위해 노드 크기 대폭 상향 수정
                      let nodeSize = 32;
                      if (node.score.impact > 80) nodeSize += 12;
                      if (node.type === "scenario")
                        nodeSize += node.score.probability > 70 ? 16 : 8;
                      if (node.type === "hypothesis" || node.type === "signal")
                        nodeSize += 8;
                      if (searchQuery && isSearchMatch) nodeSize *= 1.5;

                      const hitAreaSize = 80; // 클릭/오버 영역 확대

                      return (
                        <motion.div
                          key={node.id}
                          id={`node-${node.id}`}
                          initial={{
                            opacity: 0,
                            left: center,
                            top: center,
                            x: "-50%",
                            y: "-50%",
                          }}
                          animate={{
                            opacity: 1,
                            left: pos.x,
                            top: pos.y,
                            x: "-50%",
                            y: "-50%",
                          }}
                          exit={{
                            opacity: 0,
                            left: center,
                            top: center,
                            x: "-50%",
                            y: "-50%",
                          }}
                          transition={{
                            type: "spring",
                            stiffness: effectiveFocusNode ? 120 : 40,
                            damping: effectiveFocusNode ? 15 : 14,
                            mass: 1,
                            delay: pos.entryDelay,
                          }}
                          className={`absolute transition-all duration-300 ${containerClass}`}
                        >
                          {/* Counter-rotation to keep labels and nodes upright */}
                          <motion.div
                            className="relative flex items-center justify-center"
                            style={{ rotate: invertRotation }}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{
                              type: "spring",
                              stiffness: effectiveFocusNode ? 150 : 30,
                              damping: effectiveFocusNode ? 16 : 12,
                              mass: 1.2,
                              delay: pos.entryDelay,
                            }}
                          >
                            {/* Hit Area */}
                            <div
                              className="absolute cursor-crosshair group flex flex-col items-center justify-center pointer-events-auto"
                              style={{
                                width: hitAreaSize,
                                height: hitAreaSize,
                              }}
                              onMouseEnter={() => setHoveredNode(node.id)}
                              onMouseLeave={() => setHoveredNode(null)}
                              onClick={() => {
                                setSelectedEntity({
                                  type: node.type,
                                  id: node.rId,
                                });
                              }}
                            >
                              <div
                                className={`rounded-full border transition-all duration-300 ${nodeStyles} ${nodeRingClass} ${isCaseLinkedNode ? 'ring-2 ring-cyan-300/70 shadow-[0_0_14px_rgba(34,211,238,0.18)]' : ''} ${isHovered ? "scale-[1.8] z-30 shadow-[0_0_15px_rgba(255,255,255,0.4)] ring-4 ring-white" : ""}`}
                                style={{
                                  width: Math.max(
                                    nodeSize,
                                    isHovered ? nodeSize * 1.5 : nodeSize,
                                  ),
                                  height: Math.max(
                                    nodeSize,
                                    isHovered ? nodeSize * 1.5 : nodeSize,
                                  ),
                                }}
                              >
                                {isHovered && node.type === "scenario" && (
                                  <div className="w-full h-full animate-ping rounded-full bg-current opacity-30" />
                                )}
                                {isCaseLinkedNode && (
                                  <div className="absolute -top-2 -right-4 px-1 py-0.5 rounded border border-cyan-400/40 bg-black/80 text-[7px] font-mono text-cyan-200 tracking-widest">
                                    CASE
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Dynamic Label Display - 가시성 강화 및 노이즈 감소 */}
                            {(isHovered || isFocused || isSearchMatch || (effectiveFocusNode && dist !== undefined && dist <= 1)) && (
                              <div
                                className={`absolute ${pos.isLeft ? "right-10 flex-row-reverse" : "left-10 flex-row"} flex items-center gap-3 whitespace-nowrap z-50 pointer-events-none transition-all duration-300 ${!isHovered && !isFocused && dist === 1 ? "opacity-80 scale-95" : "opacity-100 scale-100"}`}
                              >
                                <span
                                  className={`px-3 py-1.5 flex items-center justify-center rounded text-sm font-bold tracking-widest border shadow-xl ${
                                    node.type === "source"
                                      ? "border-slate-500 bg-slate-900/90 text-slate-100"
                                      : node.type === "signal"
                                        ? "border-teal-500 bg-teal-900/90 text-teal-100"
                                        : node.type === "question"
                                          ? "border-amber-500 bg-amber-900/90 text-amber-100"
                                          : node.type === "hypothesis"
                                            ? "border-violet-500 bg-violet-900/90 text-violet-100"
                                            : "border-red-500 bg-red-900/90 text-red-100"
                                  }`}
                                >
                                  {node.shortCode}
                                </span>
                                <span
                                  className={`text-lg font-bold tracking-wide bg-[#020510]/95 backdrop-blur-md px-4 py-2 rounded-lg border shadow-[0_4px_15px_rgba(0,0,0,0.9)] text-white ${isFocused ? 'border-white' : 'border-white/30'}`}
                                >
                                  {node.title?.substring(0, 50) +
                                    ((node.title?.length || 0) > 50 ? "..." : "")}
                                </span>
                              </div>
                            )}

                            {/* Tiny always-on label for sources to keep track of them */}
                            {!effectiveFocusNode && !isHovered && !isSearchMatch && (node.type === "source" || node.type === "scenario" || node.isPrimary) && (
                              <div 
                                className="absolute top-full mt-2 px-3 py-1.5 rounded-lg bg-black/60 text-[11px] lg:text-[12px] font-sans text-slate-200 pointer-events-none border border-slate-700/50 whitespace-normal text-center shadow-lg transition-opacity duration-300"
                                style={{ width: 140, left: "50%", transform: "translateX(-50%)" }}
                              >
                                <span className="line-clamp-2 block w-full">{node.title || node.shortCode}</span>
                              </div>
                            )}
                          </motion.div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* List Modal */}
      <AnimatePresence>
        {activeListModal && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-4 top-24 bottom-4 w-80 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden flex flex-col z-50 pointer-events-auto shadow-2xl"
          >
            <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center bg-black/40">
              <h3 className="font-bold text-white text-sm">통합 분석 리스트</h3>
              <button
                onClick={() => setActiveListModal(null)}
                className="text-gray-400 hover:text-white p-1"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {/* Signals Accordion */}
              <div className="border-b border-white/5">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                  onClick={() =>
                    setActiveListModal(
                      activeListModal === "signals" ? "all" : "signals",
                    )
                  }
                >
                  <span className="text-sm font-mono text-teal-400">
                    실시간 활성 신호 ({activeSignals.length})
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${activeListModal === "signals" ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <AnimatePresence>
                  {activeListModal === "signals" && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-2 bg-black/20">
                        {activeSignals.map((item: any) => (
                          <div
                            key={item.id}
                            className="p-3 mb-2 rounded-lg border border-teal-500/30 hover:border-teal-500/60 bg-teal-950/20 cursor-pointer transition-colors"
                            onClick={() =>
                              setSelectedEntity({ type: "signal", id: item.id })
                            }
                          >
                            <div className="text-[10px] text-gray-400 mb-1 font-mono">
                              ID: {item.id}
                            </div>
                            <div className="text-sm text-gray-200 line-clamp-2">
                              {item.title || item.text}
                            </div>
                          </div>
                        ))}
                        {activeSignals.length === 0 && (
                          <div className="p-4 text-center text-xs text-gray-500">
                            항목이 없습니다.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Hypotheses Accordion */}
              <div className="border-b border-white/5">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                  onClick={() =>
                    setActiveListModal(
                      activeListModal === "hypotheses" ? "all" : "hypotheses",
                    )
                  }
                >
                  <span className="text-sm font-mono text-violet-400">
                    진행 중인 가설 ({activeHypotheses.length})
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${activeListModal === "hypotheses" ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <AnimatePresence>
                  {activeListModal === "hypotheses" && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-2 bg-black/20">
                        {activeHypotheses.map((item: any) => (
                          <div
                            key={item.id}
                            className="p-3 mb-2 rounded-lg border border-violet-500/30 hover:border-violet-500/60 bg-violet-950/20 cursor-pointer transition-colors"
                            onClick={() =>
                              setSelectedEntity({
                                type: "hypothesis",
                                id: item.id,
                              })
                            }
                          >
                            <div className="text-[10px] text-gray-400 mb-1 font-mono">
                              ID: {item.id}
                            </div>
                            <div className="text-sm text-gray-200 line-clamp-2">
                              {item.title || item.text}
                            </div>
                            <div className="mt-2 flex gap-2">
                              {item.probability !== undefined && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-gray-300 border border-white/5">
                                  확률: {Math.round(item.probability)}%
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {activeHypotheses.length === 0 && (
                          <div className="p-4 text-center text-xs text-gray-500">
                            항목이 없습니다.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Scenarios Accordion */}
              <div className="border-b border-white/5">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                  onClick={() =>
                    setActiveListModal(
                      activeListModal === "scenarios" ? "all" : "scenarios",
                    )
                  }
                >
                  <span className="text-sm font-mono text-red-400">
                    핵심 위협 시나리오 (
                    {
                      activeScenarios.filter((s: any) => s.probability > 70)
                        .length
                    }
                    )
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${activeListModal === "scenarios" ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <AnimatePresence>
                  {activeListModal === "scenarios" && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-2 bg-black/20">
                        {activeScenarios
                          .filter((s: any) => s.probability > 70)
                          .map((item: any) => (
                            <div
                              key={item.id}
                              className="p-3 mb-2 rounded-lg border border-red-500/30 hover:border-red-500/60 bg-red-950/20 cursor-pointer transition-colors"
                              onClick={() =>
                                setSelectedEntity({
                                  type: "scenario",
                                  id: item.id,
                                })
                              }
                            >
                              <div className="text-[10px] text-gray-400 mb-1 font-mono">
                                ID: {item.id}
                              </div>
                              <div className="text-sm text-gray-200 line-clamp-2">
                                {item.title || item.text}
                              </div>
                              <div className="mt-2 flex gap-2">
                                {item.probability !== undefined && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-gray-300 border border-white/5">
                                    확률: {Math.round(item.probability)}%
                                  </span>
                                )}
                                {item.impact !== undefined && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-gray-300 border border-white/5">
                                    영향: {Math.round(item.impact)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        {activeScenarios.filter((s: any) => s.probability > 70)
                          .length === 0 && (
                          <div className="p-4 text-center text-xs text-gray-500">
                            항목이 없습니다.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style
        dangerouslySetInnerHTML={{
          __html: `
              @keyframes spin { 100% { transform: rotate(360deg); } }
              @keyframes spin-slow { 100% { transform: rotate(360deg); } }
            `,
        }}
      />
    </div>
  );
};
