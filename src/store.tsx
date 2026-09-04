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
} from "./types";
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  collection,
  onSnapshot,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  firebaseConfig.firestoreDatabaseId,
);
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
  deleteSource: (id: string) => Promise<void>;
  deleteCascade: (type: string, id: string, feedback?: string) => Promise<void>;
  clearAllData: (onProgress?: (progress: number) => void) => Promise<void>;
  clearSpecificData: (types: string[]) => Promise<void>;
  deleteSpecificItems: (
    items: { type: string; id: string }[],
    onProgress?: (progress: number) => void,
  ) => Promise<void>;
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

const LEGACY_DEMO_IDS = new Set([
  "SRC-NVDA-1",
  "SRC-TSMC-1",
  "sig-nvda-1",
  "sig-tsmc-1",
  "Q-SEMI-1",
  "HYP-SEMI-A",
  "HYP-SEMI-B",
  "SCEN-SEMI-1",
  "SCEN-SEMI-2",
  "ev-nvda-1",
  "ev-tsmc-1",
  "rep-semi-1",
  "pred-semi-1",
]);

const productionVisible = <T extends { id: string }>(items: T[]) =>
  items.filter(
    (item) =>
      !LEGACY_DEMO_IDS.has(item.id) &&
      (item as T & { status?: string }).status !== "MERGED_AND_DELETED",
  );

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
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);
  const [mergedNodesCount, setMergedNodesCount] = useState(0);
  const [isIngestingData, setIsIngestingData] = useState(false);
  const [activeFeeds, setActiveFeeds] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [workflowQuery, setWorkflowQuery] = useState<string | null>(null);
  const [isWorkflowMinimized, setIsWorkflowMinimized] = useState(false);
  const [workflowStep, setWorkflowStep] = useState(-1);
  const [hypothesisThreshold, setHypothesisThreshold] = useState(65.0);
  const [reliabilityThreshold, setReliabilityThreshold] = useState(40.0);
  const [coreInterests, setCoreInterests] = useState(
    "Crypto, Digital Assets, Market Liquidity, Global Macro",
  );

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setCurrentView((prev) => (prev === "login" ? "operations" : prev));
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
        if (data.success) setActiveFeeds(data.data);
      })
      .catch(() => setActiveFeeds([]));
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

    if (user) {
      setSources([]);
      setSignals([]);
      setQuestions([]);
      setHypotheses([]);
      setEvidence([]);
      setScenarios([]);
      setPredictions([]);
      setReports([]);
      setMergedNodesCount(0);
      setIsFirebaseLoading(true);

      try {
        const mergedCounts: Record<string, number> = {};
        const updateMergedCount = (count: number, collectionName: string) => {
          mergedCounts[collectionName] = count;
          setMergedNodesCount(
            Object.values(mergedCounts).reduce((a, b) => a + b, 0),
          );
        };

        unsubSources = onSnapshot(
          collection(db, "users", user.uid, "sources"),
          (snap) => {
            const docs = snap.docs.map((d) => d.data() as Source);
            updateMergedCount(
              docs.filter((s) => s.status === "MERGED_AND_DELETED").length,
              "sources",
            );
            setSources(productionVisible(docs));
          },
        );
        unsubSignals = onSnapshot(
          collection(db, "users", user.uid, "signals"),
          (snap) => {
            const docs = snap.docs.map((d) => d.data() as Signal);
            updateMergedCount(
              docs.filter((s) => (s as any).status === "MERGED_AND_DELETED")
                .length,
              "signals",
            );
            setSignals(productionVisible(docs));
          },
        );
        unsubQuestions = onSnapshot(
          collection(db, "users", user.uid, "questions"),
          (snap) => {
            const docs = snap.docs.map((d) => d.data() as Question);
            updateMergedCount(
              docs.filter((s) => (s as any).status === "MERGED_AND_DELETED")
                .length,
              "questions",
            );
            setQuestions(productionVisible(docs));
          },
        );
        unsubHypotheses = onSnapshot(
          collection(db, "users", user.uid, "hypotheses"),
          (snap) => {
            const docs = snap.docs.map((d) => d.data() as Hypothesis);
            updateMergedCount(
              docs.filter((s) => s.status === "MERGED_AND_DELETED").length,
              "hypotheses",
            );
            setHypotheses(productionVisible(docs));
          },
        );
        unsubEvidence = onSnapshot(
          collection(db, "users", user.uid, "evidence"),
          (snap) => {
            setEvidence(
              productionVisible(snap.docs.map((d) => d.data() as Evidence)),
            );
          },
        );
        unsubScenarios = onSnapshot(
          collection(db, "users", user.uid, "scenarios"),
          (snap) => {
            const docs = snap.docs.map((d) => d.data() as ScenarioBranch);
            updateMergedCount(
              docs.filter((s) => s.status === "MERGED_AND_DELETED").length,
              "scenarios",
            );
            setScenarios(productionVisible(docs));
          },
        );
        unsubPredictions = onSnapshot(
          collection(db, "users", user.uid, "predictions"),
          (snap) => {
            const docs = snap.docs.map((d) => d.data() as PredictionOutcome);
            updateMergedCount(
              docs.filter((s) => s.status === "MERGED_AND_DELETED").length,
              "predictions",
            );
            setPredictions(productionVisible(docs));
          },
        );
        unsubReports = onSnapshot(
          collection(db, "users", user.uid, "reports"),
          (snap) => {
            setReports(
              productionVisible(snap.docs.map((d) => d.data() as Report)),
            );
            setIsFirebaseLoading(false);
          },
        );
      } catch (err) {
        console.error("Firebase intelligence workspace unavailable.", err);
        setIsFirebaseLoading(false);
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
      setMergedNodesCount(0);
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
    };
  }, [user]);

  useEffect(() => {
    if (isIngestingData) return;
    const interval = setInterval(() => {
      setCycleIndex((prev) => (prev + 1) % CYCLE_STAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isIngestingData]);

  const deleteSource = useCallback(
    async (id: string) => {
      try {
        const { deleteDoc, doc } = await import("firebase/firestore");
        if (!user) return;
        await deleteDoc(doc(db, "users", user.uid, "sources", id));
        addNotification(`자료가 삭제되었습니다 (ID: ${id})`, "success");
      } catch (e: any) {
        console.error("Failed to delete source", e);
        addNotification(`삭제 실패: ${e.message}`, "error");
      }
    },
    [addNotification, user],
  );

  const deleteCascade = useCallback(
    async (
      type: string,
      id: string,
      feedback?: string,
      onProgress?: (progress: number, label: string) => void,
    ) => {
      if (!user) return;
      try {
        if (onProgress) onProgress(10, "연관 데이터 스캔 중...");
        const { doc, writeBatch, collection, addDoc } = await import(
          "firebase/firestore"
        );
        const batch = writeBatch(db);

        const toDeleteSources = new Set<string>();
        const toDeleteSignals = new Set<string>();
        const toDeleteQuestions = new Set<string>();
        const toDeleteHypotheses = new Set<string>();
        const toDeleteScenarios = new Set<string>();

        if (type === "source") {
          toDeleteSources.add(id);
          signals.forEach((s) => {
            if (s.sourceIds?.includes(id)) toDeleteSignals.add(s.id);
          });
        } else if (type === "signal") toDeleteSignals.add(id);
        else if (type === "question") toDeleteQuestions.add(id);
        else if (type === "hypothesis") toDeleteHypotheses.add(id);
        else if (type === "scenario" || type === "branch")
          toDeleteScenarios.add(id);

        if (toDeleteSignals.size > 0) {
          questions.forEach((q) => {
            if (q.signalIds?.some((sid) => toDeleteSignals.has(sid))) {
              toDeleteQuestions.add(q.id);
            }
          });
        }
        if (toDeleteQuestions.size > 0) {
          hypotheses.forEach((h) => {
            if (toDeleteQuestions.has(h.questionId)) toDeleteHypotheses.add(h.id);
          });
        }
        if (toDeleteHypotheses.size > 0) {
          scenarios.forEach((sc) => {
            if (toDeleteHypotheses.has(sc.hypothesisId))
              toDeleteScenarios.add(sc.id);
          });
        }

        if (onProgress)
          onProgress(
            40,
            `스캔 완료. (총 ${
              toDeleteSources.size +
              toDeleteSignals.size +
              toDeleteQuestions.size +
              toDeleteHypotheses.size +
              toDeleteScenarios.size
            }개 마킹됨)`,
          );

        toDeleteSources.forEach((did) =>
          batch.delete(doc(db, "users", user.uid, "sources", did)),
        );
        toDeleteSignals.forEach((did) =>
          batch.delete(doc(db, "users", user.uid, "signals", did)),
        );
        toDeleteQuestions.forEach((did) =>
          batch.delete(doc(db, "users", user.uid, "questions", did)),
        );
        toDeleteHypotheses.forEach((did) =>
          batch.delete(doc(db, "users", user.uid, "hypotheses", did)),
        );
        toDeleteScenarios.forEach((did) =>
          batch.delete(doc(db, "users", user.uid, "scenarios", did)),
        );

        if (onProgress) onProgress(70, "서버에 삭제 요청 중...");
        await batch.commit();

        if (feedback?.trim()) {
          await addDoc(collection(db, "users", user.uid, "feedbacks"), {
            text: feedback.trim(),
            timestamp: Date.now(),
            deletedType: type,
            deletedId: id,
          });
          addNotification("삭제 및 피드백 반영 완료되었습니다.", "success");
        } else {
          addNotification(
            "현재 자료와 연결된 하위 자료들이 함께 삭제되었습니다.",
            "success",
          );
        }

        if (onProgress) onProgress(100, "삭제 완료");
        setSelectedEntity(null);
      } catch (e: any) {
        console.error("Failed to cascade delete", e);
        if (onProgress) onProgress(0, `오류: ${e.message}`);
        addNotification(`삭제 연쇄 실패: ${e.message}`, "error");
      }
    },
    [user, signals, questions, hypotheses, scenarios, addNotification],
  );

  const clearSpecificData = useCallback(
    async (types: string[]) => {
      if (!user) return;
      try {
        const { doc, writeBatch } = await import("firebase/firestore");
        const batch = writeBatch(db);

        if (types.includes("sources"))
          sources.forEach((s) =>
            batch.delete(doc(db, "users", user.uid, "sources", s.id)),
          );
        if (types.includes("signals"))
          signals.forEach((s) =>
            batch.delete(doc(db, "users", user.uid, "signals", s.id)),
          );
        if (types.includes("questions"))
          questions.forEach((q) =>
            batch.delete(doc(db, "users", user.uid, "questions", q.id)),
          );
        if (types.includes("hypotheses"))
          hypotheses.forEach((h) =>
            batch.delete(doc(db, "users", user.uid, "hypotheses", h.id)),
          );
        if (types.includes("scenarios"))
          scenarios.forEach((s) =>
            batch.delete(doc(db, "users", user.uid, "scenarios", s.id)),
          );

        await batch.commit();

        if (types.includes("sources")) setSources([]);
        if (types.includes("signals")) setSignals([]);
        if (types.includes("questions")) setQuestions([]);
        if (types.includes("hypotheses")) setHypotheses([]);
        if (types.includes("scenarios")) setScenarios([]);
      } catch (err) {
        console.error("Error clearing specific data:", err);
      }
    },
    [user, sources, signals, questions, hypotheses, scenarios],
  );

  const deleteSpecificItems = useCallback(
    async (
      items: { type: string; id: string }[],
      onProgress?: (progress: number) => void,
    ) => {
      if (!user) return;
      try {
        const { doc, writeBatch } = await import("firebase/firestore");
        const chunkSize = 100;
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach(({ type, id }) => {
            batch.delete(doc(db, "users", user.uid, type, id));
          });
          await batch.commit();
          if (onProgress)
            onProgress(Math.round(((i + chunk.length) / items.length) * 100));
        }
      } catch (err) {
        console.error("Error deleting specific items:", err);
      }
    },
    [user],
  );

  const clearAllData = useCallback(
    async (onProgress?: (progress: number) => void) => {
      if (!user) return;
      try {
        const { doc, writeBatch } = await import("firebase/firestore");

        const allItems: { type: string; id: string }[] = [];
        sources.forEach((s) => allItems.push({ type: "sources", id: s.id }));
        signals.forEach((s) => allItems.push({ type: "signals", id: s.id }));
        questions.forEach((q) =>
          allItems.push({ type: "questions", id: q.id }),
        );
        hypotheses.forEach((h) =>
          allItems.push({ type: "hypotheses", id: h.id }),
        );
        scenarios.forEach((s) =>
          allItems.push({ type: "scenarios", id: s.id }),
        );
        evidence.forEach((e) => allItems.push({ type: "evidence", id: e.id }));
        predictions.forEach((p) =>
          allItems.push({ type: "predictions", id: p.id }),
        );
        reports.forEach((r) => allItems.push({ type: "reports", id: r.id }));

        if (allItems.length === 0) {
          if (onProgress) onProgress(100);
          addNotification("모든 데이터가 초기화되었습니다.", "success");
          setSelectedEntity(null);
          return;
        }

        const chunkSize = 100;
        for (let i = 0; i < allItems.length; i += chunkSize) {
          const chunk = allItems.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach(({ type, id }) => {
            batch.delete(doc(db, "users", user.uid, type, id));
          });
          await batch.commit();
          if (onProgress)
            onProgress(
              Math.round(((i + chunk.length) / allItems.length) * 100),
            );
        }

        addNotification("모든 데이터가 초기화되었습니다.", "success");
        setSelectedEntity(null);
      } catch (e: any) {
        console.error("Failed to clear data", e);
        addNotification(`데이터 초기화 실패: ${e.message}`, "error");
      }
    },
    [
      user,
      sources,
      signals,
      questions,
      hypotheses,
      scenarios,
      evidence,
      predictions,
      reports,
      addNotification,
    ],
  );

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
