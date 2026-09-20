import type {
  AnalystReview,
  DebateSession,
  ForecastEvaluation,
  ReportCardProjection,
  ReportForecast,
  ReportVersion,
} from '../../src/report/contracts';

const dbConfig = () => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  return base && key
    ? {
        base,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    : null;
};

const assertConfigured = () => {
  const db = dbConfig();
  if (!db) throw new Error('Report Store is not configured.');
  return db;
};

const postAppendOnly = async (table: string, row: Record<string, unknown>) => {
  const db = assertConfigured();
  const response = await fetch(`${db.base}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...db.headers, Prefer: 'return=minimal' },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`${table} insert failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
};

export const appendReportVersion = async (report: ReportVersion) =>
  postAppendOnly('black_oracle_reports', {
    report_id: report.reportId,
    version: report.version,
    report_type: report.reportType,
    subject_id: report.subject.subjectId,
    status: report.status,
    as_of: new Date(report.asOf).toISOString(),
    evidence_cutoff: new Date(report.evidenceCutoff).toISOString(),
    created_at: new Date(report.createdAt).toISOString(),
    published_at: new Date(report.publishedAt).toISOString(),
    grade: report.grade,
    confidence: report.confidence,
    one_line_assessment: report.oneLineAssessment,
    payload: report,
  });

export const appendAnalystReview = async (review: AnalystReview) =>
  postAppendOnly('black_oracle_analyst_reviews', {
    review_id: review.reviewId,
    report_id: review.reportId,
    report_version: review.reportVersion,
    analyst_id: review.analyst.analystId,
    method_version: review.analyst.methodVersion,
    prompt_version: review.analyst.promptVersion,
    as_of: new Date(review.asOf).toISOString(),
    knowledge_cutoff: new Date(review.knowledgeCutoff).toISOString(),
    stance: review.stance,
    confidence: review.confidence,
    payload: review,
  });

export const appendDebateSession = async (debate: DebateSession) =>
  postAppendOnly('black_oracle_debate_sessions', {
    debate_id: debate.debateId,
    report_id: debate.reportId,
    report_version: debate.reportVersion,
    triggered: debate.triggered,
    trigger_reason: debate.triggerReason,
    started_at: debate.startedAt == null ? null : new Date(debate.startedAt).toISOString(),
    completed_at: debate.completedAt == null ? null : new Date(debate.completedAt).toISOString(),
    payload: debate,
  });

export const appendForecast = async (forecast: ReportForecast) =>
  postAppendOnly('black_oracle_report_forecasts', {
    forecast_id: forecast.forecastId,
    report_id: forecast.reportId,
    report_version: forecast.reportVersion,
    published_at: new Date(forecast.publishedAt).toISOString(),
    as_of: new Date(forecast.asOf).toISOString(),
    horizon_end_at: forecast.horizonEndAt == null ? null : new Date(forecast.horizonEndAt).toISOString(),
    status: forecast.status,
    payload: forecast,
  });

export const appendForecastEvaluation = async (evaluation: ForecastEvaluation) =>
  postAppendOnly('black_oracle_forecast_evaluations', {
    evaluation_id: evaluation.evaluationId,
    forecast_id: evaluation.forecastId,
    evaluated_at: new Date(evaluation.evaluatedAt).toISOString(),
    payload: evaluation,
  });

const readRows = async (path: string) => {
  const db = assertConfigured();
  const response = await fetch(`${db.base}/rest/v1/${path}`, {
    headers: db.headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Report Store read failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
  return await response.json() as any[];
};

export const readLatestReportVersion = async (reportId: string): Promise<ReportVersion | null> => {
  const rows = await readRows(
    `black_oracle_reports?report_id=eq.${encodeURIComponent(reportId)}&select=payload&order=version.desc&limit=1`,
  );
  return rows[0]?.payload ?? null;
};

export const readReportVersions = async (reportId: string, limit = 50): Promise<ReportVersion[]> => {
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const rows = await readRows(
    `black_oracle_reports?report_id=eq.${encodeURIComponent(reportId)}&select=payload&order=version.desc&limit=${safeLimit}`,
  );
  return rows.map((row) => row.payload).filter(Boolean);
};

export const readReportCards = async (limit = 50): Promise<ReportCardProjection[]> => {
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const rows = await readRows(
    `black_oracle_reports?status=in.(PUBLISHED,CORRECTED)&select=report_id,version,report_type,subject_id,grade,one_line_assessment,published_at,payload&order=published_at.desc&limit=${safeLimit}`,
  );

  return rows.map((row) => {
    const report = row.payload as ReportVersion;
    return {
      reportId: report.reportId,
      version: report.version,
      reportType: report.reportType,
      subjectId: report.subject.subjectId,
      displayName: report.subject.displayName,
      canonicalSymbol: report.subject.canonicalSymbol ?? null,
      currentPrice: null,
      currency: null,
      grade: report.grade,
      previousGrade: null,
      oneLineAssessment: report.oneLineAssessment,
      publishedAt: report.publishedAt,
      isNew: false,
      isMaterialGradeChange: false,
    };
  });
};
