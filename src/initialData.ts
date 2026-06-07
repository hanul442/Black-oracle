import { Source, Signal, Question, Hypothesis, Evidence, ScenarioBranch, PredictionOutcome, Report } from './types';

export const initialSources: Source[] = [
  { id: 'SRC-NVDA-1', title: '엔비디아 2024년 1분기 실적 발표', sourceType: 'system', sourceName: 'SEC Edgar', reliability: 99, collectedAt: '2024-05-22T20:20:00Z', publishedAt: '2024-05-22T20:20:00Z', status: 'LIVE', language: 'ko', region: 'Global', category: 'Finance', summary: '매출 260억 달러, 전년 동기 대비 262% 증가.', rawTextSnippet: 'DATA', extractedKeywords: ['실적', 'H100', '블랙웰'], extractedEntities: [], linkedSignalIds: ['sig-nvda-1'], linkedQuestionIds: [], linkedHypothesisIds: [], linkedScenarioIds: [], originalUrl: '', evidenceRole: 'supporting' },
  { id: 'SRC-TSMC-1', title: 'TSMC 2024년 4월 매출', sourceType: 'system', sourceName: 'TWSE', reliability: 99, collectedAt: '2024-05-10T06:00:00Z', publishedAt: '2024-05-10T06:00:00Z', status: 'LIVE', language: 'ko', region: 'APAC', category: 'Finance', summary: '매출 2,360억 대만 달러, 전년 동기 대비 59.6% 증가.', rawTextSnippet: 'DATA', extractedKeywords: ['파운드리', '설비투자'], extractedEntities: [], linkedSignalIds: ['sig-tsmc-1'], linkedQuestionIds: [], linkedHypothesisIds: [], linkedScenarioIds: [], originalUrl: '', evidenceRole: 'supporting' }
];

export const initialSignals: Signal[] = [
  { id: 'sig-nvda-1', sourceIds: ['SRC-NVDA-1'], category: 'Hardware', urgency: 85, signalStrength: 95, novelty: 40, title: '엔비디아 데이터센터 부문 전년 대비 427% 폭발적 성장', summary: '호퍼(Hopper) 아키텍처 수요 급증으로 데이터센터 부문에서 전례 없는 성장률 기록.', detectedAt: '2024-05-22', linkedQuestionIds: ['Q-SEMI-1'] },
  { id: 'sig-tsmc-1', sourceIds: ['SRC-TSMC-1'], category: 'Hardware', urgency: 70, signalStrength: 90, novelty: 30, title: 'TSMC 월간 매출 급증', summary: '4월 매출이 시장 컨센서스 추정치를 크게 상회함.', detectedAt: '2024-05-10', linkedQuestionIds: ['Q-SEMI-1'] }
];

export const initialQuestions: Question[] = [
  { id: 'Q-SEMI-1', signalIds: ['sig-nvda-1', 'sig-tsmc-1'], text: '글로벌 반도체 공급망이 2024년 4분기까지 거대 빅테크(Hyperscaler)들의 현재 CAPEX(설비투자) 수요를 지속적으로 감당할 수 있을 것인가?', hypothesisIds: ['HYP-SEMI-A', 'HYP-SEMI-B'] }
];

export const initialHypotheses: Hypothesis[] = [
  { id: 'HYP-SEMI-A', questionId: 'Q-SEMI-1', title: '공급망 병목 현상 완화 (CoWoS 라인 증설 효과)', confidence: 75, evidenceIds: ['ev-nvda-1'], scenarioIds: ['SCEN-SEMI-1'], description: 'TSMC의 첨단 패키징(CoWoS) 생산 능력 확대로 지속적인 백오더 물량 소화 가능.', status: 'Active' },
  { id: 'HYP-SEMI-B', questionId: 'Q-SEMI-1', title: '거시경제 위축으로 인한 빅테크 기업들의 선제적 지출 축소', confidence: 25, evidenceIds: ['ev-tsmc-1'], scenarioIds: ['SCEN-SEMI-2'], description: '고금리 장기화 및 AI 투자 대비 수익률(ROI) 우려로 빅테크의 AI 설비투자가 둔화됨.', status: 'Monitoring' }
];

