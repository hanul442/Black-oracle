BLACK ORACLE




A mobile-first intelligence analysis terminal for signal detection, scenario forecasting, and strategic decision support.




BLACK ORACLE is an experimental intelligence-analysis platform designed to transform scattered signals into structured questions, hypotheses, scenarios, evidence trails, and decision maps.


It combines AI-assisted reasoning, evidence gathering, risk scoring, and visual scenario exploration into a dark, premium, mobile-first interface inspired by intelligence terminals, strategic dashboards, and scenario command systems.



Overview


BLACK ORACLE is built around one core idea:




The future does not appear suddenly. It leaks through signals.




The system helps users collect weak signals, classify them, generate analytical questions, build competing hypotheses, and explore possible future scenarios through an interactive intelligence interface.


Rather than simply summarizing news or producing static reports, BLACK ORACLE is designed as a layered intelligence workflow:


Signal Collection
        ↓
Question Generation
        ↓
Hypothesis Formation
        ↓
Evidence Gathering
        ↓
Scenario Projection
        ↓
Decision Mapping
        ↓
Deep Dive Reporting




Core Concept


BLACK ORACLE is not a simple news dashboard.


It is designed as a multi-layer intelligence operating interface where the user can:




Track geopolitical, market, technology, and social signals


Generate questions from uncertain or fragmented events


Build multiple hypotheses from the same signal set


Compare base, positive, alternative, and risk scenarios


Gather and verify supporting evidence


Visualize relationships between signals, actors, scenarios, and decisions


Produce strategic intelligence briefings and deep dive reports




The long-term goal is to create a system that feels less like a search engine and more like a strategic analysis room.



Key Features


1. Oracle Feed


A mobile-first intelligence feed that displays live analytical cards.


Each card can represent a topic, event, sector, company, country, or emerging signal.


Example indicators:




Valuation


Momentum


Flow


Risk


Signal strength


Evidence status


Scenario probability





2. Command Bar


A fixed bottom command interface that allows the user to initiate analysis quickly.


Example commands:


Analyze semiconductor supply chain risk
Track signals around Korean financial markets
Generate scenarios for a Taiwan Strait crisis
Build a decision map for AI infrastructure investment



The command bar is designed to feel like the entry point of an intelligence terminal.



3. Signal Classification


Incoming data can be classified into structured signal types.


Example categories:




Signal Type
Description




Market Signal
Price, volume, valuation, liquidity, fund flow


Political Signal
Election, regulation, policy, diplomacy


Geopolitical Signal
Conflict, alliance, sanctions, military posture


Technology Signal
AI, semiconductor, energy, infrastructure


Social Signal
Public sentiment, demographic shifts, cultural movement


Risk Signal
Instability, crisis trigger, systemic vulnerability





4. Question Generation


BLACK ORACLE converts raw signals into analytical questions.


Example:


Signal:
Foreign investors are rapidly increasing exposure to Korean semiconductor stocks.

Generated Questions:
1. Is this a short-term momentum trade or a structural allocation shift?
2. Which macro variables are supporting the inflow?
3. Is the movement concentrated in specific firms or broad across the sector?
4. What risks could reverse the trend?




5. Hypothesis Engine


The system generates multiple competing hypotheses instead of one fixed answer.


Example structure:




Hypothesis Type
Purpose




Base Case
Most likely current path


Positive Case
Upside scenario


Alternative Case
Non-consensus interpretation


Risk Case
Downside or crisis scenario




This allows users to compare possible futures rather than accept a single narrative.



6. Scenario Projection


BLACK ORACLE is designed to support scenario-based forecasting.


Each scenario can include:




Probability


Key drivers


Trigger events


Supporting evidence


Counter-evidence


Expected timeline


Strategic implications




Example:


Scenario A: Controlled Stabilization
Probability: 46%

Scenario B: Delayed Policy Shock
Probability: 31%

Scenario C: Market Reversal
Probability: 18%

Scenario D: Systemic Escalation
Probability: 5%




7. Evidence Gathering Status


The platform tracks the evidence-gathering process as a visible workflow.


Example stages:


[1] Collecting open-source signals
[2] Extracting relevant claims
[3] Matching evidence to hypotheses
[4] Checking source reliability
[5] Updating scenario probability
[6] Generating final briefing



