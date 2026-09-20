import {
  INVESTMENT_ATTRACTIVENESS_GRADES,
  type InvestmentAttractivenessGrade,
  type ReportCardProjection,
  type ReportVersion,
} from '../../src/report/contracts';

const GRADE_INDEX = new Map(
  INVESTMENT_ATTRACTIVENESS_GRADES.map((grade, index) => [grade, index] as const),
);

export const gradeDistance = (
  previous: InvestmentAttractivenessGrade | null | undefined,
  current: InvestmentAttractivenessGrade | null | undefined,
) => {
  if (!previous || !current) return null;
  const previousIndex = GRADE_INDEX.get(previous);
  const currentIndex = GRADE_INDEX.get(current);
  if (previousIndex == null || currentIndex == null) return null;
  return previousIndex - currentIndex;
};

export const isMaterialGradeChange = (
  previous: InvestmentAttractivenessGrade | null | undefined,
  current: InvestmentAttractivenessGrade | null | undefined,
  minimumSteps = 2,
) => {
  const distance = gradeDistance(previous, current);
  return distance != null && Math.abs(distance) >= Math.max(1, Math.trunc(minimumSteps));
};

export const buildReportCardProjection = (input: {
  current: ReportVersion;
  previous?: ReportVersion | null;
  currentPrice?: number | null;
  currency?: string | null;
  now?: number;
  newWindowMs?: number;
  materialGradeSteps?: number;
}): ReportCardProjection => {
  const now = input.now ?? Date.now();
  const newWindowMs = input.newWindowMs ?? 48 * 60 * 60 * 1000;
  const publishedAt = input.current.publishedAt;
  const isNew = publishedAt != null && publishedAt <= now && now - publishedAt <= newWindowMs;
  const previousGrade = input.previous?.grade ?? null;

  return {
    reportId: input.current.reportId,
    version: input.current.version,
    reportType: input.current.reportType,
    subjectId: input.current.subject.subjectId,
    displayName: input.current.subject.displayName,
    canonicalSymbol: input.current.subject.canonicalSymbol ?? null,
    currentPrice: input.currentPrice ?? null,
    currency: input.currency ?? null,
    grade: input.current.grade,
    previousGrade,
    oneLineAssessment: input.current.oneLineAssessment,
    publishedAt,
    isNew,
    isMaterialGradeChange: isMaterialGradeChange(
      previousGrade,
      input.current.grade,
      input.materialGradeSteps ?? 2,
    ),
  };
};
