import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  CycleStage,
  Source,
  Signal,
  Question,
  Hypothesis,
  Evidence,
  ScenarioBranch,
  PredictionOutcome,
  Report,
  OracleCase,
  OracleCaseType,
  EvidenceGatheringTask,
  EvidenceGatheringTaskType,
  EvidenceGatheringSummary,
  EvidenceLedgerItem,
  EvidenceLedgerSummary,
  AnalystCouncilPersona,
  OracleBriefing,
} from "./types";
import {
  initialSources,
  initialSignals,
  initialQuestions,
  initialHypotheses,
  initialEvidence,
  initialScenarios,
  initialPredictions,
  initialReports,
} from "./initialData";
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  getDocs,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

interface AppState {
  cycleStage: CycleStage;
  setCycleIndex: (index: number) => void;
  currentView: string;
  setCurrentView: (view: string) => void;
  sources: Source[];
  signals: Signal[];
  questions: Question[];
  hypotheses: Hypothesis[];
  evidence: Evidence[];
  scenarios: ScenarioBranch[];
  predictions: PredictionOutcome[];
  reports: Report[];
  cases: OracleCase[];
  activeCaseId: string | null;
  activeCase?: OracleCase;
  evidenceTasks: EvidenceGatheringTask[];
  activeCaseEvidenceTasks: EvidenceGatheringTask[];
  activeCaseEvidenceSummary?: EvidenceGatheringSummary;
  activeCaseEvidenceItems: EvidenceLedgerItem[];
  activeCaseEvidenceLedgerSummary?: EvidenceLedgerSummary;
  getActiveCaseLinkedNodeIds: () => Set<string>;
  isNodeLinkedToActiveCase: (type: string, id: string) => boolean;
  generateAnalystCouncil: () => AnalystCouncilPersona[];
  generateOracleBriefing: (options: { length: OracleBriefing["length"]; mode: OracleBriefing["mode"]; includeSelectedNode?: boolean }) => OracleBriefing | null;
  mergedNodesCount: number;
  selectedEntity: { type: string; id: string } | null;
  setSelectedEntity: (entity: { type: string; id: string } | null) => void;
  isFirebaseLoading: boolean;
  isIngestingData: boolean;
  setIsIngestingData: (isIngesting: boolean) => void;
  activeFeeds: any[];
  notifications: any[];
  user: User | null;
  coreInterests: string;
  setCoreInterests: (interests: string) => void;
  workflowQuery: string | null;
  setWorkflowQuery: (query: string | null) => void;
  isWorkflowMinimized: boolean;
  setIsWorkflowMinimized: (val: boolean) => void;
  workflowStep: number;
  setWorkflowStep: (step: number) => void;
  hypothesisThreshold: number;
  setHypothesisThreshold: (value: number) => void;
  reliabilityThreshold: number;
  setReliabilityThreshold: (value: number) => void;
  addNotification: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
  createOracleCase: (params: { query: string; title?: string; caseType?: OracleCaseType }) => Promise<OracleCase>;
  updateOracleCase: (caseId: string, patch: Partial<OracleCase>) => Promise<void>;
  setActiveCase: (caseId: string | null) => void;
  linkGeneratedNodesToCase: (caseId: string, generatedData: any) => Promise<void>;
  createEvidenceTasksForCase: (caseId: string) => Promise<EvidenceGatheringTask[]>;
  updateEvidenceTask: (taskId: string, patch: Partial<EvidenceGatheringTask>) => Promise<void>;
  startEvidenceGatheringForCase: (caseId: string) => Promise<void>;
  completeEvidenceTask: (taskId: string, resultSummary?: string) => Promise<void>;
  failEvidenceTask: (taskId: string, errorMessage?: string) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
  deleteCascade: (type: string, id: string, feedback?: string) => Promise<void>;
  clearAllData: (onProgress?: (progress: number) => void) => Promise<void>;
  clearSpecificData: (types: string[]) => Promise<void>;
  deleteSpecificItems: (items: {type: string, id: string}[], onProgress?: (progress: number) => void) => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

const CYCLE_STAGES: CycleStage[] = [
  "COLLECTING",
  "NORMALIZING",
  "DEDUPLICATING",
  "VERIFYING",
  "EXTRACTING_KEYWORDS",
  "EXTRACTING_ENTITIES",
  "EXTRACTING_SIGNALS",
  "CLUSTERING",
  "QUESTIONING",
  "HYPOTHESIZING",
  "EVIDENCE_MAPPING",
  "SCENARIO_UPDATING",
  "REPORT_QUEUEING",
];

async function seedDataIfEmpty(userId: string) {
  const getColRef = (col: string) => collection(db, "users", userId, col);
  const getDocRef = (col: string, id: string) => doc(db, "users", userId, col, id);

  const sourcesSnap = await getDocs(getColRef("sources"));
  const scenariosSnap = await getDocs(getColRef("scenarios"));
  if (sourcesSnap.empty || scenariosSnap.empty) {
    const promises = [];
    for (const item of initialSources)
      promises.push(setDoc(getDocRef("sources", item.id), item));
    for (const item of initialSignals)
      promises.push(setDoc(getDocRef("signals", item.id), item));
    for (const item of initialQuestions)
      promises.push(setDoc(getDocRef("questions", item.id), item));
    for (const item of initialHypotheses)
      promises.push(setDoc(getDocRef("hypotheses", item.id), item));
    for (const item of initialEvidence)
      promises.push(setDoc(getDocRef("evidence", item.id), item));
    for (const item of initialScenarios)
      promises.push(setDoc(getDocRef("scenarios", item.id), item));
    for (const item of initialPredictions)
      promises.push(setDoc(getDocRef("predictions", item.id), item));
    for (const item of initialReports)
      promises.push(setDoc(getDocRef("reports", item.id), item));
    await Promise.all(promises);
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [cycleIndex, setCycleIndex] = useState(0);
  const [currentView, setCurrentView] = useState("login");
  const [selectedEntity, setSelectedEntity] = useState<{
    type: string;
    id: string;
  } | null>(null);

  const [sources, setSources] = useState<Source[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioBranch[]>([]);
  const [predictions, setPredictions] = useState<PredictionOutcome[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [cases, setCases] = useState<OracleCase[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [evidenceTasks, setEvidenceTasks] = useState<EvidenceGatheringTask[]>([]);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);
  const [mergedNodesCount, setMergedNodesCount] = useState(0);
  const [isIngestingData, setIsIngestingData] = useState(false);
  const [activeFeeds, setActiveFeeds] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [workflowQuery, setWorkflowQuery] = useState<string | null>(null);
  const [isWorkflowMinimized, setIsWorkflowMinimized] = useState<boolean>(false);
  const [workflowStep, setWorkflowStep] = useState<number>(-1);
  const [hypothesisThreshold, setHypothesisThreshold] = useState<number>(65.0);
  const [reliabilityThreshold, setReliabilityThreshold] = useState<number>(40.0);
  const [coreInterests, setCoreInterests] = useState<string>(
    "Artificial Intelligence, Semiconductor, Global Macro",
  );

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setCurrentView((prev) => (prev === "login" ? "watchlist" : prev));
      } else {
        setCurrentView("login");
      }
    });
    return () => unsubAuth();
  }, []);

  const addNotification = useCallback(
    (
      message: string,
      type: "info" | "success" | "warning" | "error" = "info",
    ) => {
      const id = Date.now().toString();
      setNotifications((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 5000);
    },
    [],
  );

  useEffect(() => {
    fetch("/api/feeds")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setActiveFeeds(data.data);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    let unsubSources = () => {};
    let unsubSignals = () => {};
    let unsubQuestions = () => {};
    let unsubHypotheses = () => {};
    let unsubEvidence = () => {};
    let unsubScenarios = () => {};
    let unsubPredictions = () => {};
    let unsubReports = () => {};
    let unsubCases = () => {};
    let unsubEvidenceTasks = () => {};

    if (user) {
      // First immediately seed context with local data (optimistic/offline fallback)
      setSources(initialSources);
      setSignals(initialSignals);
      setQuestions(initialQuestions);
      setHypotheses(initialHypotheses);
      setEvidence(initialEvidence);
      setScenarios(initialScenarios);
      setPredictions(initialPredictions);
      setReports(initialReports);
      setIsFirebaseLoading(false);

      seedDataIfEmpty(user.uid).catch(console.error);

      try {
        const mergedCounts: Record<string, number> = {};
        
        const updateMergedCount = (count: number, collectionName: string) => {
            mergedCounts[collectionName] = count;
            const total = Object.values(mergedCounts).reduce((a, b) => a + b, 0);
            setMergedNodesCount(total);
        };

        unsubSources = onSnapshot(collection(db, "users", user.uid, "sources"), (snap) => {
          if (!snap.empty) {
             const docs = snap.docs.map((d) => d.data() as Source);
             updateMergedCount(docs.filter(s => s.status === 'MERGED_AND_DELETED').length, 'sources');
             setSources(docs.filter(s => s.status !== 'MERGED_AND_DELETED'));
          } else {
             updateMergedCount(0, 'sources');
             setSources([]);
          }
        });
        unsubSignals = onSnapshot(collection(db, "users", user.uid, "signals"), (snap) => {
          if (!snap.empty) {
             const docs = snap.docs.map((d) => d.data() as Signal);
             updateMergedCount(docs.filter(s => (s as any).status === 'MERGED_AND_DELETED').length, 'signals');
             setSignals(docs.filter(s => (s as any).status !== 'MERGED_AND_DELETED'));
          } else {
             updateMergedCount(0, 'signals');
             setSignals([]);
          }
        });
        unsubQuestions = onSnapshot(collection(db, "users", user.uid, "questions"), (snap) => {
          if (!snap.empty) {
             const docs = snap.docs.map((d) => d.data() as Question);
             updateMergedCount(docs.filter(s => (s as any).status === 'MERGED_AND_DELETED').length, 'questions');
             setQuestions(docs.filter(s => (s as any).status !== 'MERGED_AND_DELETED'));
          } else {
             updateMergedCount(0, 'questions');
             setQuestions([]);
          }
        });
        unsubHypotheses = onSnapshot(collection(db, "users", user.uid, "hypotheses"), (snap) => {
          if (!snap.empty) {
            const docs = snap.docs.map((d) => d.data() as Hypothesis);
            updateMergedCount(docs.filter(s => s.status === 'MERGED_AND_DELETED').length, 'hypotheses');
            setHypotheses(docs.filter(s => s.status !== 'MERGED_AND_DELETED'));
          } else {
            updateMergedCount(0, 'hypotheses');
            setHypotheses([]);
          }
        });
        unsubEvidence = onSnapshot(collection(db, "users", user.uid, "evidence"), (snap) => {
          if (!snap.empty) {
            setEvidence(snap.docs.map((d) => d.data() as Evidence));
          } else {
            setEvidence([]);
          }
        });
        unsubScenarios = onSnapshot(collection(db, "users", user.uid, "scenarios"), (snap) => {
          if (!snap.empty) {
            const docs = snap.docs.map((d) => d.data() as ScenarioBranch);
            updateMergedCount(docs.filter(s => s.status === 'MERGED_AND_DELETED').length, 'scenarios');
            setScenarios(docs.filter(s => s.status !== 'MERGED_AND_DELETED'));
          } else {
            updateMergedCount(0, 'scenarios');
            setScenarios([]);
          }
        });
        unsubPredictions = onSnapshot(collection(db, "users", user.uid, "predictions"), (snap) => {
          if (!snap.empty) {
            const docs = snap.docs.map((d) => d.data() as PredictionOutcome);
            updateMergedCount(docs.filter(s => s.status === 'MERGED_AND_DELETED').length, 'predictions');
            setPredictions(docs.filter(s => s.status !== 'MERGED_AND_DELETED'));
          } else {
            updateMergedCount(0, 'predictions');
            setPredictions([]);
          }
        });
        unsubReports = onSnapshot(collection(db, "users", user.uid, "reports"), (snap) => {
          if (!snap.empty) {
            setReports(snap.docs.map((d) => d.data() as Report));
          } else {
            setReports([]);
          }
          setIsFirebaseLoading(false);
        });
        unsubCases = onSnapshot(collection(db, "users", user.uid, "cases"), (snap) => {
          if (!snap.empty) {
            setCases(snap.docs.map((d) => d.data() as OracleCase));
          } else {
            setCases([]);
          }
        });
        unsubEvidenceTasks = onSnapshot(collection(db, "users", user.uid, "evidenceTasks"), (snap) => {
          if (!snap.empty) {
            setEvidenceTasks(snap.docs.map((d) => d.data() as EvidenceGatheringTask));
          } else {
            setEvidenceTasks([]);
          }
        });
      } catch (err) {
        console.log("Firebase가 연결되지 않아 로컬 데이터 모드(오프라인 모드)로 실행됩니다.");
      }
    } else {
      setSources([]);
      setSignals([]);
      setQuestions([]);
      setHypotheses([]);
      setEvidence([]);
      setScenarios([]);
      setPredictions([]);
      setReports([]);
      setCases([]);
      setEvidenceTasks([]);
      setActiveCaseId(null);
      setIsFirebaseLoading(false);
    }

    return () => {
      unsubSources();
      unsubSignals();
      unsubQuestions();
      unsubHypotheses();
      unsubEvidence();
      unsubScenarios();
      unsubPredictions();
      unsubReports();
      unsubCases();
      unsubEvidenceTasks();
    };
  }, [user]);

  useEffect(() => {
    if (isIngestingData) return;
    const interval = setInterval(() => {
      setCycleIndex((prev) => (prev + 1) % CYCLE_STAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isIngestingData]);

  // Removed redundant 60-second fetch-rss interval to prevent API quota overflow

  // Minimal Oracle Case layer. Keep this small for now; future work can extract it into a caseStore.
  const activeCase = activeCaseId ? cases.find((c) => c.id === activeCaseId) : undefined;
  const activeCaseEvidenceTasks = activeCaseId ? evidenceTasks.filter((task) => task.caseId === activeCaseId) : [];
  const activeCaseEvidenceItems: EvidenceLedgerItem[] = activeCase ? (() => {
    const itemsById = new Map<string, EvidenceLedgerItem>();
    evidence.forEach((item) => {
      if (!item?.id) return;
      const isDirect = item.caseId === activeCase.id;
      const sourceLinked = Boolean(item.sourceId && activeCase.linkedSourceIds.includes(item.sourceId));
      const hypothesisLinked = Boolean(
        (item.hypothesisId && activeCase.linkedHypothesisIds.includes(item.hypothesisId)) ||
        (item.linkedHypothesisId && activeCase.linkedHypothesisIds.includes(item.linkedHypothesisId))
      );
      const scenarioLinked = Boolean(
        (item.scenarioId && activeCase.linkedScenarioIds.includes(item.scenarioId)) ||
        (item.linkedScenarioBranchId && activeCase.linkedScenarioIds.includes(item.linkedScenarioBranchId))
      );

      if (!isDirect && !sourceLinked && !hypothesisLinked && !scenarioLinked) return;

      const linkedEntityType = isDirect ? "case" : sourceLinked ? "source" : hypothesisLinked ? "hypothesis" : "scenario";
      const existing = itemsById.get(item.id);
      if (!existing || isDirect) {
        itemsById.set(item.id, {
          evidence: item,
          linkMode: isDirect ? "direct" : "inferred",
          linkedEntityType,
        });
      }
    });
    return Array.from(itemsById.values());
  })() : [];
  const activeCaseLinkedEvidence = activeCaseEvidenceItems.map((item) => item.evidence);
  const activeCaseEvidenceLedgerSummary = activeCase ? (() => {
    const confidenceValues = activeCaseEvidenceItems
      .map(({ evidence: item }) => item.confidence)
      .filter((value): value is number => typeof value === "number");
    const credibilityValues = activeCaseEvidenceItems
      .map(({ evidence: item }) => item.credibilityScore ?? item.reliability)
      .filter((value): value is number => typeof value === "number");
    const supporting = activeCaseEvidenceItems.filter(({ evidence: item }) =>
      item.supportsThesis || item.evidenceType === "supporting"
    ).length;
    const opposing = activeCaseEvidenceItems.filter(({ evidence: item }) =>
      item.contradictsThesis || item.evidenceType === "contradicting" || item.evidenceType === "opposing"
    ).length;
    const lastUpdatedAt = activeCaseEvidenceItems
      .map(({ evidence: item }) => item.createdAt)
      .filter(Boolean)
      .sort()
      .at(-1);

    return {
      caseId: activeCase.id,
      total: activeCaseEvidenceItems.length,
      supporting,
      opposing,
      neutral: Math.max(0, activeCaseEvidenceItems.length - supporting - opposing),
      averageConfidence: confidenceValues.length > 0 ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length : undefined,
      averageCredibility: credibilityValues.length > 0 ? credibilityValues.reduce((sum, value) => sum + value, 0) / credibilityValues.length : undefined,
      directCaseLinked: activeCaseEvidenceItems.filter((item) => item.linkMode === "direct").length,
      inferredLinked: activeCaseEvidenceItems.filter((item) => item.linkMode === "inferred").length,
      lastUpdatedAt,
    };
  })() : undefined;
  const activeCaseEvidenceSummary = activeCase ? (() => {
    const totalTasks = activeCaseEvidenceTasks.length;
    const completedTasks = activeCaseEvidenceTasks.filter((task) => task.status === "completed").length;
    const failedTasks = activeCaseEvidenceTasks.filter((task) => task.status === "failed").length;
    const runningTasks = activeCaseEvidenceTasks.filter((task) => task.status === "running").length;
    const credibilityValues = activeCaseLinkedEvidence.map((item) => item.reliability).filter((value) => typeof value === "number");
    const averageCredibility = credibilityValues.length > 0
      ? credibilityValues.reduce((sum, value) => sum + value, 0) / credibilityValues.length
      : undefined;

    return {
      caseId: activeCase.id,
      totalTasks,
      completedTasks,
      failedTasks,
      runningTasks,
      progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      evidenceCount: activeCaseLinkedEvidence.length || (
        activeCase.linkedSourceIds.length + activeCase.linkedSignalIds.length + activeCase.linkedQuestionIds.length +
        activeCase.linkedHypothesisIds.length + activeCase.linkedScenarioIds.length + activeCase.linkedReportIds.length
      ),
      supportingCount: activeCaseLinkedEvidence.filter((item) => item.evidenceType === "supporting").length,
      opposingCount: activeCaseLinkedEvidence.filter((item) => item.evidenceType === "contradicting" || item.evidenceType === "opposing").length,
      averageCredibility,
      lastUpdatedAt: activeCaseEvidenceTasks.reduce((latest, task) => task.updatedAt > latest ? task.updatedAt : latest, activeCase.updatedAt),
    };
  })() : undefined;

  const getActiveCaseLinkedNodeIds = useCallback(() => {
    const ids = new Set<string>();
    if (!activeCase) return ids;
    activeCase.linkedSourceIds.forEach((id) => ids.add(`source:${id}`));
    activeCase.linkedSignalIds.forEach((id) => ids.add(`signal:${id}`));
    activeCase.linkedQuestionIds.forEach((id) => ids.add(`question:${id}`));
    activeCase.linkedHypothesisIds.forEach((id) => ids.add(`hypothesis:${id}`));
    activeCase.linkedScenarioIds.forEach((id) => ids.add(`scenario:${id}`));
    activeCase.linkedReportIds.forEach((id) => ids.add(`report:${id}`));
    return ids;
  }, [activeCase]);

  const isNodeLinkedToActiveCase = useCallback((type: string, id: string) => {
    if (!activeCase || !id) return false;
    const normalizedType = type === "branch" ? "scenario" : type;
    return getActiveCaseLinkedNodeIds().has(`${normalizedType}:${id}`);
  }, [activeCase, getActiveCaseLinkedNodeIds]);

  const generateAnalystCouncil = useCallback((): AnalystCouncilPersona[] => {
    if (!activeCase) return [];
    const evidenceProgress = activeCaseEvidenceSummary?.progress ?? 0;
    const support = activeCaseEvidenceLedgerSummary?.supporting ?? 0;
    const oppose = activeCaseEvidenceLedgerSummary?.opposing ?? 0;
    const linkedNodes = getActiveCaseLinkedNodeIds().size;
    const provisional = evidenceProgress < 100 || (activeCaseEvidenceLedgerSummary?.total ?? 0) === 0;
    const baseConfidence = Math.max(35, Math.min(82, 45 + support * 6 - oppose * 5 + Math.round(evidenceProgress / 8)));
    const topic = activeCase.title || activeCase.query;
    const selectedLabel = selectedEntity ? `selected ${selectedEntity.type}:${selectedEntity.id}` : "no selected node";
    const evidenceLabel = linkedNodes > 0 ? `${linkedNodes} linked case nodes` : "case evidence still pending";
    const riskLabel = oppose > 0 ? `${oppose} opposing evidence item(s)` : "opposing evidence not yet complete";
    const roles: AnalystCouncilPersona["role"][] = [
      "Macro Strategist",
      "Equity Analyst",
      "Quant Analyst",
      "Risk Officer",
      "OSINT Analyst",
      "Portfolio Manager",
      "Devil's Advocate",
    ];

    return roles.map((role, index) => {
      const isRisk = role === "Risk Officer" || role === "Devil's Advocate";
      const isQuant = role === "Quant Analyst";
      const confidence = Math.max(25, Math.min(90, baseConfidence - (isRisk ? 8 : 0) - (isQuant && activeCaseEvidenceLedgerSummary?.averageConfidence === undefined ? 6 : 0) + index));
      const stance = isRisk
        ? (oppose > 0 ? "Cautious / risk elevated" : "Cautious pending opposition scan")
        : support > oppose
          ? "Constructive but requires confirmation"
          : "Monitor until evidence strengthens";
      return {
        role,
        stance,
        confidence,
        bubbleComment: `${role} view on ${topic}: ${stance.toLowerCase()}. This is provisional and should be updated as the ledger fills.`,
        keyEvidence: [evidenceLabel, `Evidence gathering ${evidenceProgress}%`, `Ledger total ${activeCaseEvidenceLedgerSummary?.total ?? 0}`, selectedLabel],
        keyRisk: isRisk ? riskLabel : "metrics and source trace may be incomplete",
        viewChangeTrigger: "new opposing evidence, scenario invalidation, or material source trace update",
        provisional,
      };
    });
  }, [activeCase, activeCaseEvidenceSummary, activeCaseEvidenceLedgerSummary, getActiveCaseLinkedNodeIds, selectedEntity]);

  const generateOracleBriefing = useCallback((options: { length: OracleBriefing["length"]; mode: OracleBriefing["mode"]; includeSelectedNode?: boolean }): OracleBriefing | null => {
    if (!activeCase) return null;
    const council = generateAnalystCouncil();
    const support = activeCaseEvidenceLedgerSummary?.supporting ?? 0;
    const oppose = activeCaseEvidenceLedgerSummary?.opposing ?? 0;
    const progress = activeCaseEvidenceSummary?.progress ?? 0;
    const confidence = activeCaseEvidenceLedgerSummary?.averageConfidence ?? (council.length ? council.reduce((sum, p) => sum + p.confidence, 0) / council.length : undefined);
    const stance = oppose > support ? "Risk elevated / monitor only" : support > 0 ? "Cautious positive watch candidate" : "Evidence pending / monitoring candidate";
    const keyEvidence = activeCaseEvidenceItems.slice(0, 4).map(({ evidence: item }) => item.title || item.summary).filter(Boolean);
    const selectedNodeLine = options.includeSelectedNode && selectedEntity ? `Selected node context: ${selectedEntity.type}:${selectedEntity.id}` : undefined;
    const opposingEvidence = activeCaseEvidenceItems
      .filter(({ evidence: item }) => item.contradictsThesis || item.evidenceType === "contradicting" || item.evidenceType === "opposing")
      .slice(0, 3)
      .map(({ evidence: item }) => item.title || item.summary);
    const risks = [
      oppose > 0 ? `${oppose} opposing evidence item(s) require review` : "Opposing evidence scan is pending",
      progress < 100 ? "Evidence gathering is not complete" : "Evidence state may change with new sources",
      "No trade instruction is implied; case requires confirmation",
    ];
    const watchTriggers = [
      "new linked source or source trace mismatch",
      "scenario trigger or invalidation condition update",
      "evidence task failure or opposition count increase",
    ];
    const lineBank: Record<OracleBriefing["mode"], string[]> = {
      executive: [
        `${activeCase.title}: ${stance}.`,
        `Ledger shows ${support} support, ${oppose} oppose, and ${activeCaseEvidenceLedgerSummary?.neutral ?? 0} neutral entries.`,
        `Use as a watch candidate until evidence and source trace confirm the thesis.`,
      ],
      risk: [
        `${activeCase.title}: downside review remains active.`,
        risks[0],
        "Invalidation should be driven by source trace changes, scenario trigger failure, or stronger opposing evidence.",
      ],
      quant: [
        `${activeCase.title}: quantitative metrics are ${confidence !== undefined ? `${Math.round(confidence)}% confidence proxy` : "pending"}.`,
        "Valuation, momentum, flow, and risk language should remain provisional until metrics are populated.",
        `Evidence gathering progress is ${progress}%.`,
      ],
      debate: [
        `${activeCase.title}: council disagreement is ${oppose > 0 ? "visible" : "not yet fully tested"}.`,
        `Average council confidence is ${council.length ? Math.round(council.reduce((sum, p) => sum + p.confidence, 0) / council.length) : "pending"}.`,
        "Devil's Advocate and Risk Officer views should be revisited when opposition scan completes.",
      ],
      watch_plan: [
        `${activeCase.title}: monitor source trace, scenario triggers, and opposition count.`,
        "Next update should prioritize fresh sources, invalidation conditions, and material price/flow shifts if available.",
        "Escalate only after evidence ledger and case-linked nodes converge.",
      ],
    };
    const sourceLines = lineBank[options.mode];
    const summary = options.length === "flash"
      ? [sourceLines[0]]
      : options.length === "field"
        ? sourceLines.slice(0, 3)
        : [...sourceLines, ...risks, ...watchTriggers, "Conclusion: suitable for monitoring; requires further evidence before decision support is firm."].slice(0, 10);

    return {
      id: `brief_${Date.now()}`,
      caseId: activeCase.id,
      length: options.length,
      mode: options.mode,
      title: `${activeCase.title} · ${options.mode.replace("_", " ").toUpperCase()} BRIEF`,
      summary,
      stance,
      confidence,
      keyEvidence: (selectedNodeLine ? [selectedNodeLine, ...keyEvidence] : keyEvidence).length > 0 ? (selectedNodeLine ? [selectedNodeLine, ...keyEvidence] : keyEvidence) : ["Evidence ledger pending", "Case-linked nodes only"],
      opposingEvidence: opposingEvidence.length > 0 ? opposingEvidence : ["Opposing evidence pending"],
      risks,
      watchTriggers,
      generatedAt: new Date().toISOString(),
      provisional: progress < 100 || (activeCaseEvidenceLedgerSummary?.total ?? 0) === 0,
    };
  }, [activeCase, activeCaseEvidenceSummary, activeCaseEvidenceLedgerSummary, activeCaseEvidenceItems, generateAnalystCouncil, selectedEntity]);

  const buildCaseId = () => `case_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  const createOracleCase = useCallback(
    async ({ query, title, caseType = "general_intelligence" }: { query: string; title?: string; caseType?: OracleCaseType }) => {
      const now = new Date().toISOString();
      const trimmedQuery = query.trim();
      const oracleCase: OracleCase = {
        id: buildCaseId(),
        title: (title || trimmedQuery).slice(0, 96),
        query: trimmedQuery,
        caseType,
        status: "case_created",
        createdAt: now,
        updatedAt: now,
        userId: user?.uid,
        linkedSourceIds: [],
        linkedSignalIds: [],
        linkedQuestionIds: [],
        linkedHypothesisIds: [],
        linkedScenarioIds: [],
        linkedReportIds: [],
        isSaved: Boolean(user),
      };

      setCases((prev) => [oracleCase, ...prev.filter((c) => c.id !== oracleCase.id)]);
      setActiveCaseId(oracleCase.id);

      if (user) {
        await setDoc(doc(db, "users", user.uid, "cases", oracleCase.id), oracleCase);
      }

      return oracleCase;
    },
    [user],
  );

  const updateOracleCase = useCallback(
    async (caseId: string, patch: Partial<OracleCase>) => {
      const payload = { ...patch, updatedAt: new Date().toISOString() };
      setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, ...payload } : c)));

      if (user) {
        await setDoc(doc(db, "users", user.uid, "cases", caseId), payload, { merge: true });
      }
    },
    [user],
  );

  const setActiveCase = useCallback((caseId: string | null) => {
    setActiveCaseId(caseId);
  }, []);

  const linkGeneratedNodesToCase = useCallback(
    async (caseId: string, generatedData: any) => {
      const collectIds = () => {
        const linkedSourceIds = new Set<string>();
        const linkedSignalIds = new Set<string>();
        const linkedQuestionIds = new Set<string>();
        const linkedHypothesisIds = new Set<string>();
        const linkedScenarioIds = new Set<string>();
        const linkedReportIds = new Set<string>();

        if (generatedData?.sourceId) linkedSourceIds.add(generatedData.sourceId);
        if (generatedData?.reportId) linkedReportIds.add(generatedData.reportId);

        const items = Array.isArray(generatedData?.data) ? generatedData.data : [];
        items.forEach((item: any) => {
          const type = item?.type;
          const data = item?.data || item;
          if (!data?.id) return;

          if (type === "source" || data.sourceName || data.sourceType) linkedSourceIds.add(data.id);
          else if (type === "signal" || data.signalStrength !== undefined) linkedSignalIds.add(data.id);
          else if (type === "question" || data.hypothesisIds) linkedQuestionIds.add(data.id);
          else if (type === "hypothesis" || data.scenarioIds) linkedHypothesisIds.add(data.id);
          else if (type === "scenario" || type === "branch" || data.probability !== undefined) linkedScenarioIds.add(data.id);
          else if (type === "report" || data.content) linkedReportIds.add(data.id);
        });

        return {
          linkedSourceIds: Array.from(linkedSourceIds),
          linkedSignalIds: Array.from(linkedSignalIds),
          linkedQuestionIds: Array.from(linkedQuestionIds),
          linkedHypothesisIds: Array.from(linkedHypothesisIds),
          linkedScenarioIds: Array.from(linkedScenarioIds),
          linkedReportIds: Array.from(linkedReportIds),
        };
      };

      const currentCase = cases.find((c) => c.id === caseId);
      const newLinks = collectIds();
      const mergeIds = (existing: string[] = [], next: string[] = []) => Array.from(new Set([...existing, ...next]));
      const allLinkedIds = [
        ...newLinks.linkedSourceIds,
        ...newLinks.linkedSignalIds,
        ...newLinks.linkedQuestionIds,
        ...newLinks.linkedHypothesisIds,
        ...newLinks.linkedScenarioIds,
        ...newLinks.linkedReportIds,
      ];

      const nextStatus = allLinkedIds.length > 0 ? "initial_analysis_ready" : "evidence_gathering";
      await updateOracleCase(caseId, {
        status: nextStatus,
        linkedSourceIds: mergeIds(currentCase?.linkedSourceIds, newLinks.linkedSourceIds),
        linkedSignalIds: mergeIds(currentCase?.linkedSignalIds, newLinks.linkedSignalIds),
        linkedQuestionIds: mergeIds(currentCase?.linkedQuestionIds, newLinks.linkedQuestionIds),
        linkedHypothesisIds: mergeIds(currentCase?.linkedHypothesisIds, newLinks.linkedHypothesisIds),
        linkedScenarioIds: mergeIds(currentCase?.linkedScenarioIds, newLinks.linkedScenarioIds),
        linkedReportIds: mergeIds(currentCase?.linkedReportIds, newLinks.linkedReportIds),
        activeNodeId: generatedData?.sourceId || allLinkedIds[0] || currentCase?.activeNodeId,
        confidence: generatedData?.confidence || currentCase?.confidence,
        summary: generatedData?.message || generatedData?.query || currentCase?.summary,
      });
    },
    [cases, updateOracleCase],
  );

  const evidenceTaskTemplates: { type: EvidenceGatheringTaskType; label: string }[] = [
    { type: "market_metrics", label: "Market metrics scan" },
    { type: "valuation_data", label: "Valuation range check" },
    { type: "price_volume_data", label: "Price-volume pattern scan" },
    { type: "latest_sources", label: "Latest source sweep" },
    { type: "sector_context", label: "Sector context review" },
    { type: "macro_context", label: "Macro condition scan" },
    { type: "opposing_evidence", label: "Opposing evidence search" },
    { type: "scenario_triggers", label: "Scenario trigger scan" },
    { type: "source_trace", label: "Source trace alignment" },
  ];

  const createEvidenceTasksForCase = useCallback(
    async (caseId: string) => {
      if (!caseId) return [];
      const existingTasks = evidenceTasks.filter((task) => task.caseId === caseId);
      if (existingTasks.length > 0) return existingTasks;

      const now = new Date().toISOString();
      const tasks = evidenceTaskTemplates.map((template) => ({
        id: `evtask_${caseId}_${template.type}`,
        caseId,
        type: template.type,
        label: template.label,
        status: "pending" as const,
        progress: 0,
        resultSummary: "Provisional task prepared; awaiting evidence gathering.",
        createdAt: now,
        updatedAt: now,
      }));

      setEvidenceTasks((prev) => [...tasks, ...prev.filter((task) => task.caseId !== caseId)]);
      if (user) {
        await Promise.all(tasks.map((task) => setDoc(doc(db, "users", user.uid, "evidenceTasks", task.id), task)));
      }
      await updateOracleCase(caseId, { status: "evidence_gathering", summary: "Evidence gathering started" });
      return tasks;
    },
    [evidenceTasks, updateOracleCase, user],
  );

  const updateEvidenceTask = useCallback(
    async (taskId: string, patch: Partial<EvidenceGatheringTask>) => {
      const payload = { ...patch, updatedAt: new Date().toISOString() };
      setEvidenceTasks((prev) => prev.map((task) => task.id === taskId ? { ...task, ...payload } : task));

      if (user) {
        await setDoc(doc(db, "users", user.uid, "evidenceTasks", taskId), payload, { merge: true });
      }
    },
    [user],
  );

  const maybePromoteCaseEvidenceStatus = useCallback(
    async (caseId: string, nextTasks: EvidenceGatheringTask[]) => {
      const caseTasks = nextTasks.filter((task) => task.caseId === caseId);
      if (caseTasks.length === 0) return;
      const completedCount = caseTasks.filter((task) => task.status === "completed").length;
      const keyTasksComplete = ["latest_sources", "source_trace", "scenario_triggers"].some((type) =>
        caseTasks.some((task) => task.type === type && task.status === "completed")
      );

      if (completedCount / caseTasks.length >= 0.5 || keyTasksComplete) {
        await updateOracleCase(caseId, { status: "evidence_updated", summary: "Evidence updated for active case" });
      } else {
        await updateOracleCase(caseId, { status: "evidence_gathering" });
      }
    },
    [updateOracleCase],
  );

  const startEvidenceGatheringForCase = useCallback(
    async (caseId: string) => {
      const tasks = await createEvidenceTasksForCase(caseId);
      const firstPending = tasks.find((task) => task.status === "pending") || tasks[0];
      if (firstPending) {
        await updateEvidenceTask(firstPending.id, {
          status: "running",
          progress: 20,
          resultSummary: "Evidence gathering task started; provisional scan in progress.",
        });
      }
      await updateOracleCase(caseId, { status: "evidence_gathering", summary: "Evidence gathering started" });
    },
    [createEvidenceTasksForCase, updateEvidenceTask, updateOracleCase],
  );

  const completeEvidenceTask = useCallback(
    async (taskId: string, resultSummary = "Evidence gathering placeholder completed") => {
      const task = evidenceTasks.find((item) => item.id === taskId);
      await updateEvidenceTask(taskId, { status: "completed", progress: 100, resultSummary, errorMessage: "" });
      if (task) {
        const nextTasks = evidenceTasks.map((item) => item.id === taskId
          ? { ...item, status: "completed" as const, progress: 100, resultSummary }
          : item
        );
        await maybePromoteCaseEvidenceStatus(task.caseId, nextTasks);
      }
    },
    [evidenceTasks, maybePromoteCaseEvidenceStatus, updateEvidenceTask],
  );

  const failEvidenceTask = useCallback(
    async (taskId: string, errorMessage = "Evidence gathering task failed") => {
      const task = evidenceTasks.find((item) => item.id === taskId);
      await updateEvidenceTask(taskId, { status: "failed", progress: 0, errorMessage });
      if (task) {
        const nextTasks = evidenceTasks.map((item) => item.id === taskId
          ? { ...item, status: "failed" as const, progress: 0, errorMessage }
          : item
        );
        await maybePromoteCaseEvidenceStatus(task.caseId, nextTasks);
      }
    },
    [evidenceTasks, maybePromoteCaseEvidenceStatus, updateEvidenceTask],
  );

  const deleteSource = useCallback(
    async (id: string) => {
      try {
        await window.fetch(`/api/trends?region=kr`); // dummy request to wake up backend if needed
        const { deleteDoc, doc } = await import("firebase/firestore");
        await deleteDoc(doc(db, "users", user!.uid, "sources", id));
        addNotification(`자료가 삭제되었습니다 (ID: ${id})`, "success");
      } catch (e: any) {
        console.error("Failed to delete source", e);
        addNotification(`삭제 실패: ${e.message}`, "error");
      }
    },
    [addNotification, user],
  );

  const deleteCascade = useCallback(
    async (type: string, id: string, feedback?: string, onProgress?: (progress: number, label: string) => void) => {
      if (!user) return;
      try {
        if (onProgress) onProgress(10, "연관 데이터 스캔 중...");
        const { doc, writeBatch, collection, addDoc } = await import("firebase/firestore");
        const batch = writeBatch(db);
        
        let toDeleteSources = new Set<string>();
        let toDeleteSignals = new Set<string>();
        let toDeleteQuestions = new Set<string>();
        let toDeleteHypotheses = new Set<string>();
        let toDeleteScenarios = new Set<string>();
        
        if (type === 'source') {
             toDeleteSources.add(id);
             signals.forEach(s => {
                 if (s.sourceIds?.includes(id)) toDeleteSignals.add(s.id);
             });
        }
        else if (type === 'signal') toDeleteSignals.add(id);
        else if (type === 'question') toDeleteQuestions.add(id);
        else if (type === 'hypothesis') toDeleteHypotheses.add(id);
        else if (type === 'scenario' || type === 'branch') toDeleteScenarios.add(id);

        if (toDeleteSignals.size > 0) {
            questions.forEach(q => {
               if (q.signalIds?.some(sid => toDeleteSignals.has(sid))) {
                   toDeleteQuestions.add(q.id);
               }
            });
        }
        if (toDeleteQuestions.size > 0) {
            hypotheses.forEach(h => {
               if (toDeleteQuestions.has(h.questionId)) {
                   toDeleteHypotheses.add(h.id);
               }
            });
        }
        if (toDeleteHypotheses.size > 0) {
            scenarios.forEach(sc => {
               if (toDeleteHypotheses.has(sc.hypothesisId)) {
                   toDeleteScenarios.add(sc.id);
               }
            });
        }
        
        if (onProgress) onProgress(40, `스캔 완료. (총 ${toDeleteSources.size + toDeleteSignals.size + toDeleteQuestions.size + toDeleteHypotheses.size + toDeleteScenarios.size}개 마킹됨)`);
        
        toDeleteSources.forEach(did => batch.delete(doc(db, "users", user.uid, "sources", did)));
        toDeleteSignals.forEach(did => batch.delete(doc(db, "users", user.uid, "signals", did)));
        toDeleteQuestions.forEach(did => batch.delete(doc(db, "users", user.uid, "questions", did)));
        toDeleteHypotheses.forEach(did => batch.delete(doc(db, "users", user.uid, "hypotheses", did)));
        toDeleteScenarios.forEach(did => batch.delete(doc(db, "users", user.uid, "scenarios", did)));
        
        if (onProgress) onProgress(70, "서버에 삭제 요청 중...");
        await batch.commit();

        if (feedback && feedback.trim() !== "") {
            await addDoc(collection(db, "users", user.uid, "feedbacks"), {
                text: feedback.trim(),
                timestamp: Date.now(),
                deletedType: type,
                deletedId: id
            });
            addNotification(`삭제 및 피드백 반영 완료되었습니다.`, "success");
        } else {
            addNotification(`현재 자료와 연결된 하위 자료들이 함께 삭제되었습니다.`, "success");
        }

        if (onProgress) onProgress(100, "삭제 완료");
        
        setSelectedEntity(null);
      } catch (e: any) {
        console.error("Failed to cascade delete", e);
        if (onProgress) onProgress(0, `오류: ${e.message}`);
        addNotification(`삭제 연쇄 실패: ${e.message}`, "error");
      }
    },
    [user, signals, questions, hypotheses, scenarios, addNotification, setSelectedEntity],
  );

  const clearSpecificData = useCallback(
    async (types: string[]) => {
      if (!user) return;
      try {
        const { doc, writeBatch } = await import("firebase/firestore");
        const batch = writeBatch(db);

        if (types.includes("sources")) {
          sources.forEach((s) => batch.delete(doc(db, "users", user.uid, "sources", s.id)));
        }
        if (types.includes("signals")) {
          signals.forEach((s) => batch.delete(doc(db, "users", user.uid, "signals", s.id)));
        }
        if (types.includes("questions")) {
          questions.forEach((q) => batch.delete(doc(db, "users", user.uid, "questions", q.id)));
        }
        if (types.includes("hypotheses")) {
          hypotheses.forEach((h) => batch.delete(doc(db, "users", user.uid, "hypotheses", h.id)));
        }
        if (types.includes("scenarios")) {
          scenarios.forEach((s) => batch.delete(doc(db, "users", user.uid, "scenarios", s.id)));
        }

        await batch.commit();

        if (types.includes("sources")) setSources([]);
        if (types.includes("signals")) setSignals([]);
        if (types.includes("questions")) setQuestions([]);
        if (types.includes("hypotheses")) setHypotheses([]);
        if (types.includes("scenarios")) setScenarios([]);
        
        // Let snapshot listeners sync from backend if needed
      } catch (err) {
        console.error("Error clearing specific data:", err);
      }
    },
    [user, sources, signals, questions, hypotheses, scenarios],
  );

  const deleteSpecificItems = useCallback(
    async (items: {type: string, id: string}[], onProgress?: (progress: number) => void) => {
      if (!user) return;
      try {
        const { doc, writeBatch } = await import("firebase/firestore");
        
        // Chunk processing to avoid 500 batch limit and report progress
        const chunkSize = 100;
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          
          chunk.forEach(({type, id}) => {
            batch.delete(doc(db, "users", user.uid, type, id));
          });
          
          await batch.commit();
          
          if (onProgress) {
            onProgress(Math.round(((i + chunk.length) / items.length) * 100));
          }
        }
      } catch (err) {
        console.error("Error deleting specific items:", err);
      }
    },
    [user]
  );

  const clearAllData = useCallback(async (onProgress?: (progress: number) => void) => {
    if (!user) return;
    try {
      const { doc, writeBatch } = await import("firebase/firestore");
      
      const allItems: {type: string, id: string}[] = [];
      sources.forEach(s => allItems.push({type: "sources", id: s.id}));
      signals.forEach(s => allItems.push({type: "signals", id: s.id}));
      questions.forEach(q => allItems.push({type: "questions", id: q.id}));
      hypotheses.forEach(h => allItems.push({type: "hypotheses", id: h.id}));
      scenarios.forEach(s => allItems.push({type: "scenarios", id: s.id}));
      evidence.forEach(e => allItems.push({type: "evidence", id: e.id}));
      predictions.forEach(p => allItems.push({type: "predictions", id: p.id}));
      reports.forEach(r => allItems.push({type: "reports", id: r.id}));
      cases.forEach(c => allItems.push({type: "cases", id: c.id}));
      evidenceTasks.forEach(t => allItems.push({type: "evidenceTasks", id: t.id}));
      
      if (allItems.length === 0) {
          if (onProgress) onProgress(100);
          addNotification("모든 데이터가 초기화되었습니다.", "success");
          setSelectedEntity(null);
          setActiveCaseId(null);
          setEvidenceTasks([]);
          return;
      }

      const chunkSize = 100;
      for (let i = 0; i < allItems.length; i += chunkSize) {
        const chunk = allItems.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        
        chunk.forEach(({type, id}) => {
          batch.delete(doc(db, "users", user.uid, type, id));
        });
        
        await batch.commit();
        
        if (onProgress) {
          onProgress(Math.round(((i + chunk.length) / allItems.length) * 100));
        }
      }
      
      addNotification("모든 데이터가 초기화되었습니다.", "success");
      setSelectedEntity(null);
      setActiveCaseId(null);
      setEvidenceTasks([]);
    } catch (e: any) {
      console.error("Failed to clear data", e);
      addNotification(`데이터 초기화 실패: ${e.message}`, "error");
    }
  }, [user, sources, signals, questions, hypotheses, scenarios, evidence, predictions, reports, cases, evidenceTasks, addNotification, setSelectedEntity]);

  const value: AppState = {
    cycleStage: CYCLE_STAGES[cycleIndex],
    setCycleIndex,
    currentView,
    setCurrentView,
    sources,
    signals,
    questions,
    hypotheses,
    evidence,
    scenarios,
    predictions,
    reports,
    cases,
    activeCaseId,
    activeCase,
    evidenceTasks,
    activeCaseEvidenceTasks,
    activeCaseEvidenceSummary,
    activeCaseEvidenceItems,
    activeCaseEvidenceLedgerSummary,
    getActiveCaseLinkedNodeIds,
    isNodeLinkedToActiveCase,
    generateAnalystCouncil,
    generateOracleBriefing,
    selectedEntity,
    setSelectedEntity,
    isFirebaseLoading,
    isIngestingData,
    setIsIngestingData,
    activeFeeds,
    notifications,
    user,
    coreInterests,
    setCoreInterests,
    workflowQuery,
    setWorkflowQuery,
    isWorkflowMinimized,
    setIsWorkflowMinimized,
    workflowStep,
    setWorkflowStep,
    hypothesisThreshold,
    setHypothesisThreshold,
    reliabilityThreshold,
    setReliabilityThreshold,
    addNotification,
    createOracleCase,
    updateOracleCase,
    setActiveCase,
    linkGeneratedNodesToCase,
    createEvidenceTasksForCase,
    updateEvidenceTask,
    startEvidenceGatheringForCase,
    completeEvidenceTask,
    failEvidenceTask,
    deleteSource,
    deleteCascade,
    clearAllData,
    clearSpecificData,
    deleteSpecificItems,
    mergedNodesCount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context)
    throw new Error("useAppContext must be used within AppProvider");
  return context;
};