Each stage can be displayed with progress indicators, status labels, and completion states.



8. Analyst Council


The Analyst Council is a planned interface layer where different analytical perspectives can be compared.


Example analyst roles:




Analyst
Focus




Macro Analyst
Interest rates, inflation, liquidity, currency


Market Analyst
Valuation, price action, fund flow


Geopolitical Analyst
Security, diplomacy, sanctions, regional risk


Technology Analyst
AI, semiconductor, energy, platform shifts


Risk Analyst
Tail risk, weak signals, scenario stress


Strategy Director
Final synthesis and decision recommendation




The goal is to make analysis feel like a structured intelligence briefing rather than a single AI response.



Visual Design Direction


BLACK ORACLE uses a dark, premium, intelligence-terminal interface.


Design Keywords




Dark intelligence terminal


Mobile-first command system


Minimal but cinematic dashboard


Radial relationship diagram


Scenario probability ring


Signal tracing interface


Evidence ledger


Strategic briefing studio




Visual Language




Element
Direction




Background
Deep charcoal / black technical canvas


Typography
Display-focused, modern, precise


Accent Colors
Cyan, purple, red, muted white


Layout
One-page, layered, mobile-first


Motion
Subtle pulse, rotation, fade, zoom, trace lines


Data Display
Rings, radial diagrams, progress cards, evidence lists





Main Interface Modules


Oracle Feed


A scannable feed of active intelligence items.


Analysis Ring


A visual ring-based module for displaying active scenario probability, signal intensity, or analytical progress.


Trace View


A layered view showing how signals connect to questions, evidence, hypotheses, and scenarios.


Radial Relationship Diagram


A relationship map connecting:




Signals


Actors


Events


Evidence


Hypotheses


Scenarios


Decisions




Evidence Ledger


A structured evidence table for tracking source material and reliability.


Oracle Briefing Studio


A report-generation interface for turning analysis into polished briefings.


Deep Dive Report


A full analytical report generated from the accumulated case structure.


Decision Web


A strategic decision graph showing possible choices, consequences, and scenario branches.



System Architecture


BLACK ORACLE is currently designed around a frontend, backend, AI analysis layer, and database layer.


User Input
   ↓
Frontend Interface
   ↓
Backend API
   ↓
AI Analysis Engine
   ↓
Evidence / Search / Data Processing
   ↓
Firestore Database
   ↓
Scenario + Report Output




Suggested Tech Stack




Layer
Technology




Frontend
React / TypeScript


Styling
Tailwind CSS


Backend
Node.js


Database
Firebase Firestore


AI Model
Gemini 2.5 Flash


Search Grounding
Google Search Grounding


Hosting
Firebase Hosting / Vercel / Replit


Visualization
Custom SVG / Canvas / React components





Data Model Draft


Oracle Case


type OracleCase = {
  id: string;
  title: string;
  query: string;
  status: "draft" | "gathering" | "analyzing" | "completed";
  createdAt: string;
  updatedAt: string;

  signals: Signal[];
  questions: OracleQuestion[];
  hypotheses: Hypothesis[];
  scenarios: Scenario[];
  evidence: EvidenceItem[];
  briefing?: OracleBriefing;
};



Signal


type Signal = {
  id: string;
  title: string;
  summary: string;
  category: string;
  strength: number;
  source?: string;
  timestamp: string;
};



Hypothesis


type Hypothesis = {
  id: string;
  title: string;
  type: "base" | "positive" | "alternative" | "risk";
  probability: number;
  rationale: string;
  supportingEvidenceIds: string[];
  opposingEvidenceIds: string[];
};



Scenario


type Scenario = {
  id: string;
  title: string;
  probability: number;
  summary: string;
  drivers: string[];
  triggers: string[];
  implications: string[];
};



Evidence Item


type EvidenceItem = {
  id: string;
  title: string;
  source: string;
  url?: string;
  reliabilityScore: number;
  relevanceScore: number;
  linkedHypothesisIds: string[];
  collectedAt: string;
};




Development Roadmap


Phase 1 — Stabilize Core Execution




Fix runtime errors


Stabilize frontend/backend communication


Improve API response handling


Add error states and loading states




Phase 2 — Oracle Case Structure