export const initialScenarios: ScenarioBranch[] = [
  { id: 'SCEN-SEMI-1', hypothesisId: 'HYP-SEMI-A', title: '지속 가능한 하이퍼 성장 국면', probability: 75, impactScore: 90, feasibility: 'High', triggerCondition: '4분기 CAPEX 가이던스 상향 반영', invalidationCondition: '거시경제 충격 발현', evidenceIds: ['ev-nvda-1'], timeline: '2024-2025', expectedOutcome: '지속적인 주가 랠리 및 밸류에이션 리레이팅', nextIndicators: ['TSMC 월간 매출 추이', '주요 빅테크 CAPEX 가이던스'], status: 'Active' },
  { id: 'SCEN-SEMI-2', hypothesisId: 'HYP-SEMI-B', title: '설비투자(CapEx) 소화 및 재조정기 진입', probability: 25, impactScore: 60, feasibility: 'Medium', triggerCondition: '단기 칩 수율 하락 및 고객사 주문 지연', invalidationCondition: '예상외의 조기 금리 인하 사이클 도래', evidenceIds: ['ev-tsmc-1'], timeline: 'H2 2024', expectedOutcome: '기술주 전반의 광범위한 가격 조정', nextIndicators: ['엔비디아 차기 분기 포워드 가이던스'], status: 'Monitoring' }
];

export const initialEvidence: Evidence[] = [
  { id: 'ev-nvda-1', linkedHypothesisId: 'HYP-SEMI-A', linkedScenarioBranchId: 'SCEN-SEMI-1', title: '엔비디아 1분기 어닝 서프라이즈', evidenceType: 'supporting', probabilityChange: 15, sourceId: 'SRC-NVDA-1', evidenceWeight: 95, impactScore: 25, reliability: 99, confidenceChange: 10, summary: '시장 컨센서스를 압도적으로 상회하는 막대한 매출 기록.' },
  { id: 'ev-tsmc-1', linkedHypothesisId: 'HYP-SEMI-B', linkedScenarioBranchId: 'SCEN-SEMI-2', title: '파운드리 리드 타임 장기화 우려', evidenceType: 'contradicting', probabilityChange: -5, sourceId: 'SRC-TSMC-1', evidenceWeight: 75, impactScore: -10, reliability: 85, confidenceChange: -5, summary: '리드 타임이 여전히 길지만 변동폭은 점차 안정되고 있음.' }
];

export const initialReports: Report[] = [
  { id: 'rep-semi-1', type: 'Equity Research', title: '반도체 설비투자(CapEx) 슈퍼사이클 현황 업데이트', date: '2024-05-23T06:00:00Z', topSignalId: 'sig-nvda-1', scenarioProbabilityChange: 'SCEN-SEMI-1 확률 75%로 상향 조정됨', watchNext: '향후 빅테크(CSP) 분기 실적 발표 주시 필요', content: "최근 엔비디아의 실적 발표와 TSMC의 월간 매출 데이터를 종합해볼 때, 당사는 AI 하드웨어 공급망에 대한 기존의 긍정적인 전망을 유지합니다. TSMC의 선단 패키징(CoWoS) 설비 증설은 호퍼(Hopper) 및 차세대 블랙웰(Blackwell) 출하의 주요 병목 현상을 성공적으로 해소하고 있습니다.\n\n주요 리스크 요인은 여전히 거시경제 긴축 기조 및 고금리 장기화에 집중되어 있으며, 이는 2티어 기업 고객들이 서버 임대 등 IT 하드웨어 비용을 재분석하게 만들 수 있습니다. 그러나 상위 하이퍼스케일러(마이크로소프트, 메타, 구글, AWS)의 수요는 여전히 매우 견조하게 유지되고 있으므로, 단기적인 소화 국면(소위 '보릿고개')이 올 확률은 낮다고 판단됩니다(발생 확률 25%)." }
];

export const initialPredictions: PredictionOutcome[] = [
  { id: 'pred-semi-1', scenarioId: 'SCEN-SEMI-1', statement: '엔비디아는 2024년 2분기 시장 컨센서스 매출액(280억 달러)을 상회할 것이다.', probability: 82, trend: 'up', reviewDate: '2024-08-20', status: 'Pending', confidence: 90, validationCondition: '실제 파이널 리포트 매출 > 280억 달러 확인시 검증 완료', invalidationCondition: '실제 파이널 리포트 매출 < 280억 달러 기록시 검증 실패' }
];