Define stable case schema


Connect signals, questions, hypotheses, scenarios, and evidence


Store case data in Firestore


Enable case retrieval and editing




Phase 3 — Evidence Gathering Status




Add step-by-step collection workflow


Display progress indicators


Separate evidence gathering from final analysis


Add evidence reliability scoring




Phase 4 — Analyst Council




Add analyst perspective cards


Support expand/collapse interactions


Compare different analytical viewpoints


Generate final synthesis from multiple perspectives




Phase 5 — Oracle Briefing Studio




Generate structured intelligence briefings


Add export-ready briefing format


Support daily, weekly, and deep dive reports




Phase 6 — Evidence Ledger




Build source table


Track claim-to-evidence relationships


Add reliability and relevance scoring


Support filtering by source, hypothesis, and scenario




Phase 7 — Deep Dive Report




Generate long-form intelligence reports


Include scenario tables, evidence summaries, and decision implications


Support markdown or PDF export




Phase 8 — Decision Web / Graph




Visualize decision branches


Connect choices to scenario outcomes


Add probability-based path emphasis


Support user-driven scenario exploration




Phase 9 — Case Watch / Watch Trigger




Monitor selected cases over time


Detect new signals


Trigger alerts when assumptions change


Update scenario probabilities




Phase 10 — Monetization / Credit Structure




Define credit usage for analysis runs


Add user accounts


Add saved cases


Prepare subscription-based intelligence features





Current Status


BLACK ORACLE is in early active development.


Current focus:




Fixing execution errors


Stabilizing Oracle Case data structure


Improving mobile-first interface


Building the evidence gathering workflow


Preparing the Analyst Council and briefing modules





Installation




The exact commands may vary depending on the repository structure.




git clone https://github.com/your-username/black-oracle.git
cd black-oracle
npm install




Environment Variables


Create a .env file in the project root.


GEMINI_API_KEY=your_gemini_api_key
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id



Do not commit .env files to GitHub.



Running the Project


npm run dev



For production build:


npm run build




Suggested Folder Structure


black-oracle/
├── src/
│   ├── components/
│   │   ├── oracle/
│   │   ├── analysis/
│   │   ├── evidence/
│   │   └── briefing/
│   ├── pages/
│   ├── hooks/
│   ├── lib/
│   │   ├── firebase/
│   │   ├── gemini/
│   │   └── utils/
│   ├── types/
│   └── styles/
├── public/
├── docs/
├── .env.example
├── package.json
└── README.md




Design Principles


1. Mobile First


BLACK ORACLE is designed primarily for mobile use.


The interface should feel like a compact intelligence terminal rather than a traditional desktop dashboard.


2. One-Page Intelligence Flow


The main experience should remain focused and continuous.


Users should not feel like they are jumping between disconnected pages.


3. Visual Hierarchy Over Text Density


The system should reduce unnecessary text and use visual structure to communicate state, progress, and probability.


4. Scenario Thinking Over Single Answers


BLACK ORACLE should avoid pretending that one prediction is absolute.


The core experience is comparing multiple plausible futures.


5. Evidence Before Conclusion


Every final briefing should be connected to visible evidence, assumptions, and confidence levels.



Example Use Case


User Query:
"Analyze the current risk around AI semiconductor supply chains."

BLACK ORACLE Process:
1. Collects signals from market, technology, and geopolitical sources
2. Generates key analytical questions
3. Creates competing hypotheses
4. Searches for supporting and opposing evidence
5. Builds multiple future scenarios
6. Displays probability and risk levels
7. Produces an intelligence briefing




Planned Output Types




Oracle Briefing


Deep Dive Report


Evidence Ledger


Scenario Projection


Decision Web


Watch Trigger Alert


Weekly Intelligence Summary


Monthly Strategic Outlook





Disclaimer


BLACK ORACLE is an experimental analysis and decision-support system.


It does not provide financial, legal, military, or political advice.

All outputs should be reviewed critically and verified with reliable sources before being used for real-world decisions.



License


This project is currently private and under active development.


License information will be updated later.



Project Identity


BLACK ORACLE

Signal Intelligence. Scenario Forecasting. Strategic Decision Support.




Built for people who do not just want to know what happened.

Built for people who want to understand what may happen next.



