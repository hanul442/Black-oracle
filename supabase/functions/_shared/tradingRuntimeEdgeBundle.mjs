// src/trading/blindValidation.ts
var priceMaps = (history) => (history ?? []).filter((item) => Number.isFinite(item?.timestamp) && item.timestamp > 0 && Array.isArray(item.prices)).sort((a, b) => a.timestamp - b.timestamp).map((item) => ({
  timestamp: item.timestamp,
  prices: new Map(item.prices.filter(([market, price]) => /^KRW-[A-Z0-9]+$/.test(String(market).toUpperCase()) && Number.isFinite(price) && price > 0).map(([market, price]) => [String(market).toUpperCase(), price]))
}));
var buildBlindValidationSamples = (decisions, history, horizonMs = 4 * 60 * 6e4) => {
  const orderedPrices = priceMaps(history);
  if (!orderedPrices.length) return [];
  const allowedActions = /* @__PURE__ */ new Set(["ENTER", "EXIT", "HOLD"]);
  return (decisions ?? []).flatMap((decision) => {
    if (!allowedActions.has(decision.action)) return [];
    const market = decision.market.toUpperCase();
    const anchor = orderedPrices.find((item) => item.timestamp >= decision.timestamp && item.prices.has(market));
    if (!anchor) return [];
    const target = orderedPrices.find((item) => item.timestamp >= anchor.timestamp + horizonMs && item.prices.has(market));
    if (!target) return [];
    const anchorPrice = anchor.prices.get(market);
    const targetPrice = target.prices.get(market);
    const rawReturn = targetPrice / anchorPrice - 1;
    if (!Number.isFinite(rawReturn) || rawReturn <= -1 || rawReturn >= 10) return [];
    const directionalReturn = decision.action === "EXIT" ? -rawReturn : rawReturn;
    return [{
      market,
      decisionTimestamp: decision.timestamp,
      anchorTimestamp: anchor.timestamp,
      targetTimestamp: target.timestamp,
      action: decision.action,
      regime: decision.regime,
      anchorPrice,
      targetPrice,
      rawReturn,
      directionalReturn,
      favorable: directionalReturn > 0
    }];
  }).sort((a, b) => a.decisionTimestamp - b.decisionTimestamp || a.market.localeCompare(b.market));
};

// src/trading/councilComparison.ts
var clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
var round = (value, digits = 8) => Number(value.toFixed(digits));
var FLAT_BAND = 3e-3;
var VOLATILITY_BAND = 7e-3;
var stableId = (market, generatedAt, v1ScenarioId, v2ScenarioId) => `council-compare:${market}:${generatedAt}:${v1ScenarioId}:${v2ScenarioId}`;
var predictionFrom = (protocol, branch, confidence, disposition, score) => ({
  protocol,
  scenarioId: branch.id,
  label: branch.label,
  direction: branch.direction,
  probability: clamp01(branch.probability),
  confidence: clamp01(confidence),
  disposition,
  score: clamp01(score)
});
var createCouncilComparisonObservation = (value, anchorPrice, horizonMs = 4 * 60 * 6e4) => {
  if (!Number.isFinite(anchorPrice) || anchorPrice <= 0) return null;
  const generatedAt = value.challenger.generatedAt;
  const v1Ranking = value.base.council.rankings.find((item) => item.rank === 1) ?? value.base.council.rankings[0];
  const v2Assessment = value.challenger.assessments.find((item) => item.rank === 1) ?? value.challenger.assessments[0];
  if (!v1Ranking || !v2Assessment) return null;
  const v1Branch = value.base.scenarios.branches.find((item) => item.id === v1Ranking.scenarioId);
  const v2Branch = value.base.scenarios.branches.find((item) => item.id === v2Assessment.scenarioId);
  if (!v1Branch || !v2Branch) return null;
  return {
    id: stableId(value.base.market, generatedAt, v1Branch.id, v2Branch.id),
    market: value.base.market,
    generatedAt,
    targetTimestamp: generatedAt + Math.max(6e4, horizonMs),
    anchorPrice,
    v1: predictionFrom("COUNCIL_V1", v1Branch, v1Ranking.confidence, v1Ranking.disposition, v1Ranking.consensusScore),
    v2: predictionFrom("COUNCIL_V2_CHALLENGER", v2Branch, v2Assessment.confidence, v2Assessment.disposition, v2Assessment.synthesisScore),
    resolvedAt: null,
    targetPrice: null,
    rawReturn: null,
    v1DirectionalUtility: null,
    v2DirectionalUtility: null,
    v1Favorable: null,
    v2Favorable: null,
    executionAuthority: false,
    promotionAuthority: false
  };
};
var directionalUtility = (direction, rawReturn) => {
  if (direction === "UP") return rawReturn;
  if (direction === "DOWN") return -rawReturn;
  if (direction === "FLAT") return FLAT_BAND - Math.abs(rawReturn);
  return Math.abs(rawReturn) - VOLATILITY_BAND;
};
var firstTarget = (history, market, targetTimestamp) => {
  for (const snapshot of history) {
    if (snapshot.timestamp < targetTimestamp) continue;
    const match = snapshot.prices.find(([candidate]) => candidate === market);
    if (match && Number.isFinite(match[1]) && match[1] > 0) return { timestamp: snapshot.timestamp, price: match[1] };
  }
  return null;
};
var resolveCouncilComparisonObservations = (observations, history) => {
  const orderedHistory = history.slice().sort((a, b) => a.timestamp - b.timestamp);
  return observations.map((item) => {
    if (item.resolvedAt != null) return { ...item, v1: { ...item.v1 }, v2: { ...item.v2 } };
    const target = firstTarget(orderedHistory, item.market, item.targetTimestamp);
    if (!target) return { ...item, v1: { ...item.v1 }, v2: { ...item.v2 } };
    const rawReturn = target.price / item.anchorPrice - 1;
    const v1Utility = directionalUtility(item.v1.direction, rawReturn);
    const v2Utility = directionalUtility(item.v2.direction, rawReturn);
    return {
      ...item,
      v1: { ...item.v1 },
      v2: { ...item.v2 },
      resolvedAt: target.timestamp,
      targetPrice: target.price,
      rawReturn: round(rawReturn),
      v1DirectionalUtility: round(v1Utility),
      v2DirectionalUtility: round(v2Utility),
      v1Favorable: v1Utility > 0,
      v2Favorable: v2Utility > 0
    };
  });
};
var mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
var favorableRate = (values) => {
  const usable = values.filter((value) => typeof value === "boolean");
  return usable.length ? usable.filter(Boolean).length / usable.length : null;
};
var brierProxy = (rows, protocol) => {
  if (!rows.length) return null;
  const total = rows.reduce((sum, row) => {
    const prediction = protocol === "v1" ? row.v1 : row.v2;
    const outcome = protocol === "v1" ? row.v1Favorable : row.v2Favorable;
    const probability = clamp01(prediction.probability * 0.7 + prediction.confidence * 0.3);
    return sum + (probability - (outcome ? 1 : 0)) ** 2;
  }, 0);
  return total / rows.length;
};
var summarizeCouncilComparison = (observations, minimumResolved = 60, minimumDisagreements = 15) => {
  const resolved = observations.filter((item) => item.resolvedAt != null && item.rawReturn != null);
  const disagreements = resolved.filter((item) => item.v1.direction !== item.v2.direction || item.v1.disposition !== item.v2.disposition);
  const v1FavorableRate = favorableRate(resolved.map((item) => item.v1Favorable));
  const v2FavorableRate = favorableRate(resolved.map((item) => item.v2Favorable));
  const v1MeanDirectionalUtility = mean(resolved.flatMap((item) => item.v1DirectionalUtility == null ? [] : [item.v1DirectionalUtility]));
  const v2MeanDirectionalUtility = mean(resolved.flatMap((item) => item.v2DirectionalUtility == null ? [] : [item.v2DirectionalUtility]));
  const v1DirectionalBrierProxy = brierProxy(resolved, "v1");
  const v2DirectionalBrierProxy = brierProxy(resolved, "v2");
  const v2WinRateOnDisagreement = disagreements.length ? disagreements.filter((item) => (item.v2DirectionalUtility ?? -Infinity) > (item.v1DirectionalUtility ?? -Infinity)).length / disagreements.length : null;
  let recommendation = "INSUFFICIENT_DATA";
  if (resolved.length >= minimumResolved && disagreements.length >= minimumDisagreements) {
    const v2ImprovesHitRate = (v2FavorableRate ?? 0) >= (v1FavorableRate ?? 0) + 0.03;
    const v2ImprovesUtility = (v2MeanDirectionalUtility ?? -Infinity) > (v1MeanDirectionalUtility ?? Infinity);
    const v2NoWorseCalibration = (v2DirectionalBrierProxy ?? Infinity) <= (v1DirectionalBrierProxy ?? -Infinity);
    const v2WinsDisagreements = (v2WinRateOnDisagreement ?? 0) >= 0.55;
    recommendation = v2ImprovesHitRate && v2ImprovesUtility && v2NoWorseCalibration && v2WinsDisagreements ? "V2_PROMOTION_CANDIDATE" : "KEEP_V1";
  }
  return {
    total: observations.length,
    resolved: resolved.length,
    unresolved: observations.length - resolved.length,
    disagreements: disagreements.length,
    v1FavorableRate,
    v2FavorableRate,
    v1MeanDirectionalUtility,
    v2MeanDirectionalUtility,
    v1DirectionalBrierProxy,
    v2DirectionalBrierProxy,
    v2WinRateOnDisagreement,
    recommendation,
    executionAuthority: false,
    promotionAuthority: false
  };
};

// src/trading/governanceCore.ts
var clamp012 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
var clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
var round2 = (value, digits = 6) => Number(value.toFixed(digits));
var stableHash = (value) => {
  let hash2 = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash2 ^= value.charCodeAt(index);
    hash2 = Math.imul(hash2, 16777619);
  }
  return (hash2 >>> 0).toString(36);
};
var stableId2 = (prefix, parts) => `${prefix}-${stableHash(parts.join("|"))}`;
var directionFromEvidence = (evidence) => {
  if (evidence.activeCount === 0) return "NEUTRAL";
  const hasTwoSidedWeight = evidence.bullishWeight > 0.08 && evidence.bearishWeight > 0.08;
  if (evidence.contradictionCount > 0 && hasTwoSidedWeight) return "MIXED";
  if (evidence.score >= 15) return "BULLISH";
  if (evidence.score <= -15) return "BEARISH";
  return "NEUTRAL";
};
var buildImpact = (input, now, expiresAt) => {
  const { evidence } = input;
  const direction = directionFromEvidence(evidence);
  const materiality = clamp012(Math.abs(evidence.score) / 100 * 0.55 + evidence.confidence * 0.45);
  let disposition = "INSUFFICIENT";
  if (evidence.activeCount > 0 && materiality >= 0.35 && evidence.confidence >= 0.45) disposition = "MATERIAL";
  else if (evidence.activeCount > 0) disposition = "WATCH";
  const reasons = evidence.reasons.slice();
  if (evidence.activeCount === 0) reasons.push("Entry governance requires at least one active structured external evidence item.");
  if (evidence.contradictionCount > 0) reasons.push(`${evidence.contradictionCount} contradiction link(s) require Council caution.`);
  return {
    market: input.market.toUpperCase(),
    scope: input.scope ?? "CANDIDATE",
    disposition,
    direction,
    materiality: round2(materiality),
    confidence: round2(clamp012(evidence.confidence)),
    evidenceIds: evidence.evidenceIds.slice(),
    reasons,
    asOf: now,
    expiresAt,
    executionAuthority: false
  };
};
var normalizedProbabilities = (values) => {
  const safe = values.map((value) => Math.max(0.01, value));
  const total = safe.reduce((sum, value) => sum + value, 0);
  return safe.map((value) => round2(value / total));
};
var buildScenarios = (input, now, expiresAt, scenarioSetId) => {
  const technical = clamp(input.multiTimeframe.directionalScore, -100, 100);
  const event = clamp(input.evidence.score, -100, 100);
  const liquidityBias = clamp(input.liquidity.orderbookImbalance * 45 + input.liquidity.signedChangeRate * 400, -100, 100);
  const combined = clamp(technical * 0.55 + event * 0.35 + liquidityBias * 0.1, -100, 100);
  const atrPct = input.multiTimeframe.frames.oneHour.indicators.atrPct;
  const volatility = clamp012(atrPct / 0.04);
  const contradictionPressure = clamp012(input.evidence.contradictionCount / Math.max(1, input.evidence.activeCount));
  const [bullProbability, baseProbability, bearProbability, tailProbability] = normalizedProbabilities([
    0.28 + Math.max(0, combined) / 240 - Math.max(0, -combined) / 650,
    0.38 - Math.abs(combined) / 520,
    0.2 + Math.max(0, -combined) / 240 - Math.max(0, combined) / 700,
    0.14 + volatility * 0.08 + contradictionPressure * 0.07
  ]);
  const sharedConfidence = clamp012(
    input.multiTimeframe.confidence * 0.45 + input.evidence.confidence * 0.35 + clamp012(input.liquidity.score / 100) * 0.2
  );
  const evidenceIds = input.evidence.evidenceIds.slice();
  const market = input.market.toUpperCase();
  const makeBranch = (label, probability, direction, thesis, triggerConditions, invalidationConditions, watchItems, confidenceAdjustment = 0) => ({
    id: stableId2("scenario", [scenarioSetId, label]),
    market,
    label,
    probability,
    confidence: round2(clamp012(sharedConfidence + confidenceAdjustment)),
    direction,
    thesis,
    triggerConditions,
    invalidationConditions,
    watchItems,
    evidenceIds
  });
  const branches = [
    makeBranch(
      "BULL",
      bullProbability,
      "UP",
      "Evidence and multi-timeframe structure remain positively aligned and price continuation is sustained.",
      ["Directional score remains positive.", "Bullish evidence remains active and non-stale.", "Liquidity gate remains eligible."],
      ["Directional score falls below neutral.", "Material evidence turns bearish or expires.", "Liquidity becomes ineligible."],
      ["4H/1H trend alignment", "Evidence expiry/contradictions", "Spread and orderbook depth"],
      combined >= 20 ? 0.06 : -0.04
    ),
    makeBranch(
      "BASE",
      baseProbability,
      "FLAT",
      "Signals remain mixed enough that consolidation or slow drift is more likely than immediate expansion.",
      ["Directional score stays near neutral.", "Evidence remains mixed or low-materiality."],
      ["A high-confidence directional signal emerges.", "Material event evidence changes the balance."],
      ["Range width", "1H regime", "Evidence materiality"],
      Math.abs(combined) <= 25 ? 0.04 : -0.03
    ),
    makeBranch(
      "BEAR",
      bearProbability,
      "DOWN",
      "Technical structure weakens and/or material source-backed evidence turns adverse for a long-only spot position.",
      ["Directional score becomes negative.", "Bearish evidence weight exceeds bullish weight."],
      ["Technical structure recovers with bullish evidence confirmation."],
      ["Stop distance", "Bearish evidence weight", "Downtrend regime persistence"],
      combined <= -20 ? 0.06 : -0.04
    ),
    makeBranch(
      "TAIL",
      tailProbability,
      "VOLATILE",
      "Volatility, evidence contradiction, or liquidity deterioration creates a discontinuous adverse path.",
      ["ATR expands materially.", "Contradictions increase.", "Liquidity eligibility degrades."],
      ["Volatility normalizes and evidence contradictions resolve."],
      ["ATR%", "Contradiction count", "Liquidity warning/spread"],
      volatility >= 0.75 || contradictionPressure >= 0.5 ? 0.03 : -0.08
    )
  ];
  return {
    id: scenarioSetId,
    market,
    asOf: now,
    expiresAt,
    branches,
    sourceEvidenceIds: evidenceIds,
    executionAuthority: false
  };
};
var branchAlignment = (branch, combined, volatility) => {
  if (branch.direction === "UP") return clamp012((combined + 100) / 200);
  if (branch.direction === "DOWN") return clamp012((100 - combined) / 200);
  if (branch.direction === "FLAT") return clamp012(1 - Math.abs(combined) / 100);
  return volatility;
};
var stanceFor = (lensId, branch, input) => {
  const technical = input.multiTimeframe.directionalScore;
  const evidence = input.evidence.score;
  const volatility = clamp012(input.multiTimeframe.frames.oneHour.indicators.atrPct / 0.04);
  let stance = "MIXED";
  let confidence = 0.5;
  const reasons = [];
  if (lensId === "TREND") {
    const alignment = branch.direction === "UP" ? technical / 100 : branch.direction === "DOWN" ? -technical / 100 : branch.direction === "FLAT" ? 1 - Math.abs(technical) / 100 : volatility;
    stance = alignment >= 0.35 ? "SUPPORT" : alignment <= -0.2 ? "CHALLENGE" : "MIXED";
    confidence = clamp012(input.multiTimeframe.confidence);
    reasons.push(`Multi-timeframe directional score is ${Math.round(technical)}.`);
  } else if (lensId === "EVENT") {
    if (input.evidence.activeCount === 0) {
      stance = "INSUFFICIENT";
      confidence = 0;
      reasons.push("No active structured external evidence is available.");
    } else {
      const alignment = branch.direction === "UP" ? evidence / 100 : branch.direction === "DOWN" ? -evidence / 100 : branch.direction === "FLAT" ? 1 - Math.abs(evidence) / 100 : input.evidence.contradictionCount > 0 ? 0.7 : 0.2;
      stance = alignment >= 0.35 ? "SUPPORT" : alignment <= -0.2 ? "CHALLENGE" : "MIXED";
      confidence = clamp012(input.evidence.confidence);
      reasons.push(`Evidence score is ${Math.round(evidence)} with ${input.evidence.activeCount} active item(s).`);
    }
  } else if (lensId === "LIQUIDITY") {
    stance = input.liquidity.eligible ? "SUPPORT" : "CHALLENGE";
    confidence = clamp012(input.liquidity.score / 100);
    reasons.push(input.liquidity.eligible ? "Liquidity gate is eligible." : "Liquidity gate is not eligible.");
    reasons.push(`Spread is ${input.liquidity.spreadBps.toFixed(1)} bps.`);
  } else {
    const tailPressure = volatility * 0.55 + clamp012(input.evidence.contradictionCount / 3) * 0.25 + (input.liquidity.warning ? 0.2 : 0);
    if (branch.label === "TAIL") stance = tailPressure >= 0.45 ? "SUPPORT" : "MIXED";
    else stance = tailPressure >= 0.7 ? "CHALLENGE" : "SUPPORT";
    confidence = clamp012(0.55 + Math.abs(tailPressure - 0.5) * 0.7);
    reasons.push(`Tail-pressure proxy is ${Math.round(tailPressure * 100)}%.`);
  }
  return {
    lensId,
    scenarioId: branch.id,
    stance,
    confidence: round2(confidence),
    reasons
  };
};
var dispositionFor = (branch, rank, consensusScore, confidence, input) => {
  if (input.evidence.activeCount === 0) return "INSUFFICIENT";
  if (!input.liquidity.eligible) return "CHALLENGE";
  if (branch.label === "TAIL" && rank === 1) return "CHALLENGE";
  if (branch.label === "BEAR" && rank === 1) return "CHALLENGE";
  if (rank === 1 && consensusScore >= 0.55 && confidence >= 0.55) return "ADVANCE";
  if (consensusScore < 0.35) return "CHALLENGE";
  return "MONITOR";
};
var buildCouncil = (input, scenarios, now, expiresAt, councilRunId) => {
  const technical = clamp(input.multiTimeframe.directionalScore, -100, 100);
  const event = clamp(input.evidence.score, -100, 100);
  const liquidityBias = clamp(input.liquidity.orderbookImbalance * 45 + input.liquidity.signedChangeRate * 400, -100, 100);
  const combined = clamp(technical * 0.55 + event * 0.35 + liquidityBias * 0.1, -100, 100);
  const volatility = clamp012(input.multiTimeframe.frames.oneHour.indicators.atrPct / 0.04);
  const lensIds = ["TREND", "EVENT", "LIQUIDITY", "RISK"];
  const lensReviews = scenarios.branches.flatMap((branch) => lensIds.map((lensId) => stanceFor(lensId, branch, input)));
  const scored = scenarios.branches.map((branch) => {
    const branchLens = lensReviews.filter((item) => item.scenarioId === branch.id);
    const support = branchLens.reduce((sum, item) => sum + (item.stance === "SUPPORT" ? item.confidence : item.stance === "CHALLENGE" ? -item.confidence : 0), 0) / branchLens.length;
    const alignment = branchAlignment(branch, combined, volatility);
    const consensusScore = clamp012(branch.probability * 0.45 + alignment * 0.25 + branch.confidence * 0.2 + clamp012((support + 1) / 2) * 0.1);
    const confidence = clamp012(branch.confidence * 0.55 + branchLens.reduce((sum, item) => sum + item.confidence, 0) / branchLens.length * 0.45);
    return { branch, consensusScore, confidence, branchLens };
  }).sort((a, b) => b.consensusScore - a.consensusScore || b.branch.probability - a.branch.probability || a.branch.id.localeCompare(b.branch.id));
  const rankings = scored.map((item, index) => {
    const rank = index + 1;
    const disposition = dispositionFor(item.branch, rank, item.consensusScore, item.confidence, input);
    const supports = item.branchLens.filter((review) => review.stance === "SUPPORT");
    const challenges = item.branchLens.filter((review) => review.stance === "CHALLENGE" || review.stance === "INSUFFICIENT");
    return {
      scenarioId: item.branch.id,
      rank,
      consensusScore: round2(item.consensusScore),
      probabilityEstimate: item.branch.probability,
      confidence: round2(item.confidence),
      disposition,
      dominantSupport: supports[0]?.reasons[0] ?? "No dominant supporting lens.",
      dominantChallenge: challenges[0]?.reasons[0] ?? "No dominant challenging lens.",
      unresolvedUncertainty: [
        ...input.evidence.contradictionCount > 0 ? ["Structured evidence contains unresolved contradiction links."] : [],
        ...input.evidence.activeCount < 2 ? ["Evidence breadth is thin."] : []
      ],
      preservedDissent: challenges.map((review) => `${review.lensId}: ${review.reasons[0]}`).slice(0, 4)
    };
  });
  const recommendedScenarioId = rankings[0]?.scenarioId ?? null;
  const crossScenarioObservations = [
    `Combined deterministic directional context is ${Math.round(combined)} on a -100 to +100 scale.`,
    `Council evaluated ${scenarios.branches.length} scenarios through ${lensIds.length} independent deterministic lenses.`
  ];
  if (input.evidence.activeCount === 0) crossScenarioObservations.push("All entry governance remains insufficient until structured external evidence is attached.");
  return {
    id: councilRunId,
    market: input.market.toUpperCase(),
    asOf: now,
    expiresAt,
    recommendedScenarioId,
    rankings,
    crossScenarioObservations,
    executionAuthority: false,
    lensReviews
  };
};
var buildDeterministicGovernancePackage = (input) => {
  const market = input.market.toUpperCase();
  const now = input.now ?? Date.now();
  const ttlMs = clamp(input.ttlMs ?? 45 * 6e4, 5 * 6e4, 4 * 60 * 6e4);
  const expiresAt = now + ttlMs;
  const identity = [
    market,
    now,
    input.evidence.asOf,
    input.evidence.evidenceIds.slice().sort().join(","),
    Math.round(input.multiTimeframe.oracleTradeScore),
    Math.round(input.multiTimeframe.directionalScore)
  ];
  const packageId = stableId2("intel", identity);
  const scenarioSetId = stableId2("scenario-set", identity);
  const councilRunId = stableId2("council", identity);
  const impact = buildImpact(input, now, expiresAt);
  const scenarios = buildScenarios(input, now, expiresAt, scenarioSetId);
  const council = buildCouncil(input, scenarios, now, expiresAt, councilRunId);
  return {
    id: packageId,
    market,
    generatedAt: now,
    expiresAt,
    impact,
    scenarios,
    council,
    evidenceIds: input.evidence.evidenceIds.slice(),
    executionAuthority: false,
    provenance: {
      engine: "DETERMINISTIC_COUNCIL_CORE_V1",
      evidenceAsOf: input.evidence.asOf,
      technicalAsOf: input.multiTimeframe.asOf,
      liquidityEligible: input.liquidity.eligible
    }
  };
};

// src/trading/councilV2.ts
var clamp013 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
var round3 = (value, digits = 6) => Number(value.toFixed(digits));
var scenarioDirectionAlignment = (branch, directionalScore) => {
  const normalized = Math.max(-1, Math.min(1, directionalScore / 100));
  if (branch.direction === "UP") return clamp013((normalized + 1) / 2);
  if (branch.direction === "DOWN") return clamp013((1 - normalized) / 2);
  if (branch.direction === "FLAT") return clamp013(1 - Math.abs(normalized));
  return clamp013(Math.abs(normalized));
};
var reviewMarketState = (branch, input) => {
  const alignment = scenarioDirectionAlignment(branch, input.multiTimeframe.directionalScore);
  const confidence = clamp013(input.multiTimeframe.confidence);
  const stance = alignment >= 0.62 ? "SUPPORT" : alignment <= 0.35 ? "CHALLENGE" : "MIXED";
  return {
    specialistId: "MARKET_STATE",
    scenarioId: branch.id,
    stance,
    confidence: round3(confidence),
    score: round3(alignment),
    reasons: [
      `Directional score ${Math.round(input.multiTimeframe.directionalScore)} with ${(confidence * 100).toFixed(0)}% multi-timeframe confidence.`,
      `Scenario-direction alignment ${(alignment * 100).toFixed(0)}%.`
    ],
    blindFirstPass: true
  };
};
var reviewEvidenceEvent = (branch, input) => {
  if (input.evidence.activeCount === 0) {
    return {
      specialistId: "EVIDENCE_EVENT",
      scenarioId: branch.id,
      stance: "INSUFFICIENT",
      confidence: 0,
      score: 0,
      reasons: ["No active structured external Evidence is available."],
      blindFirstPass: true
    };
  }
  const directional = input.evidence.score / 100;
  const alignment = branch.direction === "UP" ? clamp013((directional + 1) / 2) : branch.direction === "DOWN" ? clamp013((1 - directional) / 2) : branch.direction === "FLAT" ? clamp013(1 - Math.abs(directional)) : clamp013(input.evidence.contradictionCount / Math.max(1, input.evidence.activeCount));
  const contradictionPenalty = clamp013(input.evidence.contradictionCount / Math.max(1, input.evidence.activeCount));
  const score = clamp013(alignment * (1 - contradictionPenalty * 0.5));
  const stance = score >= 0.62 ? "SUPPORT" : score <= 0.35 ? "CHALLENGE" : "MIXED";
  return {
    specialistId: "EVIDENCE_EVENT",
    scenarioId: branch.id,
    stance,
    confidence: round3(clamp013(input.evidence.confidence * (1 - contradictionPenalty * 0.35))),
    score: round3(score),
    reasons: [
      `Evidence score ${Math.round(input.evidence.score)} from ${input.evidence.activeCount} active item(s).`,
      `${input.evidence.contradictionCount} contradiction link(s); contradiction pressure ${(contradictionPenalty * 100).toFixed(0)}%.`
    ],
    blindFirstPass: true
  };
};
var reviewLiquidityRegime = (branch, input) => {
  const eligibility = input.liquidity.eligible ? 1 : 0;
  const liquidityQuality = clamp013(input.liquidity.score / 100);
  const warningPenalty = input.liquidity.warning ? 0.25 : 0;
  const directionalLiquidity = clamp013(0.5 + input.liquidity.orderbookImbalance * 0.7 + input.liquidity.signedChangeRate * 5);
  let scenarioFit = branch.direction === "UP" ? directionalLiquidity : branch.direction === "DOWN" ? 1 - directionalLiquidity : branch.direction === "FLAT" ? 1 - Math.abs(directionalLiquidity - 0.5) * 2 : clamp013(input.multiTimeframe.frames.oneHour.indicators.atrPct / 0.04);
  scenarioFit = clamp013(scenarioFit);
  const score = clamp013(liquidityQuality * 0.55 + scenarioFit * 0.3 + eligibility * 0.15 - warningPenalty);
  const stance = !input.liquidity.eligible ? "CHALLENGE" : score >= 0.62 ? "SUPPORT" : score <= 0.35 ? "CHALLENGE" : "MIXED";
  return {
    specialistId: "LIQUIDITY_REGIME",
    scenarioId: branch.id,
    stance,
    confidence: round3(clamp013(liquidityQuality * 0.75 + 0.2)),
    score: round3(score),
    reasons: [
      `Liquidity ${input.liquidity.eligible ? "eligible" : "ineligible"}; score ${Math.round(input.liquidity.score)} and spread ${input.liquidity.spreadBps.toFixed(1)} bps.`,
      `Orderbook imbalance ${input.liquidity.orderbookImbalance.toFixed(3)}; signed change ${(input.liquidity.signedChangeRate * 100).toFixed(2)}%.`
    ],
    blindFirstPass: true
  };
};
var riskPressureFor = (branch, input) => {
  const volatility = clamp013(input.multiTimeframe.frames.oneHour.indicators.atrPct / 0.04);
  const contradictions = clamp013(input.evidence.contradictionCount / Math.max(1, input.evidence.activeCount));
  const liquidityRisk = input.liquidity.eligible ? input.liquidity.warning ? 0.45 : 0.15 : 1;
  const directionMismatch = 1 - scenarioDirectionAlignment(branch, input.multiTimeframe.directionalScore);
  const tailBias = branch.label === "TAIL" ? volatility : 0;
  return clamp013(volatility * 0.3 + contradictions * 0.2 + liquidityRisk * 0.25 + directionMismatch * 0.2 + tailBias * 0.05);
};
var reviewRiskExecution = (branch, input) => {
  const pressure = riskPressureFor(branch, input);
  const score = clamp013(1 - pressure);
  const stance = pressure >= 0.62 ? "CHALLENGE" : pressure <= 0.35 ? "SUPPORT" : "MIXED";
  return {
    specialistId: "RISK_EXECUTION",
    scenarioId: branch.id,
    stance,
    confidence: round3(clamp013(0.65 + Math.abs(pressure - 0.5) * 0.6)),
    score: round3(score),
    reasons: [
      `Deterministic risk-pressure proxy ${(pressure * 100).toFixed(0)}%.`,
      `ATR ${(input.multiTimeframe.frames.oneHour.indicators.atrPct * 100).toFixed(2)}%, liquidity ${input.liquidity.eligible ? "eligible" : "ineligible"}.`
    ],
    blindFirstPass: true
  };
};
var reviewFalsifier = (branch, input) => {
  const directionMismatch = 1 - scenarioDirectionAlignment(branch, input.multiTimeframe.directionalScore);
  const evidenceMismatch = branch.direction === "UP" ? clamp013((-input.evidence.score + 100) / 200) : branch.direction === "DOWN" ? clamp013((input.evidence.score + 100) / 200) : clamp013(Math.abs(input.evidence.score) / 100);
  const contradictionPressure = clamp013(input.evidence.contradictionCount / Math.max(1, input.evidence.activeCount));
  const confidenceWeakness = 1 - clamp013((input.evidence.confidence + input.multiTimeframe.confidence) / 2);
  const liquidityFailure = input.liquidity.eligible ? input.liquidity.warning ? 0.35 : 0 : 1;
  const falsificationPressure = clamp013(
    directionMismatch * 0.28 + evidenceMismatch * 0.28 + contradictionPressure * 0.2 + confidenceWeakness * 0.12 + liquidityFailure * 0.12
  );
  const stance = input.evidence.activeCount === 0 ? "INSUFFICIENT" : falsificationPressure >= 0.55 ? "CHALLENGE" : falsificationPressure <= 0.25 ? "SUPPORT" : "MIXED";
  const reasons = [
    `Falsification pressure ${(falsificationPressure * 100).toFixed(0)}% from direction, Evidence, contradictions, confidence and liquidity.`
  ];
  if (directionMismatch > 0.55) reasons.push("Scenario direction conflicts with current multi-timeframe structure.");
  if (evidenceMismatch > 0.55) reasons.push("Scenario direction is weakly supported or opposed by current structured Evidence.");
  if (contradictionPressure > 0.25) reasons.push("Evidence contradiction pressure is material.");
  if (!input.liquidity.eligible) reasons.push("Liquidity eligibility failure is an explicit invalidation condition.");
  return {
    specialistId: "FALSIFIER",
    scenarioId: branch.id,
    stance,
    confidence: round3(clamp013(0.7 + falsificationPressure * 0.25)),
    score: round3(1 - falsificationPressure),
    reasons,
    blindFirstPass: true
  };
};
var reviewScenario = (branch, input) => [
  reviewMarketState(branch, input),
  reviewEvidenceEvent(branch, input),
  reviewLiquidityRegime(branch, input),
  reviewRiskExecution(branch, input),
  reviewFalsifier(branch, input)
];
var dispositionFor2 = (rank, synthesisScore, confidence, dissentRatio, falsificationPressure, input) => {
  if (input.evidence.activeCount === 0) return "INSUFFICIENT";
  if (!input.liquidity.eligible) return "CHALLENGE";
  if (falsificationPressure >= 0.55) return "CHALLENGE";
  if (dissentRatio >= 0.5) return "CHALLENGE";
  if (rank === 1 && synthesisScore >= 0.58 && confidence >= 0.55) return "ADVANCE";
  if (synthesisScore < 0.38) return "CHALLENGE";
  return "MONITOR";
};
var buildCouncilV2Challenger = (input) => {
  const base = buildDeterministicGovernancePackage(input);
  const reviews = base.scenarios.branches.flatMap((branch) => reviewScenario(branch, input));
  const scored = base.scenarios.branches.map((branch) => {
    const branchReviews = reviews.filter((review) => review.scenarioId === branch.id);
    const nonFalsifier = branchReviews.filter((review) => review.specialistId !== "FALSIFIER");
    const falsifier = branchReviews.find((review) => review.specialistId === "FALSIFIER");
    const supportWeight = nonFalsifier.reduce((sum, review) => sum + (review.stance === "SUPPORT" ? review.confidence : 0), 0);
    const challengeWeight = nonFalsifier.reduce((sum, review) => sum + (review.stance === "CHALLENGE" || review.stance === "INSUFFICIENT" ? review.confidence : 0), 0);
    const totalOpinionWeight = nonFalsifier.reduce((sum, review) => sum + review.confidence, 0) || 1;
    const supportRatio = clamp013(supportWeight / totalOpinionWeight);
    const challengeRatio = clamp013(challengeWeight / totalOpinionWeight);
    const mixedRatio = clamp013(nonFalsifier.filter((review) => review.stance === "MIXED").reduce((sum, review) => sum + review.confidence, 0) / totalOpinionWeight);
    const dissentRatio = clamp013(challengeRatio + mixedRatio * 0.5);
    const specialistScore = nonFalsifier.reduce((sum, review) => sum + review.score * review.confidence, 0) / totalOpinionWeight;
    const baseRanking = base.council.rankings.find((ranking) => ranking.scenarioId === branch.id);
    const falsificationPressure = clamp013(1 - (falsifier?.score ?? 0));
    const synthesisScore = clamp013(
      (baseRanking?.consensusScore ?? branch.probability) * 0.45 + specialistScore * 0.35 + (1 - falsificationPressure) * 0.2
    );
    const confidence = clamp013(
      branchReviews.reduce((sum, review) => sum + review.confidence, 0) / Math.max(1, branchReviews.length) * (1 - dissentRatio * 0.2)
    );
    return {
      branch,
      branchReviews,
      synthesisScore,
      confidence,
      supportRatio,
      challengeRatio,
      dissentRatio,
      falsificationPressure
    };
  }).sort((left, right) => right.synthesisScore - left.synthesisScore || right.branch.probability - left.branch.probability || left.branch.id.localeCompare(right.branch.id));
  const assessments = scored.map((item, index) => {
    const rank = index + 1;
    const disposition = dispositionFor2(rank, item.synthesisScore, item.confidence, item.dissentRatio, item.falsificationPressure, input);
    const dissent = item.branchReviews.filter((review) => review.stance === "CHALLENGE" || review.stance === "INSUFFICIENT").map((review) => `${review.specialistId}: ${review.reasons[0]}`);
    const uncertainty = [
      ...item.dissentRatio >= 0.3 ? [`Specialist dissent ${(item.dissentRatio * 100).toFixed(0)}% remains unresolved.`] : [],
      ...item.falsificationPressure >= 0.35 ? [`Falsification pressure ${(item.falsificationPressure * 100).toFixed(0)}% remains material.`] : [],
      ...input.evidence.activeCount < 2 ? ["Evidence breadth is thin."] : [],
      ...input.evidence.contradictionCount > 0 ? ["Structured Evidence contains contradiction links."] : []
    ];
    return {
      scenarioId: item.branch.id,
      rank,
      synthesisScore: round3(item.synthesisScore),
      confidence: round3(item.confidence),
      supportRatio: round3(item.supportRatio),
      challengeRatio: round3(item.challengeRatio),
      dissentRatio: round3(item.dissentRatio),
      falsificationPressure: round3(item.falsificationPressure),
      disposition,
      preservedDissent: dissent.slice(0, 5),
      unresolvedUncertainty: uncertainty
    };
  });
  return {
    base,
    challenger: {
      protocolVersion: "COUNCIL-V2-CHALLENGER-0.1",
      market: input.market.toUpperCase(),
      generatedAt: input.now ?? Date.now(),
      recommendedScenarioId: assessments[0]?.scenarioId ?? null,
      assessments,
      specialistReviews: reviews,
      baseCouncilRunId: base.council.id,
      basePackageId: base.id,
      executionAuthority: false,
      promotionAuthority: false
    }
  };
};

// src/trading/evidenceForecast.ts
var clamp2 = (value, min, max) => Math.min(max, Math.max(min, value));
var round32 = (value) => Math.round(value * 1e3) / 1e3;
var buildEvidenceForecast = (aggregate) => {
  if (aggregate.activeCount === 0) {
    return {
      available: false,
      direction: "UNAVAILABLE",
      probabilityBullish: null,
      probabilityBearish: null,
      confidence: 0,
      uncertainty: 1,
      score: null,
      asOf: aggregate.asOf,
      evidenceIds: [],
      activeCount: 0,
      contradictionCount: 0,
      reasons: ["No active structured evidence is available, so no event forecast is asserted."]
    };
  }
  const contradictionRatio = aggregate.contradictionCount / Math.max(1, aggregate.activeCount);
  const contradictionPenalty = clamp2(1 - contradictionRatio * 0.35, 0.65, 1);
  const confidence = clamp2(aggregate.confidence * contradictionPenalty, 0, 0.95);
  const directionalSignal = clamp2(aggregate.score / 100, -1, 1);
  const probabilityBullish = clamp2(0.5 + directionalSignal * confidence * 0.5, 0.05, 0.95);
  const probabilityBearish = 1 - probabilityBullish;
  const direction = probabilityBullish >= 0.58 ? "BULLISH" : probabilityBullish <= 0.42 ? "BEARISH" : "NEUTRAL";
  const reasons = [
    `Evidence score ${aggregate.score} is shrunk toward 50/50 by confidence ${confidence.toFixed(2)}.`,
    `${aggregate.activeCount} active evidence item(s) support this forecast contract.`
  ];
  if (aggregate.contradictionCount > 0) {
    reasons.push(`${aggregate.contradictionCount} contradiction link(s) increase forecast uncertainty.`);
  }
  return {
    available: true,
    direction,
    probabilityBullish: round32(probabilityBullish),
    probabilityBearish: round32(probabilityBearish),
    confidence: round32(confidence),
    uncertainty: round32(1 - confidence),
    score: aggregate.score,
    asOf: aggregate.asOf,
    evidenceIds: aggregate.evidenceIds.slice(),
    activeCount: aggregate.activeCount,
    contradictionCount: aggregate.contradictionCount,
    reasons
  };
};

// src/trading/strategyRouter.ts
var actionMatches = (signal, target) => signal !== "WAIT" && signal === target;
var classifyForecastAlignment = (action, forecast) => {
  if (!forecast.available || forecast.direction === "UNAVAILABLE") return "UNAVAILABLE";
  if (forecast.direction === "NEUTRAL" || action === "WAIT") return "NEUTRAL";
  if (forecast.direction === "BULLISH" && action === "BUY") return "ALIGNED";
  if (forecast.direction === "BEARISH" && action === "SELL") return "ALIGNED";
  return "CONFLICT";
};
var buildStrategyRouterDecision = (multiTimeframe, forecast) => {
  const oneHour = multiTimeframe.frames.oneHour;
  const alignment = classifyForecastAlignment(multiTimeframe.action, forecast);
  const reasons = [];
  if (multiTimeframe.action === "WAIT") {
    return {
      route: "NO_TRADE",
      confidence: multiTimeframe.confidence,
      forecastAlignment: alignment,
      reasons: ["Multi-timeframe consensus is WAIT, matching the existing no-entry execution gate."]
    };
  }
  if (multiTimeframe.confidence < 0.62) {
    return {
      route: "NO_TRADE",
      confidence: multiTimeframe.confidence,
      forecastAlignment: alignment,
      reasons: ["Multi-timeframe confidence is below the existing 62% entry threshold."]
    };
  }
  if (oneHour.regime.regime === "RANGE") {
    if (actionMatches(oneHour.meanReversion.action, multiTimeframe.action) && oneHour.meanReversion.confidence >= 0.55) {
      reasons.push("Range regime and mean-reversion signal align with the multi-timeframe direction.");
      if (alignment === "CONFLICT") reasons.push("Evidence forecast conflicts with the technical route but does not bypass execution or risk gates.");
      return {
        route: "MEAN_REVERSION",
        confidence: Math.min(multiTimeframe.confidence, oneHour.meanReversion.confidence),
        forecastAlignment: alignment,
        reasons
      };
    }
    reasons.push("Range regime lacks a sufficiently aligned mean-reversion trigger, so the current fused signal remains blended.");
    if (alignment === "CONFLICT") reasons.push("Evidence forecast conflicts with the technical route but is recorded as uncertainty only.");
    return {
      route: "BLENDED",
      confidence: multiTimeframe.confidence,
      forecastAlignment: alignment,
      reasons
    };
  }
  const trendMatches = actionMatches(oneHour.trend.action, multiTimeframe.action);
  const momentumMatches = actionMatches(oneHour.momentum.action, multiTimeframe.action);
  if (trendMatches || momentumMatches) {
    reasons.push(`Regime ${oneHour.regime.regime} favors trend/momentum routing and at least one engine aligns with consensus.`);
    if (alignment === "CONFLICT") reasons.push("Evidence forecast conflict is preserved for audit and future routing calibration.");
    return {
      route: "TREND_MOMENTUM",
      confidence: multiTimeframe.confidence,
      forecastAlignment: alignment,
      reasons
    };
  }
  reasons.push("Consensus is actionable but no single regime-preferred engine dominates, so the fused route remains blended.");
  if (alignment === "CONFLICT") reasons.push("Evidence forecast conflict is preserved without changing order authority.");
  return {
    route: "BLENDED",
    confidence: multiTimeframe.confidence,
    forecastAlignment: alignment,
    reasons
  };
};

// src/trading/decisionTrace.ts
var classifyDecisionTraceAction = (executionAction, hasOpenPositionAfterStep) => {
  if (executionAction === "ENTER" || executionAction === "EXIT") return executionAction;
  return hasOpenPositionAfterStep ? "HOLD" : "NO_TRADE";
};
var stableFinalDecisionId = (input, timestamp) => {
  const base = `${input.market.toUpperCase()}|${timestamp}|${input.governance?.finalDecision.baseAction ?? input.decision.action}|${input.governance?.finalDecision.action ?? input.decision.action}`;
  let hash2 = 2166136261;
  for (let index = 0; index < base.length; index += 1) {
    hash2 ^= base.charCodeAt(index);
    hash2 = Math.imul(hash2, 16777619);
  }
  return `decision-${(hash2 >>> 0).toString(36)}`;
};
var buildDecisionTrace = (input) => {
  const { decision, multiTimeframe, evidence } = input;
  const timestamp = input.timestamp ?? Date.now();
  const action = classifyDecisionTraceAction(decision.action, input.hasOpenPositionAfterStep);
  const oneHourRegime = multiTimeframe.frames.oneHour.regime;
  const primaryReason = decision.reasons[0] ?? "No explicit decision reason was recorded.";
  const forecast = buildEvidenceForecast(evidence);
  const router = buildStrategyRouterDecision(multiTimeframe, forecast);
  const governance = input.governance ? {
    finalDecisionId: stableFinalDecisionId(input, timestamp),
    baseAction: input.governance.finalDecision.baseAction,
    mode: input.governance.finalDecision.mode,
    policy: input.governance.finalDecision.policy,
    intelligenceDisposition: input.governance.finalDecision.intelligenceDisposition,
    intelligenceConfidence: input.governance.finalDecision.intelligenceConfidence,
    intelligencePackageId: input.governance.intelligencePackageId ?? null,
    scenarioSetId: input.governance.scenarioSetId ?? null,
    recommendedScenarioId: input.governance.finalDecision.recommendedScenarioId,
    councilRunId: input.governance.councilRunId ?? null,
    reasons: input.governance.finalDecision.reasons.slice()
  } : void 0;
  return {
    timestamp,
    market: input.market.toUpperCase(),
    action,
    regime: oneHourRegime.regime,
    regimeConfidence: oneHourRegime.confidence,
    oracleTradeScore: multiTimeframe.oracleTradeScore,
    confidence: decision.confidence,
    strategyDisposition: router.route,
    router,
    riskDisposition: decision.riskDisposition,
    eventScore: evidence.activeCount > 0 ? evidence.score : null,
    forecast,
    evidenceActiveCount: evidence.activeCount,
    evidenceContradictionCount: evidence.contradictionCount,
    evidenceIds: evidence.evidenceIds.slice(),
    primaryReason,
    reasons: decision.reasons.slice(),
    riskReasons: decision.riskReasons.slice(),
    governance
  };
};

// src/trading/intelligencePipeline.ts
var clamp014 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
var normalizeBaseAction = (decision, hasOpenPositionBefore) => {
  if (decision.action === "ENTER") return "ENTER";
  if (decision.action === "EXIT") return "EXIT";
  return hasOpenPositionBefore ? "HOLD" : "NO_TRADE";
};
var findRecommendedRanking = (intelligence) => {
  const requested = intelligence.council.recommendedScenarioId;
  if (requested) {
    const match = intelligence.council.rankings.find((item) => item.scenarioId === requested);
    if (match) return match;
  }
  return [...intelligence.council.rankings].sort((a, b) => a.rank - b.rank)[0] ?? null;
};
var validateScenarioSet = (scenarioSet) => {
  if (scenarioSet.branches.length < 2) return false;
  const probabilitySum = scenarioSet.branches.reduce((sum, item) => sum + clamp014(item.probability), 0);
  return probabilitySum >= 0.9 && probabilitySum <= 1.1;
};
var assessIntelligence = (intelligence, now) => {
  if (!intelligence) {
    return {
      disposition: "INSUFFICIENT",
      fresh: false,
      confidence: 0,
      recommendedScenarioId: null,
      evidenceIds: [],
      reasons: ["No source-backed trading intelligence package is available."]
    };
  }
  const evidenceIds = Array.from(new Set(intelligence.evidenceIds || []));
  if (intelligence.expiresAt <= now || intelligence.impact.expiresAt <= now || intelligence.scenarios.expiresAt <= now || intelligence.council.expiresAt <= now) {
    return {
      disposition: "STALE",
      fresh: false,
      confidence: 0,
      recommendedScenarioId: intelligence.council.recommendedScenarioId,
      evidenceIds,
      reasons: ["The latest intelligence package or one of its components has expired."]
    };
  }
  if (!validateScenarioSet(intelligence.scenarios)) {
    return {
      disposition: "INSUFFICIENT",
      fresh: true,
      confidence: 0,
      recommendedScenarioId: intelligence.council.recommendedScenarioId,
      evidenceIds,
      reasons: ["Scenario set is incomplete or its probability mass is invalid."]
    };
  }
  if (intelligence.impact.disposition === "IRRELEVANT" || intelligence.impact.disposition === "INSUFFICIENT" || evidenceIds.length === 0) {
    return {
      disposition: "INSUFFICIENT",
      fresh: true,
      confidence: clamp014(intelligence.impact.confidence),
      recommendedScenarioId: intelligence.council.recommendedScenarioId,
      evidenceIds,
      reasons: ["Source-backed evidence is not sufficiently material for this asset."]
    };
  }
  const ranking = findRecommendedRanking(intelligence);
  if (!ranking) {
    return {
      disposition: "INSUFFICIENT",
      fresh: true,
      confidence: 0,
      recommendedScenarioId: null,
      evidenceIds,
      reasons: ["Council did not produce a comparable scenario ranking."]
    };
  }
  const confidence = clamp014((clamp014(intelligence.impact.confidence) + clamp014(ranking.confidence)) / 2);
  const reasons = [
    `Asset impact is ${intelligence.impact.disposition.toLowerCase()} with ${Math.round(intelligence.impact.confidence * 100)}% confidence.`,
    `Council ranks scenario ${ranking.scenarioId} #${ranking.rank} with ${ranking.disposition.toLowerCase()} disposition and ${Math.round(ranking.confidence * 100)}% confidence.`
  ];
  if (intelligence.impact.direction === "BEARISH") {
    return {
      disposition: "OPPOSED",
      fresh: true,
      confidence,
      recommendedScenarioId: ranking.scenarioId,
      evidenceIds,
      reasons: [...reasons, "Material source-backed impact is bearish for a long-only spot entry."]
    };
  }
  if (ranking.disposition === "CHALLENGE") {
    return {
      disposition: "OPPOSED",
      fresh: true,
      confidence,
      recommendedScenarioId: ranking.scenarioId,
      evidenceIds,
      reasons: [...reasons, "Council materially challenges the leading scenario."]
    };
  }
  if (ranking.disposition === "INSUFFICIENT" || confidence < 0.55) {
    return {
      disposition: "INSUFFICIENT",
      fresh: true,
      confidence,
      recommendedScenarioId: ranking.scenarioId,
      evidenceIds,
      reasons: [...reasons, "Council/intelligence confidence is below the deterministic 55% intelligence threshold."]
    };
  }
  if (ranking.disposition === "MONITOR" || intelligence.impact.direction === "MIXED" || intelligence.impact.disposition === "WATCH") {
    return {
      disposition: "CAUTION",
      fresh: true,
      confidence,
      recommendedScenarioId: ranking.scenarioId,
      evidenceIds,
      reasons: [...reasons, "Intelligence remains actionable only as cautionary context."]
    };
  }
  return {
    disposition: "SUPPORTED",
    fresh: true,
    confidence,
    recommendedScenarioId: ranking.scenarioId,
    evidenceIds,
    reasons: [...reasons, "Source-backed impact and Council review support the current long-entry thesis."]
  };
};
var buildFinalDecision = (input) => {
  const mode = input.mode ?? "OBSERVE_ONLY";
  const policy = input.policy ?? "BALANCED";
  const now = input.now ?? Date.now();
  const baseAction = normalizeBaseAction(input.executionDecision, input.hasOpenPositionBefore);
  const intelligence = assessIntelligence(input.intelligence, now);
  let proposedAction = baseAction;
  const reasons = [...input.executionDecision.reasons, ...intelligence.reasons];
  if (baseAction === "EXIT") {
    proposedAction = "EXIT";
    reasons.push("Existing deterministic exit authority overrides intelligence overlays.");
  } else if (baseAction === "ENTER") {
    const entrySupported = policy === "STRICT_CONSENSUS" ? intelligence.disposition === "SUPPORTED" : intelligence.disposition === "SUPPORTED" || intelligence.disposition === "CAUTION";
    if (entrySupported) {
      proposedAction = "ENTER";
      reasons.push(policy === "STRICT_CONSENSUS" ? "Strict consensus passed: fresh Evidence, Scenario Council, and deterministic Risk all support the entry." : "Deterministic technical/risk entry remains eligible after intelligence review.");
    } else {
      proposedAction = "NO_TRADE";
      reasons.push(`New entry is blocked by ${policy} intelligence policy with disposition ${intelligence.disposition}.`);
    }
  } else {
    proposedAction = baseAction;
    reasons.push("Intelligence cannot manufacture an ENTER or EXIT action absent a deterministic trading trigger.");
  }
  return {
    market: input.market.toUpperCase(),
    action: mode === "OBSERVE_ONLY" ? baseAction : proposedAction,
    proposedAction,
    baseAction,
    mode,
    policy,
    intelligenceDisposition: intelligence.disposition,
    intelligenceFresh: intelligence.fresh,
    intelligenceConfidence: intelligence.confidence,
    recommendedScenarioId: intelligence.recommendedScenarioId,
    evidenceIds: intelligence.evidenceIds,
    reasons,
    executionAuthority: "DETERMINISTIC_FINAL_DECISION_ENGINE"
  };
};

// src/trading/marketHistory.ts
var normalizeMarket = (market) => market.trim().toUpperCase();
var snapshotPriceMap = (snapshot) => {
  const map = /* @__PURE__ */ new Map();
  for (const [market, price] of snapshot.prices ?? []) {
    const normalized = normalizeMarket(market);
    if (!/^KRW-[A-Z0-9]+$/.test(normalized)) continue;
    if (!Number.isFinite(price) || price <= 0) continue;
    map.set(normalized, price);
  }
  return map;
};
var buildAlignedMarketReturnSeries = (snapshots, requestedMarkets, maxSnapshots = 192) => {
  const markets = [...new Set(requestedMarkets.map(normalizeMarket).filter((market) => /^KRW-[A-Z0-9]+$/.test(market)))];
  if (!markets.length) return [];
  const ordered = (snapshots ?? []).filter((snapshot) => Number.isFinite(snapshot?.timestamp) && snapshot.timestamp > 0 && Array.isArray(snapshot.prices)).sort((a, b) => a.timestamp - b.timestamp).slice(-Math.max(2, Math.min(512, Math.trunc(maxSnapshots) || 192)));
  const aligned = ordered.flatMap((snapshot) => {
    const prices = snapshotPriceMap(snapshot);
    if (!markets.every((market) => prices.has(market))) return [];
    return [{ timestamp: snapshot.timestamp, prices }];
  });
  if (aligned.length < 2) return markets.map((market) => ({ market, returns: [] }));
  const returnsByMarket = new Map(markets.map((market) => [market, []]));
  for (let index = 1; index < aligned.length; index += 1) {
    const previous = aligned[index - 1].prices;
    const current = aligned[index].prices;
    for (const market of markets) {
      const previousPrice = previous.get(market);
      const currentPrice = current.get(market);
      const value = currentPrice / previousPrice - 1;
      if (Number.isFinite(value) && value > -1 && value < 10) returnsByMarket.get(market).push(value);
    }
  }
  const commonLength = Math.min(...markets.map((market) => returnsByMarket.get(market).length));
  return markets.map((market) => ({
    market,
    returns: commonLength > 0 ? returnsByMarket.get(market).slice(-commonLength) : []
  }));
};

// src/trading/portfolioCorrelationRisk.ts
var correlation = (left, right) => {
  const count = Math.min(left.length, right.length);
  if (count < 2) return null;
  const x = left.slice(-count);
  const y = right.slice(-count);
  const meanX = x.reduce((sum, value) => sum + value, 0) / count;
  const meanY = y.reduce((sum, value) => sum + value, 0) / count;
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (let index = 0; index < count; index += 1) {
    const dx = x[index] - meanX;
    const dy = y[index] - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }
  if (varianceX <= 0 || varianceY <= 0) return null;
  return covariance / Math.sqrt(varianceX * varianceY);
};
var assessPortfolioCorrelationRisk = (input) => {
  const candidateMarket = input.candidateMarket.toUpperCase();
  const openMarkets = [...new Set(input.openMarkets.map((market) => market.toUpperCase()).filter((market) => market !== candidateMarket))].sort();
  const minReturnSamples = Math.max(12, Math.trunc(input.minReturnSamples ?? 24));
  const watchCorrelation = Math.min(0.95, Math.max(0.4, input.watchCorrelation ?? 0.7));
  const rejectCorrelation = Math.min(0.99, Math.max(watchCorrelation, input.rejectCorrelation ?? 0.82));
  const maxHighlyCorrelatedOpen = Math.max(1, Math.trunc(input.maxHighlyCorrelatedOpen ?? 1));
  if (!openMarkets.length) return { disposition: "PASS", candidateMarket, openMarkets, maxCorrelation: null, highlyCorrelatedMarkets: [], sampleReturns: 0, reasons: ["No existing different-market position creates correlation concurrency risk."] };
  const series = buildAlignedMarketReturnSeries(input.marketHistory, [candidateMarket, ...openMarkets], 384);
  const candidate = series.find((item) => item.market === candidateMarket);
  const sampleReturns = candidate?.returns.length ?? 0;
  if (!candidate || sampleReturns < minReturnSamples) {
    return {
      disposition: "INSUFFICIENT_DATA",
      candidateMarket,
      openMarkets,
      maxCorrelation: null,
      highlyCorrelatedMarkets: [],
      sampleReturns,
      reasons: [`Portfolio correlation requires at least ${minReturnSamples} aligned return samples before adding another concurrent crypto long.`]
    };
  }
  const pairs = openMarkets.flatMap((market) => {
    const existing = series.find((item) => item.market === market);
    if (!existing || existing.returns.length < minReturnSamples) return [];
    const value = correlation(candidate.returns, existing.returns);
    return value == null || !Number.isFinite(value) ? [] : [{ market, correlation: value }];
  });
  if (pairs.length !== openMarkets.length) {
    return { disposition: "INSUFFICIENT_DATA", candidateMarket, openMarkets, maxCorrelation: null, highlyCorrelatedMarkets: [], sampleReturns, reasons: ["Aligned return history is incomplete for at least one existing open market."] };
  }
  const maxCorrelation = Math.max(...pairs.map((item) => item.correlation));
  const highlyCorrelatedMarkets = pairs.filter((item) => item.correlation >= rejectCorrelation).map((item) => item.market);
  let disposition = "PASS";
  if (highlyCorrelatedMarkets.length > maxHighlyCorrelatedOpen) disposition = "REJECT";
  else if (maxCorrelation >= watchCorrelation) disposition = "WATCH";
  const reasons = [`Maximum aligned correlation to current open positions is ${maxCorrelation.toFixed(3)} over ${sampleReturns} return samples.`];
  if (disposition === "REJECT") reasons.push(`Candidate clusters with ${highlyCorrelatedMarkets.length} open market(s) above ${rejectCorrelation.toFixed(2)} correlation; concurrency limit is ${maxHighlyCorrelatedOpen}.`);
  else if (disposition === "WATCH") reasons.push("Correlation is elevated; the candidate may proceed only while other hard exposure limits remain satisfied.");
  else reasons.push("No material correlated-concurrency blocker was detected.");
  return { disposition, candidateMarket, openMarkets, maxCorrelation, highlyCorrelatedMarkets, sampleReturns, reasons };
};

// src/trading/config.ts
var TRADING_STRATEGY_VERSION = "BO-CRYPTO-v0.1.6";
var DEFAULT_RISK_LIMITS = {
  maxPositionPct: 0.02,
  maxDailyLossPct: 0.01,
  maxTotalDrawdownPct: 0.05,
  maxEstimatedSlippageBps: 30,
  maxMarketDataAgeMs: 9e4
};
var SUPPORTED_UPBIT_MINUTE_UNITS = [1, 3, 5, 10, 15, 30, 60, 240];

// src/trading/strategyGenome.ts
var uniqueSortedStrings = (items, upper = false) => [...new Set(items.map((item) => upper ? item.trim().toUpperCase() : item.trim()).filter(Boolean))].sort();
var round12 = (value) => Math.round(value * 1e12) / 1e12;
var normalizeWeights = (weights) => {
  const values = [weights.eventNews, weights.trendMomentum, weights.meanReversion];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Strategy Genome weights must be finite and non-negative.");
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) throw new Error("Strategy Genome requires at least one positive strategy weight.");
  return Object.freeze({ eventNews: round12(weights.eventNews / total), trendMomentum: round12(weights.trendMomentum / total), meanReversion: round12(weights.meanReversion / total) });
};
var validateThresholds = (thresholds) => {
  if (!Number.isFinite(thresholds.entryScore) || thresholds.entryScore < 0 || thresholds.entryScore > 100) throw new Error("Genome entryScore must be between 0 and 100.");
  if (!Number.isFinite(thresholds.exitScore) || thresholds.exitScore < 0 || thresholds.exitScore > 100) throw new Error("Genome exitScore must be between 0 and 100.");
  if (!Number.isFinite(thresholds.minConfidence) || thresholds.minConfidence < 0 || thresholds.minConfidence > 1) throw new Error("Genome minConfidence must be between 0 and 1.");
};
var validateRisk = (risk) => {
  const values = [risk.maxPositionPct, risk.maxDailyLossPct, risk.maxTotalDrawdownPct];
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error("Strategy Genome risk limits must be positive finite values.");
  if (risk.maxPositionPct > DEFAULT_RISK_LIMITS.maxPositionPct) throw new Error("Genome maxPositionPct cannot exceed the Black Oracle hard risk limit.");
  if (risk.maxDailyLossPct > DEFAULT_RISK_LIMITS.maxDailyLossPct) throw new Error("Genome maxDailyLossPct cannot exceed the Black Oracle hard risk limit.");
  if (risk.maxTotalDrawdownPct > DEFAULT_RISK_LIMITS.maxTotalDrawdownPct) throw new Error("Genome maxTotalDrawdownPct cannot exceed the Black Oracle hard risk limit.");
};
var normalizeStrategyGenome = (genome) => {
  if (!genome.id.trim()) throw new Error("Strategy Genome id is required.");
  if (!Number.isInteger(genome.generation) || genome.generation < 0) throw new Error("Strategy Genome generation must be a non-negative integer.");
  if (!Number.isFinite(genome.createdAt) || genome.createdAt <= 0) throw new Error("Strategy Genome createdAt must be a positive timestamp.");
  if (!genome.strategyVersion.trim()) throw new Error("Strategy Genome strategyVersion is required.");
  if (!genome.markets.length) throw new Error("Strategy Genome requires at least one market.");
  if (!genome.timeframesMinutes.length) throw new Error("Strategy Genome requires at least one timeframe.");
  if (genome.timeframesMinutes.some((value) => !Number.isInteger(value) || value <= 0)) throw new Error("Strategy Genome timeframes must be positive integer minutes.");
  validateThresholds(genome.thresholds);
  validateRisk(genome.risk);
  return Object.freeze({
    ...genome,
    id: genome.id.trim(),
    parentGenomeIds: Object.freeze(uniqueSortedStrings(genome.parentGenomeIds)),
    strategyVersion: genome.strategyVersion.trim(),
    modelVersion: genome.modelVersion?.trim() || null,
    markets: Object.freeze(uniqueSortedStrings(genome.markets, true)),
    regimes: Object.freeze(uniqueSortedStrings(genome.regimes, true)),
    timeframesMinutes: Object.freeze([...new Set(genome.timeframesMinutes)].sort((a, b) => a - b)),
    weights: normalizeWeights(genome.weights),
    thresholds: Object.freeze({ ...genome.thresholds }),
    risk: Object.freeze({ ...genome.risk }),
    mutations: Object.freeze(genome.mutations.map((mutation2) => Object.freeze({ ...mutation2, field: mutation2.field.trim() }))),
    executionAuthority: false
  });
};
var stableGenomePayload = (genome) => ({ strategyVersion: genome.strategyVersion, modelVersion: genome.modelVersion, markets: genome.markets, regimes: genome.regimes, timeframesMinutes: genome.timeframesMinutes, weights: genome.weights, thresholds: genome.thresholds, risk: genome.risk });
var fnv1a32 = (text) => {
  let hash2 = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash2 ^= text.charCodeAt(index);
    hash2 = Math.imul(hash2, 16777619) >>> 0;
  }
  return hash2 >>> 0;
};
var fingerprintStrategyGenome = (genome) => {
  const normalized = normalizeStrategyGenome(genome);
  const hash2 = fnv1a32(JSON.stringify(stableGenomePayload(normalized)));
  return `sg-${hash2.toString(16).padStart(8, "0")}`;
};

// src/trading/strategyFactory.ts
var clamp3 = (value, min, max) => Math.min(max, Math.max(min, value));
var round4 = (value, digits = 6) => Number(value.toFixed(digits));
var seeded = (seed) => {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967295;
  };
};
var hash = (text) => {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
};
var mutation = (type, field, from, to) => ({ type, field, from, to });
var generateStrategyCandidates = (parent, options = {}) => {
  const normalized = normalizeStrategyGenome(parent);
  const count = Math.max(2, Math.min(24, Math.trunc(options.count ?? 8)));
  const seed = Math.trunc(options.seed ?? 20260905);
  const random = seeded(seed);
  const createdAt = options.createdAt ?? Date.now();
  const nextGeneration = normalized.generation + 1;
  const candidates = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; candidates.length < count && index < count * 6; index += 1) {
    const weightShift = (random() - 0.5) * 0.18;
    const momentumShift = (random() - 0.5) * 0.16;
    const entryShift = Math.round((random() - 0.5) * 12);
    const confidenceShift = (random() - 0.5) * 0.08;
    const riskMultiplier = 0.7 + random() * 0.3;
    const rawWeights = {
      eventNews: Math.max(0.01, normalized.weights.eventNews + weightShift),
      trendMomentum: Math.max(0.01, normalized.weights.trendMomentum + momentumShift),
      meanReversion: Math.max(0.01, normalized.weights.meanReversion - weightShift - momentumShift)
    };
    const mutations = [
      mutation("WEIGHT", "eventNews", normalized.weights.eventNews, rawWeights.eventNews),
      mutation("WEIGHT", "trendMomentum", normalized.weights.trendMomentum, rawWeights.trendMomentum),
      mutation("THRESHOLD", "entryScore", normalized.thresholds.entryScore, clamp3(normalized.thresholds.entryScore + entryShift, 50, 90)),
      mutation("THRESHOLD", "minConfidence", normalized.thresholds.minConfidence, clamp3(normalized.thresholds.minConfidence + confidenceShift, 0.55, 0.85)),
      mutation("RISK", "maxPositionPct", normalized.risk.maxPositionPct, normalized.risk.maxPositionPct * riskMultiplier)
    ];
    const genome = normalizeStrategyGenome({
      ...normalized,
      id: `genome-g${nextGeneration}-${index + 1}-${hash(`${normalized.id}|${seed}|${index}`)}`,
      generation: nextGeneration,
      createdAt,
      parentGenomeIds: [normalized.id],
      weights: rawWeights,
      thresholds: {
        ...normalized.thresholds,
        entryScore: clamp3(normalized.thresholds.entryScore + entryShift, 50, 90),
        minConfidence: round4(clamp3(normalized.thresholds.minConfidence + confidenceShift, 0.55, 0.85))
      },
      risk: {
        maxPositionPct: round4(normalized.risk.maxPositionPct * riskMultiplier),
        maxDailyLossPct: normalized.risk.maxDailyLossPct,
        maxTotalDrawdownPct: normalized.risk.maxTotalDrawdownPct
      },
      mutations,
      executionAuthority: false
    });
    const fingerprint = fingerprintStrategyGenome(genome);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    candidates.push({ id: `candidate-${fingerprint}`, genome, fingerprint, state: "GENERATED", validation: null, tournamentScore: null, rejectionReasons: [], executionAuthority: false });
  }
  return {
    id: `factory-${hash(`${normalized.id}|${nextGeneration}|${seed}|${createdAt}`)}`,
    generation: nextGeneration,
    parentGenomeId: normalized.id,
    candidates,
    executionAuthority: false
  };
};

// src/trading/strategyReturnPanel.ts
var COHORT_CREATED_AT = Date.UTC(2026, 8, 6, 0, 0, 0);
var DEFAULT_CANDIDATE_COUNT = 8;
var DEFAULT_MAX_OBSERVATIONS = 5e3;
var DEFAULT_HORIZON_MS = 4 * 60 * 6e4;
var PBO_MIN_OBSERVATIONS = 60;
var clamp4 = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
var round5 = (value, digits = 8) => Number(value.toFixed(digits));
var signed = (action, score) => action === "BUY" ? score : action === "SELL" ? -score : 0;
var parentGenome = () => ({
  id: "bo-research-parent-v1",
  generation: 0,
  createdAt: COHORT_CREATED_AT,
  parentGenomeIds: [],
  strategyVersion: TRADING_STRATEGY_VERSION,
  modelVersion: null,
  // Scope is enforced by the PAPER loop's eligible KRW universe; this genome records the asset family rather than an execution allow-list.
  markets: ["KRW-SPOT-UNIVERSE"],
  regimes: ["STRONG_UPTREND", "UPTREND", "RANGE", "DOWNTREND", "STRONG_DOWNTREND"],
  timeframesMinutes: [15, 60, 240],
  weights: { eventNews: 0.15, trendMomentum: 0.7, meanReversion: 0.15 },
  thresholds: { entryScore: 62, exitScore: 45, minConfidence: 0.62 },
  risk: {
    maxPositionPct: DEFAULT_RISK_LIMITS.maxPositionPct,
    maxDailyLossPct: DEFAULT_RISK_LIMITS.maxDailyLossPct,
    maxTotalDrawdownPct: DEFAULT_RISK_LIMITS.maxTotalDrawdownPct
  },
  mutations: [],
  executionAuthority: false
});
var buildDefaultStrategyResearchCohort = () => {
  const parent = parentGenome();
  const generated = generateStrategyCandidates(parent, { count: DEFAULT_CANDIDATE_COUNT, seed: 20260906, createdAt: COHORT_CREATED_AT });
  const controlFingerprint = `control:${TRADING_STRATEGY_VERSION}`;
  return {
    id: `prospective-cohort:${TRADING_STRATEGY_VERSION}:g${generated.generation}`,
    evaluatorVersion: "PROSPECTIVE_GENOME_PROXY_V1",
    parent,
    candidates: [
      { id: "candidate-control-v1", fingerprint: controlFingerprint, genome: parent },
      ...generated.candidates.map((candidate) => ({ id: candidate.id, fingerprint: candidate.fingerprint, genome: candidate.genome }))
    ],
    createdAt: COHORT_CREATED_AT,
    executionAuthority: false,
    promotionAuthority: false
  };
};
var createStrategyReturnPanelCheckpoint = () => ({
  schemaVersion: 1,
  cohort: buildDefaultStrategyResearchCohort(),
  observations: []
});
var cloneObservation = (item) => ({
  ...item,
  predictions: item.predictions.map((prediction) => ({ ...prediction, reasons: prediction.reasons.slice(), executionAuthority: false })),
  outcomes: item.outcomes.map((outcome) => ({ ...outcome })),
  noLookahead: true,
  executionAuthority: false,
  promotionAuthority: false
});
var normalizeStrategyReturnPanel = (value) => {
  const fallback = createStrategyReturnPanelCheckpoint();
  const candidate = value;
  if (!candidate || candidate.schemaVersion !== 1 || !candidate.cohort || !Array.isArray(candidate.observations)) return fallback;
  const expectedIds = new Set(candidate.cohort.candidates?.map((item) => item.id) ?? []);
  if (expectedIds.size < 3) return fallback;
  const observations = candidate.observations.flatMap((item) => {
    if (!item || typeof item.id !== "string" || typeof item.market !== "string") return [];
    if (!Number.isFinite(item.generatedAt) || !Number.isFinite(item.targetTimestamp) || !Number.isFinite(item.anchorPrice) || item.anchorPrice <= 0) return [];
    if (!Array.isArray(item.predictions) || item.predictions.length !== expectedIds.size) return [];
    if (item.predictions.some((prediction) => !expectedIds.has(prediction?.candidateId))) return [];
    return [cloneObservation({
      ...item,
      market: String(item.market).toUpperCase(),
      resolvedAt: Number.isFinite(item.resolvedAt) ? Number(item.resolvedAt) : null,
      targetPrice: Number.isFinite(item.targetPrice) ? Number(item.targetPrice) : null,
      rawReturn: Number.isFinite(item.rawReturn) ? Number(item.rawReturn) : null,
      outcomes: Array.isArray(item.outcomes) ? item.outcomes.filter((outcome) => expectedIds.has(outcome?.candidateId) && Number.isFinite(outcome?.returnPct)).map((outcome) => ({ candidateId: String(outcome.candidateId), returnPct: Number(outcome.returnPct), favorable: Boolean(outcome.favorable) })) : [],
      noLookahead: true,
      executionAuthority: false,
      promotionAuthority: false
    })];
  }).sort((a, b) => a.generatedAt - b.generatedAt).slice(-DEFAULT_MAX_OBSERVATIONS);
  return {
    schemaVersion: 1,
    cohort: {
      ...candidate.cohort,
      candidates: candidate.cohort.candidates.map((item) => ({ ...item, genome: { ...item.genome, executionAuthority: false } })),
      executionAuthority: false,
      promotionAuthority: false
    },
    observations
  };
};
var evaluateGenome = (candidateId, fingerprint, genome, multiTimeframe, evidence, liquidity) => {
  const frame2 = multiTimeframe.frames.oneHour;
  const trendMomentum = clamp4((frame2.trend.directionalScore + frame2.momentum.directionalScore) / 2, -100, 100);
  const meanReversion = clamp4(signed(frame2.meanReversion.action, frame2.meanReversion.score), -100, 100);
  const event = evidence.activeCount > 0 ? clamp4(evidence.score, -100, 100) : 0;
  const weights = genome.weights;
  const directionalScore = clamp4(
    trendMomentum * weights.trendMomentum + meanReversion * weights.meanReversion + event * weights.eventNews,
    -100,
    100
  );
  const oracleTradeScore = clamp4((directionalScore + 100) / 2, 0, 100);
  const technicalConfidence = clamp4((frame2.trend.confidence + frame2.momentum.confidence) / 2, 0, 1);
  const confidence = clamp4(
    technicalConfidence * weights.trendMomentum + frame2.meanReversion.confidence * weights.meanReversion + (evidence.activeCount > 0 ? evidence.confidence : 0) * weights.eventNews,
    0,
    1
  );
  const reasons = [];
  if (evidence.activeCount === 0) reasons.push("Evidence gate blocks prospective entry for every research candidate.");
  if (!liquidity.eligible) reasons.push("Liquidity gate blocks prospective entry for every research candidate.");
  if (directionalScore < 25) reasons.push("Directional score is below the long-entry floor.");
  if (oracleTradeScore < genome.thresholds.entryScore) reasons.push(`Trade score ${oracleTradeScore.toFixed(1)} is below candidate threshold ${genome.thresholds.entryScore.toFixed(1)}.`);
  if (confidence < genome.thresholds.minConfidence) reasons.push(`Confidence ${confidence.toFixed(3)} is below candidate threshold ${genome.thresholds.minConfidence.toFixed(3)}.`);
  const action = evidence.activeCount > 0 && liquidity.eligible && directionalScore >= 25 && oracleTradeScore >= genome.thresholds.entryScore && confidence >= genome.thresholds.minConfidence ? "ENTER" : "NO_TRADE";
  if (action === "ENTER") reasons.push("Prospective research candidate clears score, confidence, Evidence and liquidity gates.");
  return {
    candidateId,
    fingerprint,
    action,
    directionalScore: round5(directionalScore),
    oracleTradeScore: round5(oracleTradeScore),
    confidence: round5(confidence),
    reasons,
    executionAuthority: false
  };
};
var createStrategyReturnObservation = (checkpoint, input) => {
  const normalized = normalizeStrategyReturnPanel(checkpoint);
  if (!Number.isFinite(input.anchorPrice) || input.anchorPrice <= 0 || !Number.isFinite(input.generatedAt) || input.generatedAt <= 0) return null;
  const horizonMs = Math.max(15 * 6e4, input.horizonMs ?? DEFAULT_HORIZON_MS);
  const predictions = normalized.cohort.candidates.map((candidate) => evaluateGenome(candidate.id, candidate.fingerprint, candidate.genome, input.multiTimeframe, input.evidence, input.liquidity));
  return {
    id: `${normalized.cohort.id}:${input.market.toUpperCase()}:${input.generatedAt}`,
    cohortId: normalized.cohort.id,
    market: input.market.toUpperCase(),
    generatedAt: input.generatedAt,
    targetTimestamp: input.generatedAt + horizonMs,
    anchorPrice: input.anchorPrice,
    predictions,
    resolvedAt: null,
    targetPrice: null,
    rawReturn: null,
    outcomes: [],
    noLookahead: true,
    executionAuthority: false,
    promotionAuthority: false
  };
};
var appendStrategyReturnObservation = (checkpoint, observation, maxObservations = DEFAULT_MAX_OBSERVATIONS) => {
  const normalized = normalizeStrategyReturnPanel(checkpoint);
  if (observation.cohortId !== normalized.cohort.id) return normalized;
  const observations = normalized.observations.filter((item) => item.id !== observation.id);
  observations.push(cloneObservation(observation));
  observations.sort((a, b) => a.generatedAt - b.generatedAt);
  return { ...normalized, observations: observations.slice(-Math.max(PBO_MIN_OBSERVATIONS, maxObservations)) };
};
var firstTarget2 = (history, market, timestamp) => {
  for (const snapshot of history) {
    if (snapshot.timestamp < timestamp) continue;
    const row = snapshot.prices.find(([candidate]) => candidate === market);
    if (row && Number.isFinite(row[1]) && row[1] > 0) return { timestamp: snapshot.timestamp, price: row[1] };
  }
  return null;
};
var resolveStrategyReturnPanel = (checkpoint, history) => {
  const normalized = normalizeStrategyReturnPanel(checkpoint);
  const orderedHistory = history.slice().sort((a, b) => a.timestamp - b.timestamp);
  const observations = normalized.observations.map((item) => {
    if (item.resolvedAt != null) return cloneObservation(item);
    const target = firstTarget2(orderedHistory, item.market, item.targetTimestamp);
    if (!target) return cloneObservation(item);
    const rawReturn = target.price / item.anchorPrice - 1;
    const outcomes = item.predictions.map((prediction) => {
      const returnPct = prediction.action === "ENTER" ? rawReturn : 0;
      return { candidateId: prediction.candidateId, returnPct: round5(returnPct), favorable: returnPct > 0 };
    });
    return {
      ...cloneObservation(item),
      resolvedAt: target.timestamp,
      targetPrice: target.price,
      rawReturn: round5(rawReturn),
      outcomes
    };
  });
  return { ...normalized, observations };
};
var buildAlignedStrategyReturnSeries = (checkpoint) => {
  const normalized = normalizeStrategyReturnPanel(checkpoint);
  const candidateIds = normalized.cohort.candidates.map((item) => item.id);
  const rows = normalized.observations.filter((item) => item.resolvedAt != null && item.outcomes.length === candidateIds.length && candidateIds.every((id) => item.outcomes.some((outcome) => outcome.candidateId === id)));
  return normalized.cohort.candidates.map((candidate) => ({
    id: candidate.id,
    fingerprint: candidate.fingerprint,
    returns: rows.map((row) => row.outcomes.find((outcome) => outcome.candidateId === candidate.id).returnPct)
  }));
};
var summarizeStrategyReturnPanel = (checkpoint) => {
  const normalized = normalizeStrategyReturnPanel(checkpoint);
  const series = buildAlignedStrategyReturnSeries(normalized);
  const alignedObservations = series.length ? Math.min(...series.map((item) => item.returns.length)) : 0;
  const resolved = normalized.observations.filter((item) => item.resolvedAt != null).length;
  return {
    cohortId: normalized.cohort.id,
    candidateCount: normalized.cohort.candidates.length,
    observations: normalized.observations.length,
    resolved,
    unresolved: normalized.observations.length - resolved,
    alignedObservations,
    pboEligible: normalized.cohort.candidates.length >= 3 && alignedObservations >= PBO_MIN_OBSERVATIONS,
    minimumPboObservations: PBO_MIN_OBSERVATIONS,
    evaluatorVersion: normalized.cohort.evaluatorVersion,
    executionAuthority: false,
    promotionAuthority: false
  };
};

// src/trading/tradeCase.ts
var frame = (snapshot) => ({ directionalScore: Number(snapshot?.fusion?.directionalScore ?? 0), confidence: Number(snapshot?.fusion?.confidence ?? 0), regime: String(snapshot?.regime?.regime ?? "UNKNOWN") });
var buildTradeCaseGovernanceSnapshot = (governance, finalDecisionId) => ({
  intelligencePackageId: governance.id,
  scenarioSetId: governance.scenarios.id,
  councilRunId: governance.council.id,
  finalDecisionId,
  generatedAt: governance.generatedAt,
  expiresAt: governance.expiresAt,
  recommendedScenarioId: governance.council.recommendedScenarioId,
  scenarios: governance.scenarios.branches.map((item) => ({ ...item, triggerConditions: item.triggerConditions.slice(), invalidationConditions: item.invalidationConditions.slice(), watchItems: item.watchItems.slice(), evidenceIds: item.evidenceIds.slice() })),
  councilRankings: governance.council.rankings.map((item) => ({ ...item, unresolvedUncertainty: item.unresolvedUncertainty.slice(), preservedDissent: item.preservedDissent.slice() })),
  lensReviews: governance.council.lensReviews.map((item) => ({ ...item, reasons: item.reasons.slice() }))
});
var buildTradeCaseRecord = (input) => {
  const governanceLinked = Boolean(input.trace.governance?.scenarioSetId && input.trace.governance?.councilRunId && input.governance);
  const evidenceLinked = input.trace.evidenceIds.length > 0 && input.trace.forecast.available;
  const auditClass = evidenceLinked && governanceLinked ? "COMPLETE" : evidenceLinked ? "INCOMPLETE" : "TECHNICAL_ONLY";
  const id = `tradecase-${input.market.toLowerCase()}-${input.fill.timestamp}`;
  const governanceSnapshot = input.governance ? buildTradeCaseGovernanceSnapshot(input.governance, input.trace.governance?.finalDecisionId ?? null) : null;
  return {
    id,
    market: input.market.toUpperCase(),
    status: "OPEN",
    auditClass,
    openedAt: input.fill.timestamp,
    closedAt: null,
    entry: {
      timestamp: input.fill.timestamp,
      referencePrice: input.fill.referencePrice,
      fillPrice: input.fill.fillPrice,
      notional: input.fill.notional,
      fee: input.fill.fee,
      slippageBps: input.fill.slippageBps,
      strategyVersion: input.fill.strategyVersion,
      multiTimeframe: {
        action: input.multiTimeframe.action,
        directionalScore: input.multiTimeframe.directionalScore,
        oracleTradeScore: input.multiTimeframe.oracleTradeScore,
        confidence: input.multiTimeframe.confidence,
        aligned: input.multiTimeframe.aligned,
        positionRiskMultiplier: input.multiTimeframe.positionRiskMultiplier,
        frames: { fourHour: frame(input.multiTimeframe.frames.fourHour), oneHour: frame(input.multiTimeframe.frames.oneHour), fifteenMinute: frame(input.multiTimeframe.frames.fifteenMinute) }
      },
      decision: {
        action: input.trace.action,
        regime: input.trace.regime,
        regimeConfidence: input.trace.regimeConfidence,
        route: input.trace.strategyDisposition,
        riskDisposition: input.trace.riskDisposition,
        eventScore: input.trace.eventScore,
        evidenceIds: input.trace.evidenceIds.slice(),
        evidenceActiveCount: input.trace.evidenceActiveCount,
        evidenceContradictionCount: input.trace.evidenceContradictionCount,
        forecast: { ...input.trace.forecast, evidenceIds: input.trace.forecast.evidenceIds.slice(), reasons: input.trace.forecast.reasons.slice() },
        primaryReason: input.trace.primaryReason,
        reasons: input.trace.reasons.slice(),
        riskReasons: input.trace.riskReasons.slice()
      }
    },
    latestDecision: { ...input.trace, evidenceIds: input.trace.evidenceIds.slice(), reasons: input.trace.reasons.slice(), riskReasons: input.trace.riskReasons.slice(), governance: input.trace.governance ? { ...input.trace.governance, reasons: input.trace.governance.reasons.slice() } : void 0 },
    decisionHistory: [{ ...input.trace, evidenceIds: input.trace.evidenceIds.slice(), reasons: input.trace.reasons.slice(), riskReasons: input.trace.riskReasons.slice(), governance: input.trace.governance ? { ...input.trace.governance, reasons: input.trace.governance.reasons.slice() } : void 0 }],
    intelligencePackageId: input.trace.governance?.intelligencePackageId ?? null,
    scenarioSetId: input.trace.governance?.scenarioSetId ?? null,
    councilRunId: input.trace.governance?.councilRunId ?? null,
    finalDecisionId: input.trace.governance?.finalDecisionId ?? null,
    governanceSnapshot,
    supervisionNotes: evidenceLinked && governanceLinked ? ["Entry passed structured Evidence, persisted Scenario/Council governance, and deterministic Risk before execution."] : ["Entry provenance is incomplete and must not qualify for live promotion."]
  };
};

// src/trading/validationLedger.ts
var key = (sample) => `${sample.market}|${sample.decisionTimestamp}|${sample.action}|${sample.targetTimestamp}`;
var eligibleForPromotionLedger = (sample) => sample.action === "ENTER" || sample.action === "EXIT";
var mergeValidationSamples = (existing, incoming, maxSamples = 1e4) => {
  const map = /* @__PURE__ */ new Map();
  for (const sample of [...existing ?? [], ...incoming ?? []]) {
    if (!sample?.market || !eligibleForPromotionLedger(sample) || !Number.isFinite(sample.decisionTimestamp) || !Number.isFinite(sample.targetTimestamp)) continue;
    map.set(key(sample), { ...sample });
  }
  return Array.from(map.values()).sort((a, b) => a.decisionTimestamp - b.decisionTimestamp || a.market.localeCompare(b.market)).slice(-Math.max(100, Math.min(5e4, Math.trunc(maxSamples) || 1e4)));
};

// src/trading/evidence.ts
var clamp5 = (value, min, max) => Math.min(max, Math.max(min, value));
var directionSign = (direction) => {
  if (direction === "BULLISH") return 1;
  if (direction === "BEARISH") return -1;
  return 0;
};
var validateTradingEvidence = (evidence) => {
  if (!evidence.id.trim()) throw new Error("Evidence id is required.");
  if (!/^KRW-[A-Z0-9]+$/.test(evidence.market)) throw new Error("Evidence market must be a normalized KRW market.");
  if (!evidence.title.trim()) throw new Error("Evidence title is required.");
  if (!Number.isFinite(evidence.strength) || evidence.strength < 0 || evidence.strength > 100) {
    throw new Error("Evidence strength must be between 0 and 100.");
  }
  if (!Number.isFinite(evidence.reliability) || evidence.reliability < 0 || evidence.reliability > 1) {
    throw new Error("Evidence reliability must be between 0 and 1.");
  }
  if (!Number.isFinite(evidence.observedAt) || !Number.isFinite(evidence.expiresAt) || evidence.expiresAt <= evidence.observedAt) {
    throw new Error("Evidence expiry must be later than observedAt.");
  }
  if (evidence.sourceUrl) {
    try {
      const url = new URL(evidence.sourceUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("invalid protocol");
    } catch {
      throw new Error("Evidence sourceUrl must be an absolute HTTP(S) URL.");
    }
  }
};
var aggregateTradingEvidence = (evidence, market, asOf = Date.now()) => {
  const normalized = market.toUpperCase();
  const active = evidence.filter(
    (item) => item.market === normalized && item.observedAt <= asOf && item.expiresAt > asOf
  );
  if (active.length === 0) {
    return {
      market: normalized,
      score: 0,
      confidence: 0,
      activeCount: 0,
      bullishWeight: 0,
      bearishWeight: 0,
      contradictionCount: 0,
      asOf,
      evidenceIds: [],
      reasons: ["No active structured trading evidence is available; technical weights should be redistributed."]
    };
  }
  const contradictedIds = new Set(active.map((item) => item.contradictionOf).filter((id) => Boolean(id)));
  let signedWeight = 0;
  let absoluteWeight = 0;
  let bullishWeight = 0;
  let bearishWeight = 0;
  for (const item of active) {
    const life = Math.max(1, item.expiresAt - item.observedAt);
    const remaining = clamp5((item.expiresAt - asOf) / life, 0, 1);
    const timeDecay = 0.2 + 0.8 * Math.sqrt(remaining);
    const contradictionPenalty = contradictedIds.has(item.id) ? 0.35 : 1;
    const weight = item.strength / 100 * item.reliability * timeDecay * contradictionPenalty;
    const sign = directionSign(item.direction);
    signedWeight += sign * weight;
    absoluteWeight += Math.abs(weight);
    if (sign > 0) bullishWeight += weight;
    if (sign < 0) bearishWeight += weight;
  }
  const score = absoluteWeight > 0 ? Math.round(clamp5(signedWeight / absoluteWeight * 100, -100, 100)) : 0;
  const coverage = clamp5(active.length / 5, 0, 1);
  const weightQuality = clamp5(absoluteWeight / Math.max(1, active.length * 0.65), 0, 1);
  const directionalClarity = absoluteWeight > 0 ? Math.abs(signedWeight) / absoluteWeight : 0;
  const confidence = clamp5(coverage * 0.35 + weightQuality * 0.35 + directionalClarity * 0.3, 0, 0.95);
  const contradictionCount = active.filter((item) => Boolean(item.contradictionOf)).length;
  const reasons = [
    `${active.length} active evidence item(s) aggregate to event score ${score}.`,
    `Bullish/bearish evidence weights are ${bullishWeight.toFixed(2)}/${bearishWeight.toFixed(2)} after reliability and expiry decay.`
  ];
  if (contradictionCount > 0) reasons.push(`${contradictionCount} contradiction link(s) suppress superseded evidence weight.`);
  return {
    market: normalized,
    score,
    confidence,
    activeCount: active.length,
    bullishWeight,
    bearishWeight,
    contradictionCount,
    asOf,
    evidenceIds: active.map((item) => item.id),
    reasons
  };
};
var TradingEvidenceStore = class {
  constructor() {
    this.items = /* @__PURE__ */ new Map();
  }
  upsert(evidence) {
    const normalized = {
      ...evidence,
      market: evidence.market.toUpperCase(),
      publisher: evidence.publisher?.trim() || void 0,
      sourceUrl: evidence.sourceUrl?.trim() || void 0,
      summary: evidence.summary?.trim() || void 0,
      tags: evidence.tags?.slice()
    };
    validateTradingEvidence(normalized);
    if (normalized.contradictionOf && normalized.contradictionOf === normalized.id) {
      throw new Error("Evidence cannot contradict itself.");
    }
    this.items.set(normalized.id, normalized);
    return { ...normalized, tags: normalized.tags?.slice() };
  }
  replaceAll(evidence) {
    if (!Array.isArray(evidence)) throw new Error("Evidence checkpoint must be an array.");
    this.items.clear();
    for (const item of evidence) this.upsert(item);
    return this.list(void 0, true);
  }
  remove(id) {
    return this.items.delete(id);
  }
  clear() {
    this.items.clear();
  }
  list(market, includeExpired = false, asOf = Date.now()) {
    const normalized = market?.toUpperCase();
    return Array.from(this.items.values()).filter((item) => (!normalized || item.market === normalized) && (includeExpired || item.expiresAt > asOf)).sort((a, b) => b.observedAt - a.observedAt).map((item) => ({ ...item, tags: item.tags?.slice() }));
  }
  aggregate(market, asOf = Date.now()) {
    return aggregateTradingEvidence(Array.from(this.items.values()), market, asOf);
  }
};

// server/trading/evidenceStore.ts
var tradingEvidenceStore = new TradingEvidenceStore();

// src/trading/risk.ts
var evaluateRisk = (input, limits = DEFAULT_RISK_LIMITS) => {
  const reasons = [];
  const maxAllowedNotional = Math.max(0, input.equity * limits.maxPositionPct);
  if (!Number.isFinite(input.equity) || input.equity <= 0) reasons.push("Account equity must be positive and finite.");
  if (!Number.isFinite(input.requestedNotional) || input.requestedNotional <= 0) reasons.push("Requested notional must be positive and finite.");
  if (input.requestedNotional > maxAllowedNotional) {
    reasons.push(`Requested position exceeds ${(limits.maxPositionPct * 100).toFixed(2)}% of account equity.`);
  }
  if (input.dailyPnlPct <= -limits.maxDailyLossPct) {
    reasons.push(`Daily loss limit of ${(limits.maxDailyLossPct * 100).toFixed(2)}% has been reached.`);
  }
  if (Math.max(0, input.totalDrawdownPct) >= limits.maxTotalDrawdownPct) {
    reasons.push(`Total drawdown limit of ${(limits.maxTotalDrawdownPct * 100).toFixed(2)}% has been reached.`);
  }
  if (!input.feedConnected) reasons.push("Market feed is disconnected.");
  if (input.marketDataAgeMs > limits.maxMarketDataAgeMs) reasons.push("Market data is stale.");
  if (!input.ledgerInSync) reasons.push("Internal ledger is not reconciled with the execution venue.");
  if (input.duplicateOrderDetected) reasons.push("Duplicate order fingerprint detected.");
  if (input.estimatedSlippageBps > limits.maxEstimatedSlippageBps) {
    reasons.push(`Estimated slippage exceeds ${limits.maxEstimatedSlippageBps} bps.`);
  }
  if (reasons.length > 0) {
    return {
      status: "REJECT",
      approvedNotional: 0,
      maxAllowedNotional,
      reasons
    };
  }
  return {
    status: "PASS",
    approvedNotional: input.requestedNotional,
    maxAllowedNotional,
    reasons: ["All deterministic risk gates passed."]
  };
};

// src/trading/executionPolicy.ts
var clamp6 = (value, min, max) => Math.min(max, Math.max(min, value));
var withoutRiskEvaluation = (decision) => ({
  ...decision,
  riskDisposition: "NOT_EVALUATED",
  riskReasons: []
});
var buildExecutionDecision = (input) => {
  const { liquidity, multiTimeframe, oneHour, portfolio, position } = input;
  const currentPrice = liquidity.tradePrice;
  if (position) {
    if (position.stopLossPrice && currentPrice <= position.stopLossPrice) {
      return withoutRiskEvaluation({
        action: "EXIT",
        side: "SELL",
        notional: currentPrice * position.quantity,
        quantity: position.quantity,
        confidence: 1,
        stopLossPrice: position.stopLossPrice,
        takeProfitPrice: position.takeProfitPrice,
        reasons: ["Protective stop-loss was reached."]
      });
    }
    if (position.takeProfitPrice && currentPrice >= position.takeProfitPrice) {
      return withoutRiskEvaluation({
        action: "EXIT",
        side: "SELL",
        notional: currentPrice * position.quantity,
        quantity: position.quantity,
        confidence: 1,
        stopLossPrice: position.stopLossPrice,
        takeProfitPrice: position.takeProfitPrice,
        reasons: ["Protective take-profit was reached."]
      });
    }
    if (multiTimeframe.action === "SELL" || multiTimeframe.directionalScore <= -20) {
      return withoutRiskEvaluation({
        action: "EXIT",
        side: "SELL",
        notional: currentPrice * position.quantity,
        quantity: position.quantity,
        confidence: multiTimeframe.confidence,
        stopLossPrice: position.stopLossPrice,
        takeProfitPrice: position.takeProfitPrice,
        reasons: ["Multi-timeframe direction reversed against the existing long spot position."]
      });
    }
    return withoutRiskEvaluation({
      action: "HOLD",
      side: null,
      notional: 0,
      quantity: 0,
      confidence: multiTimeframe.confidence,
      stopLossPrice: position.stopLossPrice,
      takeProfitPrice: position.takeProfitPrice,
      reasons: ["Existing position remains inside its protective levels and no exit signal is active."]
    });
  }
  if (input.newEntryAllowed === false) {
    const reasons = input.newEntryBlockReasons?.length ? input.newEntryBlockReasons.slice() : ["Paper portfolio open-position limit rejected a new entry."];
    return {
      action: "HOLD",
      side: null,
      notional: 0,
      quantity: 0,
      confidence: multiTimeframe.confidence,
      stopLossPrice: null,
      takeProfitPrice: null,
      riskDisposition: "REJECT",
      riskReasons: reasons,
      reasons: ["Portfolio-level deterministic risk policy rejected a new entry.", ...reasons]
    };
  }
  if (!liquidity.eligible) {
    return withoutRiskEvaluation({
      action: "HOLD",
      side: null,
      notional: 0,
      quantity: 0,
      confidence: 0,
      stopLossPrice: null,
      takeProfitPrice: null,
      reasons: ["Liquidity gate rejected this market.", ...liquidity.reasons]
    });
  }
  if (multiTimeframe.action !== "BUY" || multiTimeframe.confidence < 0.62) {
    return withoutRiskEvaluation({
      action: "HOLD",
      side: null,
      notional: 0,
      quantity: 0,
      confidence: multiTimeframe.confidence,
      stopLossPrice: null,
      takeProfitPrice: null,
      reasons: ["A new spot entry requires BUY consensus with at least 62% confidence."]
    });
  }
  const conviction = clamp6((multiTimeframe.directionalScore - 20) / 50, 0.35, 1);
  const requestedNotional = portfolio.equity * DEFAULT_RISK_LIMITS.maxPositionPct * conviction * multiTimeframe.positionRiskMultiplier;
  const estimatedSlippageBps = Math.max(8, liquidity.spreadBps / 2 + 5);
  const risk = evaluateRisk({
    equity: portfolio.equity,
    requestedNotional,
    dailyPnlPct: portfolio.dailyPnlPct,
    totalDrawdownPct: portfolio.drawdownPct,
    estimatedSlippageBps,
    marketDataAgeMs: input.marketDataAgeMs ?? 0,
    feedConnected: input.feedConnected ?? true,
    ledgerInSync: input.ledgerInSync ?? true,
    duplicateOrderDetected: input.duplicateOrderDetected ?? false
  });
  if (risk.status === "REJECT") {
    return {
      action: "HOLD",
      side: null,
      notional: 0,
      quantity: 0,
      confidence: multiTimeframe.confidence,
      stopLossPrice: null,
      takeProfitPrice: null,
      riskDisposition: "REJECT",
      riskReasons: risk.reasons.slice(),
      reasons: ["Deterministic risk gate rejected the candidate.", ...risk.reasons]
    };
  }
  const stopDistancePct = clamp6(oneHour.indicators.atrPct * 1.8, 0.012, 0.04);
  const stopLossPrice = currentPrice * (1 - stopDistancePct);
  const takeProfitPrice = currentPrice * (1 + stopDistancePct * 2);
  return {
    action: "ENTER",
    side: "BUY",
    notional: risk.approvedNotional,
    quantity: 0,
    confidence: multiTimeframe.confidence,
    stopLossPrice,
    takeProfitPrice,
    riskDisposition: "APPROVE",
    riskReasons: risk.reasons.slice(),
    reasons: ["Liquidity, multi-timeframe consensus, confidence, and deterministic risk gates all passed.", `Initial stop uses ${Math.round(stopDistancePct * 1e4)} bps; take-profit is set at 2R.`]
  };
};

// src/trading/ledger.ts
var cloneEvent = (event) => ({
  ...event,
  payload: { ...event.payload }
});
var TradingLedger = class _TradingLedger {
  constructor() {
    this.events = [];
  }
  static restore(events) {
    if (!Array.isArray(events)) throw new Error("Trading ledger checkpoint must be an array.");
    const ledger = new _TradingLedger();
    const ordered = events.slice().sort((a, b) => a.sequence - b.sequence);
    for (let index = 0; index < ordered.length; index += 1) {
      const event = ordered[index];
      if (!event || !event.id || !Number.isFinite(event.timestamp)) throw new Error("Trading ledger checkpoint contains an invalid event.");
      const restored = Object.freeze({
        ...cloneEvent(event),
        sequence: index + 1,
        payload: Object.freeze({ ...event.payload })
      });
      ledger.events.push(restored);
    }
    return ledger;
  }
  append(type, payload, strategyVersion = TRADING_STRATEGY_VERSION, timestamp = Date.now()) {
    const sequence = this.events.length + 1;
    const randomId = globalThis.crypto?.randomUUID?.() ?? `${timestamp}-${sequence}-${Math.random().toString(36).slice(2)}`;
    const event = Object.freeze({
      id: randomId,
      sequence,
      timestamp,
      type,
      strategyVersion,
      payload: Object.freeze({ ...payload })
    });
    this.events.push(event);
    return event;
  }
  snapshot() {
    return this.events.map(cloneEvent);
  }
  latest() {
    const event = this.events[this.events.length - 1];
    return event ? cloneEvent(event) : null;
  }
  get size() {
    return this.events.length;
  }
};

// src/trading/paperBroker.ts
var PaperBroker = class {
  constructor(options = {}) {
    this.processedOrderIds = /* @__PURE__ */ new Set();
    this.feeBps = options.feeBps ?? 5;
    this.slippageBps = options.slippageBps ?? 8;
  }
  restoreProcessedOrderIds(orderIds) {
    this.processedOrderIds.clear();
    for (const orderId of orderIds) {
      if (typeof orderId === "string" && orderId.trim()) this.processedOrderIds.add(orderId);
    }
  }
  processedOrderIdsSnapshot() {
    return Array.from(this.processedOrderIds);
  }
  executeMarketOrder(order) {
    if (this.processedOrderIds.has(order.id)) {
      throw new Error(`Duplicate paper order id: ${order.id}`);
    }
    if (order.referencePrice <= 0 || !Number.isFinite(order.referencePrice)) {
      throw new Error("Paper order reference price must be positive and finite.");
    }
    const hasNotional = Number.isFinite(order.notional) && order.notional > 0;
    const hasQuantity = Number.isFinite(order.quantity) && order.quantity > 0;
    if (!hasNotional && !hasQuantity) {
      throw new Error("Paper order requires a positive notional or quantity.");
    }
    if (order.side === "BUY" && !hasNotional) {
      throw new Error("Paper BUY orders require notional sizing in v0.1.");
    }
    const slippageRate = this.slippageBps / 1e4;
    const fillPrice = order.side === "BUY" ? order.referencePrice * (1 + slippageRate) : order.referencePrice * (1 - slippageRate);
    const quantity = hasQuantity ? order.quantity : order.notional / fillPrice;
    const notional = quantity * fillPrice;
    const fee = notional * (this.feeBps / 1e4);
    this.processedOrderIds.add(order.id);
    return {
      orderId: order.id,
      market: order.market,
      side: order.side,
      quantity,
      referencePrice: order.referencePrice,
      fillPrice,
      notional,
      fee,
      slippageBps: this.slippageBps,
      timestamp: order.timestamp,
      strategyVersion: order.strategyVersion
    };
  }
  hasProcessed(orderId) {
    return this.processedOrderIds.has(orderId);
  }
};

// src/trading/paperPortfolio.ts
var EQUITY_HEARTBEAT_MS = 6e4;
var assertFiniteNonNegative = (value, label) => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative.`);
};
var PaperPortfolio = class _PaperPortfolio {
  constructor(initialCash = 1e6) {
    this.realizedPnl = 0;
    this.feesPaid = 0;
    this.positions = /* @__PURE__ */ new Map();
    this.equityCurve = [];
    if (!Number.isFinite(initialCash) || initialCash <= 0) throw new Error("Initial paper cash must be positive and finite.");
    this.cash = initialCash;
    this.initialEquity = initialCash;
    this.dailyStartEquity = initialCash;
    this.peakEquity = initialCash;
  }
  static restore(state) {
    if (!state || !Number.isFinite(state.initialEquity) || state.initialEquity <= 0) {
      throw new Error("Paper portfolio checkpoint initialEquity is invalid.");
    }
    assertFiniteNonNegative(state.cash, "Paper portfolio checkpoint cash");
    assertFiniteNonNegative(state.dailyStartEquity, "Paper portfolio checkpoint dailyStartEquity");
    assertFiniteNonNegative(state.feesPaid, "Paper portfolio checkpoint feesPaid");
    assertFiniteNonNegative(state.peakEquity, "Paper portfolio checkpoint peakEquity");
    if (!Number.isFinite(state.realizedPnl)) throw new Error("Paper portfolio checkpoint realizedPnl must be finite.");
    if (!Array.isArray(state.positions) || !Array.isArray(state.equityCurve)) {
      throw new Error("Paper portfolio checkpoint arrays are invalid.");
    }
    const portfolio = new _PaperPortfolio(state.initialEquity);
    portfolio.cash = state.cash;
    portfolio.dailyStartEquity = state.dailyStartEquity;
    portfolio.realizedPnl = state.realizedPnl;
    portfolio.feesPaid = state.feesPaid;
    portfolio.peakEquity = Math.max(state.initialEquity, state.peakEquity);
    for (const position of state.positions) {
      if (!/^KRW-[A-Z0-9]+$/.test(position.market)) throw new Error(`Invalid restored paper market: ${position.market}`);
      if (!Number.isFinite(position.quantity) || position.quantity <= 0) throw new Error("Restored paper position quantity must be positive.");
      portfolio.positions.set(position.market, { ...position });
    }
    const restoredCurve = state.equityCurve.slice(-2e3).map((point) => {
      if (!Number.isFinite(point.timestamp) || !Number.isFinite(point.equity) || point.equity < 0) {
        throw new Error("Restored equity curve contains an invalid point.");
      }
      return { ...point };
    }).sort((a, b) => a.timestamp - b.timestamp);
    for (const point of restoredCurve) {
      const lastPoint = portfolio.equityCurve[portfolio.equityCurve.length - 1];
      if (lastPoint?.timestamp === point.timestamp) {
        lastPoint.equity = point.equity;
      } else {
        portfolio.equityCurve.push(point);
      }
    }
    return portfolio;
  }
  exportState() {
    return {
      initialEquity: this.initialEquity,
      cash: this.cash,
      dailyStartEquity: this.dailyStartEquity,
      realizedPnl: this.realizedPnl,
      feesPaid: this.feesPaid,
      peakEquity: this.peakEquity,
      positions: Array.from(this.positions.values()).map((position) => ({ ...position })),
      equityCurve: this.equityCurve.slice()
    };
  }
  applyFill(fill) {
    const existing = this.positions.get(fill.market);
    if (fill.side === "BUY") {
      const totalDebit = fill.notional + fill.fee;
      if (totalDebit > this.cash + 1e-9) throw new Error("Paper portfolio has insufficient cash for this buy fill.");
      if (existing) throw new Error("Paper v0.1 does not pyramid into an existing position.");
      this.cash -= totalDebit;
      this.feesPaid += fill.fee;
      const position = {
        market: fill.market,
        quantity: fill.quantity,
        averageCost: totalDebit / fill.quantity,
        entryPrice: fill.fillPrice,
        openedAt: fill.timestamp,
        updatedAt: fill.timestamp,
        stopLossPrice: null,
        takeProfitPrice: null
      };
      this.positions.set(fill.market, position);
      return { ...position };
    }
    if (!existing) throw new Error("Paper v0.1 cannot sell without an existing spot position.");
    if (fill.quantity > existing.quantity + 1e-10) throw new Error("Paper sell quantity exceeds the current spot position.");
    const proceedsAfterFee = fill.notional - fill.fee;
    const costBasisReleased = existing.averageCost * fill.quantity;
    this.realizedPnl += proceedsAfterFee - costBasisReleased;
    this.cash += proceedsAfterFee;
    this.feesPaid += fill.fee;
    const remainingQuantity = Math.max(0, existing.quantity - fill.quantity);
    if (remainingQuantity <= 1e-10) {
      this.positions.delete(fill.market);
      return null;
    }
    const updated = {
      ...existing,
      quantity: remainingQuantity,
      updatedAt: fill.timestamp
    };
    this.positions.set(fill.market, updated);
    return { ...updated };
  }
  setProtection(market, stopLossPrice, takeProfitPrice, timestamp = Date.now()) {
    const position = this.positions.get(market);
    if (!position) throw new Error(`No paper position exists for ${market}.`);
    if (!(stopLossPrice > 0 && takeProfitPrice > stopLossPrice)) throw new Error("Protection prices are invalid.");
    this.positions.set(market, {
      ...position,
      stopLossPrice,
      takeProfitPrice,
      updatedAt: timestamp
    });
  }
  getPosition(market) {
    const position = this.positions.get(market);
    return position ? { ...position } : null;
  }
  snapshot(markPrices = {}, timestamp = Date.now()) {
    let marketValue = 0;
    let unrealizedPnl = 0;
    const positions = Array.from(this.positions.values()).map((position) => {
      const markPrice = markPrices[position.market] ?? position.entryPrice;
      const value = position.quantity * markPrice;
      marketValue += value;
      unrealizedPnl += value - position.quantity * position.averageCost;
      return { ...position, markPrice, marketValue: value, unrealizedPnl: value - position.quantity * position.averageCost };
    });
    const equity = this.cash + marketValue;
    this.peakEquity = Math.max(this.peakEquity, equity);
    const drawdownPct = this.peakEquity > 0 ? Math.max(0, (this.peakEquity - equity) / this.peakEquity) : 0;
    const dailyPnlPct = this.dailyStartEquity > 0 ? (equity - this.dailyStartEquity) / this.dailyStartEquity : 0;
    const lastPoint = this.equityCurve[this.equityCurve.length - 1];
    const normalizedTimestamp = lastPoint ? Math.max(timestamp, lastPoint.timestamp) : timestamp;
    const equityChanged = !lastPoint || Math.abs(lastPoint.equity - equity) > 1e-9;
    const heartbeatDue = !lastPoint || normalizedTimestamp - lastPoint.timestamp >= EQUITY_HEARTBEAT_MS;
    if (!lastPoint) {
      this.equityCurve.push({ timestamp: normalizedTimestamp, equity });
    } else if (normalizedTimestamp === lastPoint.timestamp) {
      if (equityChanged) lastPoint.equity = equity;
    } else if (equityChanged || heartbeatDue) {
      this.equityCurve.push({ timestamp: normalizedTimestamp, equity });
      if (this.equityCurve.length > 2e3) this.equityCurve.splice(0, this.equityCurve.length - 2e3);
    }
    return {
      initialEquity: this.initialEquity,
      cash: this.cash,
      equity,
      marketValue,
      realizedPnl: this.realizedPnl,
      unrealizedPnl,
      totalPnl: equity - this.initialEquity,
      feesPaid: this.feesPaid,
      peakEquity: this.peakEquity,
      drawdownPct,
      dailyPnlPct,
      positions,
      equityCurve: this.equityCurve.slice()
    };
  }
  resetDailyBaseline(markPrices = {}, timestamp = Date.now()) {
    this.dailyStartEquity = this.snapshot(markPrices, timestamp).equity;
  }
};

// src/trading/performance.ts
var bucketDefinitions = [
  { label: "50-59", minScore: 50, maxScore: 59 },
  { label: "60-69", minScore: 60, maxScore: 69 },
  { label: "70-79", minScore: 70, maxScore: 79 },
  { label: "80-89", minScore: 80, maxScore: 89 },
  { label: "90-100", minScore: 90, maxScore: 100 }
];
var safeAverage = (values) => values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
var calculateMaxDrawdown = (equityCurve) => {
  let peak = 0;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    peak = Math.max(peak, point.equity);
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - point.equity) / peak);
  }
  return maxDrawdown;
};
var buildPaperPerformance = (trades, equityCurve, initialEquity, currentEquity, currentDrawdownPct) => {
  const wins = trades.filter((trade) => trade.netPnl > 1e-9);
  const losses = trades.filter((trade) => trade.netPnl < -1e-9);
  const breakeven = trades.length - wins.length - losses.length;
  const grossProfit = wins.reduce((sum, trade) => sum + trade.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.netPnl, 0));
  const netPnl = trades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const avgWin = safeAverage(wins.map((trade) => trade.netPnl));
  const avgLoss = Math.abs(safeAverage(losses.map((trade) => trade.netPnl)));
  const buckets = bucketDefinitions.map((definition) => {
    const bucketTrades = trades.filter(
      (trade) => trade.entryOracleTradeScore >= definition.minScore && trade.entryOracleTradeScore <= definition.maxScore
    );
    const bucketWins = bucketTrades.filter((trade) => trade.netPnl > 0);
    return {
      ...definition,
      trades: bucketTrades.length,
      wins: bucketWins.length,
      winRate: bucketTrades.length > 0 ? bucketWins.length / bucketTrades.length : 0,
      avgReturnPct: safeAverage(bucketTrades.map((trade) => trade.returnPct)),
      netPnl: bucketTrades.reduce((sum, trade) => sum + trade.netPnl, 0)
    };
  });
  return {
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    winRate: trades.length > 0 ? wins.length / trades.length : 0,
    grossProfit,
    grossLoss,
    netPnl,
    expectancy: trades.length > 0 ? netPnl / trades.length : 0,
    avgWin,
    avgLoss,
    payoffRatio: avgLoss > 0 ? avgWin / avgLoss : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
    avgReturnPct: safeAverage(trades.map((trade) => trade.returnPct)),
    totalReturnPct: initialEquity > 0 ? (currentEquity - initialEquity) / initialEquity : 0,
    maxDrawdownPct: calculateMaxDrawdown(equityCurve),
    currentDrawdownPct,
    buckets
  };
};

// src/trading/multiTimeframe.ts
var clamp7 = (value, min, max) => Math.min(max, Math.max(min, value));
var buildMultiTimeframeConsensus = (fourHour, oneHour, fifteenMinute) => {
  const weights = { fourHour: 0.45, oneHour: 0.35, fifteenMinute: 0.2 };
  const directionalScore = Math.round(
    fourHour.fusion.directionalScore * weights.fourHour + oneHour.fusion.directionalScore * weights.oneHour + fifteenMinute.fusion.directionalScore * weights.fifteenMinute
  );
  const oracleTradeScore = Math.round(clamp7((directionalScore + 100) / 2, 0, 100));
  const weightedConfidence = fourHour.fusion.confidence * weights.fourHour + oneHour.fusion.confidence * weights.oneHour + fifteenMinute.fusion.confidence * weights.fifteenMinute;
  const signs = [fourHour.fusion.directionalScore, oneHour.fusion.directionalScore, fifteenMinute.fusion.directionalScore].map((score) => Math.abs(score) < 15 ? 0 : Math.sign(score));
  const nonZero = signs.filter((sign) => sign !== 0);
  const aligned = nonZero.length >= 2 && nonZero.every((sign) => sign === nonZero[0]);
  const oppositeHigherTimeframe = directionalScore > 0 ? fourHour.fusion.directionalScore <= -15 || oneHour.fusion.directionalScore <= -15 : directionalScore < 0 ? fourHour.fusion.directionalScore >= 15 || oneHour.fusion.directionalScore >= 15 : false;
  const confidence = clamp7(
    weightedConfidence + (aligned ? 0.08 : 0) - (oppositeHigherTimeframe ? 0.16 : 0),
    0,
    0.95
  );
  const action = directionalScore >= 25 && !oppositeHigherTimeframe ? "BUY" : directionalScore <= -25 && !oppositeHigherTimeframe ? "SELL" : "WAIT";
  const baseRiskMultiplier = Math.min(
    fourHour.fusion.positionRiskMultiplier,
    oneHour.fusion.positionRiskMultiplier,
    fifteenMinute.fusion.positionRiskMultiplier
  );
  const positionRiskMultiplier = clamp7(
    baseRiskMultiplier * (aligned ? 1 : 0.75) * (oppositeHigherTimeframe ? 0.5 : 1),
    0.25,
    1
  );
  const reasons = [
    `4H/1H/15M directional scores: ${fourHour.fusion.directionalScore}/${oneHour.fusion.directionalScore}/${fifteenMinute.fusion.directionalScore}.`,
    "Consensus weights are 45% / 35% / 20%, giving higher timeframes most of the authority."
  ];
  if (aligned) reasons.push("At least two meaningful timeframe signals are directionally aligned.");
  if (oppositeHigherTimeframe) reasons.push("A higher timeframe opposes the aggregate direction, so new entries are blocked.");
  return {
    market: oneHour.market,
    asOf: Math.max(fourHour.asOf, oneHour.asOf, fifteenMinute.asOf),
    action,
    directionalScore,
    oracleTradeScore,
    confidence,
    aligned,
    positionRiskMultiplier,
    frames: {
      fourHour,
      oneHour,
      fifteenMinute
    },
    reasons
  };
};

// src/trading/indicators.ts
var clamp8 = (value, min, max) => Math.min(max, Math.max(min, value));
var mean2 = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
var standardDeviation = (values) => {
  const avg = mean2(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};
var emaSeries = (values, period) => {
  if (period <= 0) throw new Error("EMA period must be positive.");
  if (values.length < period) throw new Error(`EMA${period} requires at least ${period} values.`);
  const result = Array(values.length).fill(Number.NaN);
  const seed = mean2(values.slice(0, period));
  result[period - 1] = seed;
  const multiplier = 2 / (period + 1);
  let previous = seed;
  for (let index = period; index < values.length; index += 1) {
    previous = (values[index] - previous) * multiplier + previous;
    result[index] = previous;
  }
  return result;
};
var emaLatest = (values, period) => {
  const series = emaSeries(values, period);
  return series[series.length - 1];
};
var rsiSeries = (values, period = 14) => {
  if (values.length < period + 1) throw new Error(`RSI${period} requires at least ${period + 1} values.`);
  const result = Array(values.length).fill(Number.NaN);
  let gainSum = 0;
  let lossSum = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    gainSum += Math.max(change, 0);
    lossSum += Math.max(-change, 0);
  }
  let averageGain = gainSum / period;
  let averageLoss = lossSum / period;
  result[period] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    result[index] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }
  return result;
};
var rsiLatest = (values, period = 14) => {
  const series = rsiSeries(values, period);
  return series[series.length - 1];
};
var stochRsiLatest = (values, rsiPeriod = 14, stochPeriod = 14) => {
  const series = rsiSeries(values, rsiPeriod).filter(Number.isFinite);
  if (series.length < stochPeriod) {
    throw new Error(`Stoch RSI requires at least ${rsiPeriod + stochPeriod} price observations.`);
  }
  const window = series.slice(-stochPeriod);
  const current = window[window.length - 1];
  const lowest = Math.min(...window);
  const highest = Math.max(...window);
  if (highest === lowest) return 50;
  return clamp8((current - lowest) / (highest - lowest) * 100, 0, 100);
};
var atrLatest = (candles, period = 14) => {
  if (candles.length < period + 1) throw new Error(`ATR${period} requires at least ${period + 1} candles.`);
  const trueRanges = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const previousClose = candles[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });
  let value = mean2(trueRanges.slice(0, period));
  for (let index = period; index < trueRanges.length; index += 1) {
    value = (value * (period - 1) + trueRanges[index]) / period;
  }
  return value;
};
var bollingerLatest = (values, period = 20, deviations = 2) => {
  if (values.length < period) throw new Error(`Bollinger Bands require at least ${period} values.`);
  const window = values.slice(-period);
  const middle = mean2(window);
  const deviation = standardDeviation(window);
  const upper = middle + deviations * deviation;
  const lower = middle - deviations * deviation;
  const width = upper - lower;
  const close = values[values.length - 1];
  return {
    middle,
    upper,
    lower,
    percentB: width === 0 ? 0.5 : (close - lower) / width,
    bandwidth: middle === 0 ? 0 : width / middle
  };
};
var macdLatest = (values, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  if (values.length < slowPeriod + signalPeriod) {
    throw new Error(`MACD requires at least ${slowPeriod + signalPeriod} values.`);
  }
  const fast = emaSeries(values, fastPeriod);
  const slow = emaSeries(values, slowPeriod);
  const macdValues = [];
  for (let index = 0; index < values.length; index += 1) {
    if (Number.isFinite(fast[index]) && Number.isFinite(slow[index])) {
      macdValues.push(fast[index] - slow[index]);
    }
  }
  const signalSeries = emaSeries(macdValues, signalPeriod);
  const macd = macdValues[macdValues.length - 1];
  const signal = signalSeries[signalSeries.length - 1];
  return { macd, signal, histogram: macd - signal };
};
var rateOfChangeLatest = (values, period = 20) => {
  if (values.length < period + 1) throw new Error(`ROC${period} requires at least ${period + 1} values.`);
  const previous = values[values.length - 1 - period];
  const current = values[values.length - 1];
  return previous === 0 ? 0 : current / previous - 1;
};
var zScoreLatest = (values, period = 20) => {
  if (values.length < period) throw new Error(`Z-score requires at least ${period} values.`);
  const window = values.slice(-period);
  const avg = mean2(window);
  const deviation = standardDeviation(window);
  return deviation === 0 ? 0 : (window[window.length - 1] - avg) / deviation;
};
var buildIndicatorSnapshot = (candles) => {
  if (candles.length < 200) throw new Error("Trading indicators require at least 200 candles.");
  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const close = closes[closes.length - 1];
  const atr14 = atrLatest(candles, 14);
  const bollinger = bollingerLatest(closes, 20, 2);
  const macd = macdLatest(closes);
  return {
    close,
    ema20: emaLatest(closes, 20),
    ema50: emaLatest(closes, 50),
    ema200: emaLatest(closes, 200),
    rsi14: rsiLatest(closes, 14),
    stochRsi14: stochRsiLatest(closes, 14, 14),
    atr14,
    atrPct: close === 0 ? 0 : atr14 / close,
    macd: macd.macd,
    macdSignal: macd.signal,
    macdHistogram: macd.histogram,
    roc20: rateOfChangeLatest(closes, 20),
    bollingerMiddle: bollinger.middle,
    bollingerUpper: bollinger.upper,
    bollingerLower: bollinger.lower,
    bollingerPercentB: bollinger.percentB,
    bollingerBandwidth: bollinger.bandwidth,
    volumeZScore: zScoreLatest(volumes, 20)
  };
};

// src/trading/meanReversion.ts
var clamp015 = (value) => Math.min(1, Math.max(0, value));
var overboughtComponents = (indicators) => ({
  rsi: clamp015((indicators.rsi14 - 60) / 20),
  stochRsi: clamp015((indicators.stochRsi14 - 70) / 30),
  bollinger: clamp015((indicators.bollingerPercentB - 0.85) / 0.3)
});
var oversoldComponents = (indicators) => ({
  rsi: clamp015((40 - indicators.rsi14) / 20),
  stochRsi: clamp015((30 - indicators.stochRsi14) / 30),
  bollinger: clamp015((0.15 - indicators.bollingerPercentB) / 0.3)
});
var weightedExtreme = (components) => components.rsi * 0.4 + components.stochRsi * 0.3 + components.bollinger * 0.3;
var trendPenaltyFor = (side, regime) => {
  if (side === "OVERBOUGHT") {
    if (regime === "STRONG_UPTREND") return 0.45;
    if (regime === "UPTREND") return 0.7;
  }
  if (side === "OVERSOLD") {
    if (regime === "STRONG_DOWNTREND") return 0.45;
    if (regime === "DOWNTREND") return 0.7;
  }
  return regime === "RANGE" ? 1 : 0.9;
};
var buildMeanReversionSignal = (indicators, regime) => {
  const overbought = weightedExtreme(overboughtComponents(indicators));
  const oversold = weightedExtreme(oversoldComponents(indicators));
  const side = overbought > oversold ? "OVERBOUGHT" : "OVERSOLD";
  const extreme = Math.max(overbought, oversold);
  const reasons = [];
  if (extreme < 0.45) {
    return {
      action: "WAIT",
      state: "NEUTRAL",
      score: Math.round(extreme * 100),
      confidence: 0.5,
      rawExtremeScore: Math.round(extreme * 100),
      trendPenalty: 1,
      reasons: ["RSI, Stoch RSI, and Bollinger position do not form a strong price-extreme cluster."]
    };
  }
  const trendPenalty = trendPenaltyFor(side, regime.regime);
  const reversalConfirmed = side === "OVERBOUGHT" && indicators.macdHistogram < 0 || side === "OVERSOLD" && indicators.macdHistogram > 0;
  const volumeExhaustion = indicators.volumeZScore < -0.5;
  const confirmationBoost = (reversalConfirmed ? 0.12 : 0) + (volumeExhaustion ? 0.06 : 0);
  const adjusted = clamp015(extreme * trendPenalty * (1 + confirmationBoost));
  if (side === "OVERBOUGHT") {
    reasons.push(`RSI ${indicators.rsi14.toFixed(1)}, Stoch RSI ${indicators.stochRsi14.toFixed(1)}, and Bollinger %B ${indicators.bollingerPercentB.toFixed(2)} indicate upside extension.`);
  } else {
    reasons.push(`RSI ${indicators.rsi14.toFixed(1)}, Stoch RSI ${indicators.stochRsi14.toFixed(1)}, and Bollinger %B ${indicators.bollingerPercentB.toFixed(2)} indicate downside extension.`);
  }
  if (trendPenalty < 1) {
    reasons.push(`Mean-reversion score is discounted because the ${regime.regime} regime can keep an extreme condition extended.`);
  }
  if (reversalConfirmed) reasons.push("MACD histogram provides reversal-direction confirmation.");
  if (volumeExhaustion) reasons.push("Below-normal volume adds a mild exhaustion confirmation.");
  const strongContinuationConflict = side === "OVERBOUGHT" && regime.regime === "STRONG_UPTREND" || side === "OVERSOLD" && regime.regime === "STRONG_DOWNTREND";
  const actionable = adjusted >= 0.6 && (!strongContinuationConflict || reversalConfirmed);
  const action = actionable ? side === "OVERSOLD" ? "BUY" : "SELL" : "WAIT";
  if (strongContinuationConflict && !reversalConfirmed) {
    reasons.push("Extreme reading is informational only; no reversal trade is allowed without confirmation against the strong trend.");
  }
  return {
    action,
    state: side,
    score: Math.round(adjusted * 100),
    confidence: clamp015(0.45 + adjusted * 0.4 + (reversalConfirmed ? 0.08 : 0) - (regime.highVolatility ? 0.08 : 0)),
    rawExtremeScore: Math.round(extreme * 100),
    trendPenalty,
    reasons
  };
};

// src/trading/regime.ts
var clamp016 = (value) => Math.min(1, Math.max(0, value));
var classifyRegime = (indicators) => {
  const {
    close,
    ema20,
    ema50,
    ema200,
    atr14,
    atrPct,
    macdHistogram,
    bollingerBandwidth
  } = indicators;
  const atrUnit = Math.max(atr14, close * 1e-3);
  const shortSpread = Math.abs(ema20 - ema50) / atrUnit;
  const longSpread = Math.abs(ema50 - ema200) / atrUnit;
  const trendStrength = clamp016((shortSpread * 0.65 + longSpread * 0.35) / 3);
  const bullishStack = close > ema20 && ema20 > ema50 && ema50 > ema200;
  const bearishStack = close < ema20 && ema20 < ema50 && ema50 < ema200;
  const highVolatility = atrPct >= 0.025 || bollingerBandwidth >= 0.12;
  const reasons = [];
  let regime;
  if (bullishStack && trendStrength >= 0.55 && macdHistogram >= 0) {
    regime = "STRONG_UPTREND";
    reasons.push("Price and EMA 20/50/200 are fully bullish-aligned.");
    reasons.push("EMA separation is large relative to ATR and MACD momentum is positive.");
  } else if (bearishStack && trendStrength >= 0.55 && macdHistogram <= 0) {
    regime = "STRONG_DOWNTREND";
    reasons.push("Price and EMA 20/50/200 are fully bearish-aligned.");
    reasons.push("EMA separation is large relative to ATR and MACD momentum is negative.");
  } else if (ema20 > ema50 && close > ema50) {
    regime = "UPTREND";
    reasons.push("Short EMA is above medium EMA and price remains above EMA50.");
  } else if (ema20 < ema50 && close < ema50) {
    regime = "DOWNTREND";
    reasons.push("Short EMA is below medium EMA and price remains below EMA50.");
  } else {
    regime = "RANGE";
    reasons.push("EMA structure is mixed or price is crossing the medium trend.");
  }
  if (highVolatility) reasons.push("ATR or Bollinger bandwidth indicates elevated volatility.");
  const structuralConfidence = regime === "RANGE" ? 0.58 : 0.62 + trendStrength * 0.3;
  const confidence = clamp016(structuralConfidence - (highVolatility ? 0.08 : 0));
  return {
    regime,
    confidence,
    trendStrength,
    highVolatility,
    reasons
  };
};

// src/trading/signalFusion.ts
var clamp9 = (value, min, max) => Math.min(max, Math.max(min, value));
var baseWeightsForRegime = (regime) => {
  switch (regime) {
    case "STRONG_UPTREND":
    case "STRONG_DOWNTREND":
      return { trend: 0.45, momentum: 0.35, meanReversion: 0.1, event: 0.1 };
    case "UPTREND":
    case "DOWNTREND":
      return { trend: 0.4, momentum: 0.3, meanReversion: 0.15, event: 0.15 };
    case "RANGE":
    default:
      return { trend: 0.15, momentum: 0.2, meanReversion: 0.45, event: 0.2 };
  }
};
var redistributeMissingEventWeight = (weights) => {
  const technicalTotal = weights.trend + weights.momentum + weights.meanReversion;
  if (technicalTotal <= 0) return { trend: 1 / 3, momentum: 1 / 3, meanReversion: 1 / 3, event: 0 };
  return {
    trend: weights.trend + weights.event * (weights.trend / technicalTotal),
    momentum: weights.momentum + weights.event * (weights.momentum / technicalTotal),
    meanReversion: weights.meanReversion + weights.event * (weights.meanReversion / technicalTotal),
    event: 0
  };
};
var meanReversionDirectionalScore = (signal) => {
  if (signal.action === "BUY") return signal.score;
  if (signal.action === "SELL") return -signal.score;
  return 0;
};
var buildSignalFusion = (trend, momentum, meanReversion, regime, eventScore) => {
  const hasEventScore = Number.isFinite(eventScore);
  const baseWeights = baseWeightsForRegime(regime.regime);
  const weights = hasEventScore ? baseWeights : redistributeMissingEventWeight(baseWeights);
  const normalizedEventScore = hasEventScore ? clamp9(eventScore, -100, 100) : 0;
  const reversionDirectional = meanReversionDirectionalScore(meanReversion);
  const rawDirectional = trend.directionalScore * weights.trend + momentum.directionalScore * weights.momentum + reversionDirectional * weights.meanReversion + normalizedEventScore * weights.event;
  const directionalScore = Math.round(clamp9(rawDirectional, -100, 100));
  const oracleTradeScore = Math.round(clamp9((directionalScore + 100) / 2, 0, 100));
  const action = directionalScore >= 25 ? "BUY" : directionalScore <= -25 ? "SELL" : "WAIT";
  const componentSigns = [trend.directionalScore, momentum.directionalScore, reversionDirectional, normalizedEventScore].filter((value, index) => index < 3 || hasEventScore).filter((value) => Math.abs(value) >= 20).map((value) => Math.sign(value));
  const hasConflict = componentSigns.includes(1) && componentSigns.includes(-1);
  const averageComponentConfidence = trend.confidence * weights.trend + momentum.confidence * weights.momentum + meanReversion.confidence * weights.meanReversion + (hasEventScore ? 0.65 * weights.event : 0);
  const confidence = clamp9(
    averageComponentConfidence + Math.abs(directionalScore) / 300 - (hasConflict ? 0.12 : 0) - (regime.highVolatility ? 0.08 : 0),
    0,
    0.95
  );
  const positionRiskMultiplier = regime.highVolatility ? 0.5 : hasConflict ? 0.75 : 1;
  const reasons = [
    `Regime ${regime.regime} sets trend/momentum/mean-reversion/event weights to ${Math.round(weights.trend * 100)}/${Math.round(weights.momentum * 100)}/${Math.round(weights.meanReversion * 100)}/${Math.round(weights.event * 100)}.`,
    hasEventScore ? "Structured event evidence participates in the score." : "Event weight is redistributed across technical engines until structured event evidence is available."
  ];
  if (hasConflict) reasons.push("Directional disagreement across engines reduces confidence and risk budget.");
  if (regime.highVolatility) reasons.push("High volatility halves the downstream position-risk multiplier.");
  return {
    action,
    directionalScore,
    oracleTradeScore,
    confidence,
    positionRiskMultiplier,
    weights,
    components: {
      trend: trend.directionalScore,
      momentum: momentum.directionalScore,
      meanReversion: reversionDirectional,
      event: normalizedEventScore
    },
    reasons
  };
};

// src/trading/trendMomentum.ts
var clamp10 = (value, min, max) => Math.min(max, Math.max(min, value));
var actionFromDirectionalScore = (score) => {
  if (score >= 25) return "BUY";
  if (score <= -25) return "SELL";
  return "WAIT";
};
var buildTrendSignal = (indicators, regime) => {
  let score = 0;
  const reasons = [];
  score += indicators.close >= indicators.ema20 ? 15 : -15;
  score += indicators.ema20 >= indicators.ema50 ? 25 : -25;
  score += indicators.ema50 >= indicators.ema200 ? 30 : -30;
  score += indicators.close >= indicators.ema200 ? 15 : -15;
  const regimeDirection = regime.regime === "STRONG_UPTREND" ? 1 : regime.regime === "UPTREND" ? 0.6 : regime.regime === "STRONG_DOWNTREND" ? -1 : regime.regime === "DOWNTREND" ? -0.6 : 0;
  score += regimeDirection * 15 * Math.max(0.4, regime.trendStrength);
  score = Math.round(clamp10(score, -100, 100));
  if (indicators.ema20 > indicators.ema50 && indicators.ema50 > indicators.ema200) {
    reasons.push("EMA 20/50/200 structure is bullish-aligned.");
  } else if (indicators.ema20 < indicators.ema50 && indicators.ema50 < indicators.ema200) {
    reasons.push("EMA 20/50/200 structure is bearish-aligned.");
  } else {
    reasons.push("EMA structure is mixed, reducing directional trend conviction.");
  }
  reasons.push(`Regime classifier reports ${regime.regime} with ${(regime.confidence * 100).toFixed(0)}% confidence.`);
  return {
    action: actionFromDirectionalScore(score),
    directionalScore: score,
    strength: Math.abs(score),
    confidence: clamp10(0.45 + Math.abs(score) / 200 - (regime.highVolatility ? 0.08 : 0), 0, 1),
    reasons
  };
};
var buildMomentumSignal = (indicators) => {
  let score = 0;
  const reasons = [];
  const rsiImpulse = clamp10((indicators.rsi14 - 50) / 20, -1, 1);
  const macdImpulse = indicators.atr14 > 0 ? clamp10(indicators.macdHistogram / indicators.atr14, -1, 1) : 0;
  const rocImpulse = clamp10(indicators.roc20 / 0.08, -1, 1);
  const volumeConfirmation = clamp10(indicators.volumeZScore / 3, -1, 1);
  score = Math.round(clamp10(
    rsiImpulse * 25 + macdImpulse * 30 + rocImpulse * 35 + volumeConfirmation * 10,
    -100,
    100
  ));
  if (Math.abs(indicators.roc20) >= 0.02) {
    reasons.push(`20-period rate of change is ${(indicators.roc20 * 100).toFixed(2)}%.`);
  }
  if (Math.abs(indicators.macdHistogram) > 0) {
    reasons.push(`MACD histogram is ${indicators.macdHistogram > 0 ? "positive" : "negative"}.`);
  }
  if (indicators.rsi14 >= 55 || indicators.rsi14 <= 45) {
    reasons.push(`RSI ${indicators.rsi14.toFixed(1)} confirms ${indicators.rsi14 >= 55 ? "positive" : "negative"} momentum bias.`);
  }
  if (Math.abs(indicators.volumeZScore) >= 1) {
    reasons.push(`Volume is ${indicators.volumeZScore.toFixed(2)} standard deviations from its recent mean.`);
  }
  if (reasons.length === 0) reasons.push("Momentum inputs are close to neutral.");
  return {
    action: actionFromDirectionalScore(score),
    directionalScore: score,
    strength: Math.abs(score),
    confidence: clamp10(0.45 + Math.abs(score) / 180, 0, 0.95),
    reasons
  };
};

// src/trading/snapshot.ts
var buildTradingSnapshot = (candles, eventScore) => {
  if (candles.length === 0) throw new Error("At least one candle is required.");
  const ordered = candles.slice().sort((a, b) => a.timestamp - b.timestamp);
  const latest = ordered[ordered.length - 1];
  const indicators = buildIndicatorSnapshot(ordered);
  const regime = classifyRegime(indicators);
  const trend = buildTrendSignal(indicators, regime);
  const momentum = buildMomentumSignal(indicators);
  const meanReversion = buildMeanReversionSignal(indicators, regime);
  const fusion = buildSignalFusion(trend, momentum, meanReversion, regime, eventScore);
  return {
    market: latest.market,
    timeframeMinutes: latest.timeframeMinutes,
    candleCount: ordered.length,
    asOf: latest.timestamp,
    indicators,
    regime,
    trend,
    momentum,
    meanReversion,
    fusion
  };
};

// server/trading/upbitPublic.ts
var UPBIT_API_BASE = "https://api.upbit.com";
var getJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Black-Oracle-Trading/0.1"
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Upbit public API ${response.status}: ${body.slice(0, 240)}`);
  }
  return response.json();
};
var assertKrwMarket = (market) => {
  if (!/^KRW-[A-Z0-9]+$/.test(market)) throw new Error("Only normalized KRW Upbit markets are allowed in v0.1.");
};
var listKrwMarkets = async () => {
  const url = new URL("/v1/market/all", UPBIT_API_BASE);
  url.searchParams.set("is_details", "true");
  const markets = await getJson(url);
  return markets.filter((item) => item.market.startsWith("KRW-")).map((item) => ({
    market: item.market,
    koreanName: item.korean_name,
    englishName: item.english_name,
    warning: Boolean(item.market_event?.warning),
    caution: item.market_event?.caution ?? {}
  }));
};
var getKrwTickers = async () => {
  const url = new URL("/v1/ticker/all", UPBIT_API_BASE);
  url.searchParams.set("quote_currencies", "KRW");
  const tickers = await getJson(url);
  return tickers.map((ticker) => ({
    market: ticker.market,
    tradePrice: ticker.trade_price,
    signedChangeRate: ticker.signed_change_rate,
    accTradePrice24h: ticker.acc_trade_price_24h,
    accTradeVolume24h: ticker.acc_trade_volume_24h,
    timestamp: ticker.timestamp
  }));
};
var getOrderbooks = async (markets) => {
  const normalized = [...new Set(markets.map((market) => market.toUpperCase()))];
  if (normalized.length === 0) return [];
  if (normalized.length > 30) throw new Error("Orderbook batch is limited to 30 markets in Black Oracle v0.1.");
  normalized.forEach(assertKrwMarket);
  const url = new URL("/v1/orderbook", UPBIT_API_BASE);
  url.searchParams.set("markets", normalized.join(","));
  const orderbooks = await getJson(url);
  return orderbooks.map((book) => ({
    market: book.market,
    timestamp: book.timestamp,
    totalAskSize: book.total_ask_size,
    totalBidSize: book.total_bid_size,
    units: book.orderbook_units.map((unit) => ({
      askPrice: unit.ask_price,
      bidPrice: unit.bid_price,
      askSize: unit.ask_size,
      bidSize: unit.bid_size
    }))
  }));
};
var getMinuteCandles = async (market, unit, count = 200) => {
  assertKrwMarket(market);
  if (!SUPPORTED_UPBIT_MINUTE_UNITS.includes(unit)) throw new Error(`Unsupported Upbit minute unit: ${unit}`);
  if (!Number.isInteger(count) || count < 1 || count > 200) throw new Error("Candle count must be an integer between 1 and 200.");
  const url = new URL(`/v1/candles/minutes/${unit}`, UPBIT_API_BASE);
  url.searchParams.set("market", market);
  url.searchParams.set("count", String(count));
  const raw = await getJson(url);
  return raw.map((candle) => ({
    market: candle.market,
    timeframeMinutes: candle.unit,
    timestamp: Date.parse(`${candle.candle_date_time_utc}Z`),
    open: candle.opening_price,
    high: candle.high_price,
    low: candle.low_price,
    close: candle.trade_price,
    volume: candle.candle_acc_trade_volume,
    quoteVolume: candle.candle_acc_trade_price
  })).sort((a, b) => a.timestamp - b.timestamp);
};

// server/trading/multiTimeframe.ts
var buildMarketMultiTimeframe = async (market, eventScore) => {
  const normalized = market.toUpperCase();
  const [fourHourCandles, oneHourCandles, fifteenMinuteCandles] = await Promise.all([
    getMinuteCandles(normalized, 240, 200),
    getMinuteCandles(normalized, 60, 200),
    getMinuteCandles(normalized, 15, 200)
  ]);
  const fourHour = buildTradingSnapshot(fourHourCandles, eventScore);
  const oneHour = buildTradingSnapshot(oneHourCandles, eventScore);
  const fifteenMinute = buildTradingSnapshot(fifteenMinuteCandles, eventScore);
  return buildMultiTimeframeConsensus(fourHour, oneHour, fifteenMinute);
};

// src/trading/liquidity.ts
var clamp017 = (value) => Math.min(1, Math.max(0, value));
var safeLog10 = (value) => Math.log10(Math.max(value, 1));
var evaluateLiquidity = (input) => {
  const mid = (input.bestAsk + input.bestBid) / 2;
  const spreadBps = mid > 0 ? (input.bestAsk - input.bestBid) / mid * 1e4 : Number.POSITIVE_INFINITY;
  const minTop5DepthKrw = Math.min(input.top5BidDepthKrw, input.top5AskDepthKrw);
  const totalTop5Depth = input.top5BidDepthKrw + input.top5AskDepthKrw;
  const orderbookImbalance = totalTop5Depth > 0 ? (input.top5BidDepthKrw - input.top5AskDepthKrw) / totalTop5Depth : 0;
  const volumeScore = clamp017((safeLog10(input.accTradePrice24h) - 9) / 3) * 100;
  const spreadScore = clamp017(1 - spreadBps / 25) * 100;
  const depthScore = clamp017((safeLog10(minTop5DepthKrw) - safeLog10(5e6)) / 2.3) * 100;
  const score = Math.round(volumeScore * 0.45 + spreadScore * 0.35 + depthScore * 0.2);
  const reasons = [];
  if (input.warning) reasons.push("Market is flagged with an exchange warning/caution state.");
  if (input.accTradePrice24h < 1e9) reasons.push("24h KRW turnover is below the 1B KRW v0.1 floor.");
  if (spreadBps > 25) reasons.push("Best bid/ask spread exceeds the 25 bps v0.1 ceiling.");
  if (minTop5DepthKrw < 5e6) reasons.push("Top-5 orderbook depth is below the 5M KRW v0.1 floor.");
  const eligible = reasons.length === 0;
  if (eligible) reasons.push("Turnover, spread, depth, and warning filters all passed.");
  return {
    market: input.market,
    tradePrice: input.tradePrice,
    accTradePrice24h: input.accTradePrice24h,
    signedChangeRate: input.signedChangeRate,
    spreadBps,
    top5BidDepthKrw: input.top5BidDepthKrw,
    top5AskDepthKrw: input.top5AskDepthKrw,
    orderbookImbalance,
    warning: input.warning,
    score,
    eligible,
    reasons
  };
};

// server/trading/universe.ts
var top5Depth = (units) => {
  const top = units.slice(0, 5);
  return {
    bid: top.reduce((sum, unit) => sum + unit.bidPrice * unit.bidSize, 0),
    ask: top.reduce((sum, unit) => sum + unit.askPrice * unit.askSize, 0)
  };
};
var getMarketLiquidity = async (market) => {
  const normalized = market.toUpperCase();
  const [metadata, tickers, orderbooks] = await Promise.all([
    listKrwMarkets(),
    getKrwTickers(),
    getOrderbooks([normalized])
  ]);
  const ticker = tickers.find((item) => item.market === normalized);
  const orderbook = orderbooks.find((item) => item.market === normalized);
  if (!ticker || !orderbook || orderbook.units.length === 0) throw new Error(`No public liquidity snapshot available for ${normalized}.`);
  const marketMetadata = metadata.find((item) => item.market === normalized);
  const best = orderbook.units[0];
  const depth = top5Depth(orderbook.units);
  return evaluateLiquidity({
    market: normalized,
    tradePrice: ticker.tradePrice,
    accTradePrice24h: ticker.accTradePrice24h,
    signedChangeRate: ticker.signedChangeRate,
    bestBid: best.bidPrice,
    bestAsk: best.askPrice,
    top5BidDepthKrw: depth.bid,
    top5AskDepthKrw: depth.ask,
    warning: marketMetadata?.warning ?? false
  });
};
var buildKrwLiquidityUniverse = async (limit = 12, candidateCount = 30) => {
  const [marketMetadata, tickers] = await Promise.all([listKrwMarkets(), getKrwTickers()]);
  const warnings = new Map(marketMetadata.map((item) => [item.market, item.warning]));
  const candidates = tickers.filter((ticker) => ticker.market.startsWith("KRW-")).sort((a, b) => b.accTradePrice24h - a.accTradePrice24h).slice(0, Math.max(limit, candidateCount));
  const orderbooks = await getOrderbooks(candidates.map((ticker) => ticker.market));
  const orderbookByMarket = new Map(orderbooks.map((book) => [book.market, book]));
  const ranked = candidates.map((ticker) => {
    const orderbook = orderbookByMarket.get(ticker.market);
    if (!orderbook || orderbook.units.length === 0) return null;
    const best = orderbook.units[0];
    const depth = top5Depth(orderbook.units);
    return evaluateLiquidity({
      market: ticker.market,
      tradePrice: ticker.tradePrice,
      accTradePrice24h: ticker.accTradePrice24h,
      signedChangeRate: ticker.signedChangeRate,
      bestBid: best.bidPrice,
      bestAsk: best.askPrice,
      top5BidDepthKrw: depth.bid,
      top5AskDepthKrw: depth.ask,
      warning: warnings.get(ticker.market) ?? false
    });
  }).filter((item) => Boolean(item)).sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.score - a.score;
  });
  return ranked.slice(0, limit);
};

// server/trading/paperSession.ts
var governanceVetoDecision = (baseDecision, reasons) => ({
  action: "HOLD",
  side: null,
  notional: 0,
  quantity: 0,
  confidence: baseDecision.confidence,
  stopLossPrice: null,
  takeProfitPrice: null,
  riskDisposition: baseDecision.riskDisposition,
  riskReasons: baseDecision.riskReasons.slice(),
  reasons: [...baseDecision.reasons, ...reasons]
});
var PaperTradingSession = class {
  constructor(initialCash = 1e6) {
    this.markPrices = /* @__PURE__ */ new Map();
    this.entryMetadata = /* @__PURE__ */ new Map();
    this.closedTrades = [];
    this.portfolio = new PaperPortfolio(initialCash);
    this.broker = new PaperBroker({ feeBps: 5, slippageBps: 8 });
    this.ledger = new TradingLedger();
  }
  checkpoint() {
    return {
      schemaVersion: 1,
      portfolio: this.portfolio.exportState(),
      markPrices: Array.from(this.markPrices.entries()),
      entryMetadata: Array.from(this.entryMetadata.entries()).map(([market, metadata]) => [market, { fill: { ...metadata.fill }, oracleTradeScore: metadata.oracleTradeScore }]),
      closedTrades: this.closedTrades.map((trade) => ({ ...trade })),
      ledger: this.ledger.snapshot().map((event) => ({ ...event, payload: { ...event.payload } })),
      processedOrderIds: this.broker.processedOrderIdsSnapshot()
    };
  }
  restore(checkpoint) {
    if (!checkpoint || checkpoint.schemaVersion !== 1) throw new Error("Unsupported Paper session checkpoint schema.");
    this.portfolio = PaperPortfolio.restore(checkpoint.portfolio);
    this.broker = new PaperBroker({ feeBps: 5, slippageBps: 8 });
    this.broker.restoreProcessedOrderIds(checkpoint.processedOrderIds ?? []);
    this.ledger = TradingLedger.restore(checkpoint.ledger ?? []);
    this.markPrices.clear();
    for (const [market, price] of checkpoint.markPrices ?? []) if (/^KRW-[A-Z0-9]+$/.test(market) && Number.isFinite(price) && price > 0) this.markPrices.set(market, price);
    this.entryMetadata.clear();
    for (const [market, metadata] of checkpoint.entryMetadata ?? []) if (metadata?.fill && Number.isFinite(metadata.oracleTradeScore)) this.entryMetadata.set(market, { fill: { ...metadata.fill }, oracleTradeScore: metadata.oracleTradeScore });
    this.closedTrades.splice(0, this.closedTrades.length, ...(checkpoint.closedTrades ?? []).slice(-5e3).map((trade) => ({ ...trade })));
    return this.state();
  }
  reset(initialCash = 1e6) {
    this.portfolio = new PaperPortfolio(initialCash);
    this.broker = new PaperBroker({ feeBps: 5, slippageBps: 8 });
    this.ledger = new TradingLedger();
    this.markPrices.clear();
    this.entryMetadata.clear();
    this.closedTrades.splice(0, this.closedTrades.length);
    return this.state();
  }
  performance(timestamp = Date.now()) {
    const portfolio = this.portfolio.snapshot(Object.fromEntries(this.markPrices), timestamp);
    return buildPaperPerformance(this.closedTrades, portfolio.equityCurve, portfolio.initialEquity, portfolio.equity, portfolio.drawdownPct);
  }
  state() {
    const portfolio = this.portfolio.snapshot(Object.fromEntries(this.markPrices));
    return { mode: "PAPER", strategyVersion: TRADING_STRATEGY_VERSION, portfolio, performance: buildPaperPerformance(this.closedTrades, portfolio.equityCurve, portfolio.initialEquity, portfolio.equity, portfolio.drawdownPct), closedTrades: this.closedTrades.slice(-100), ledger: this.ledger.snapshot() };
  }
  async step(market, eventScore, precomputedLiquidity, newEntryAllowed = true, governanceEvaluator, newEntryBlockReasons = []) {
    const normalized = market.toUpperCase();
    const [liquidity, multiTimeframe] = await Promise.all([precomputedLiquidity ? Promise.resolve(precomputedLiquidity) : getMarketLiquidity(normalized), buildMarketMultiTimeframe(normalized, eventScore)]);
    this.markPrices.set(normalized, liquidity.tradePrice);
    const before = this.portfolio.snapshot(Object.fromEntries(this.markPrices), multiTimeframe.asOf);
    const position = this.portfolio.getPosition(normalized);
    const baseDecision = buildExecutionDecision({
      liquidity,
      multiTimeframe,
      oneHour: multiTimeframe.frames.oneHour,
      portfolio: before,
      position,
      marketDataAgeMs: Math.max(0, Date.now() - multiTimeframe.asOf),
      newEntryAllowed,
      newEntryBlockReasons
    });
    let governance = null;
    let governanceError = null;
    if (governanceEvaluator) {
      try {
        governance = await governanceEvaluator({ market: normalized, liquidity, multiTimeframe, executionDecision: baseDecision, hasOpenPositionBefore: Boolean(position) });
      } catch (error) {
        governanceError = error instanceof Error ? error.message : "Unknown governance evaluation error.";
      }
    }
    let decision = baseDecision;
    if (baseDecision.action === "ENTER") {
      if (governanceError) decision = governanceVetoDecision(baseDecision, [`Governance evaluation failed closed before entry: ${governanceError}`]);
      else if (governance?.finalDecision.action !== "ENTER") decision = governanceVetoDecision(baseDecision, governance?.finalDecision.reasons ?? ["Governance evaluation was unavailable; new entry failed closed."]);
    }
    this.ledger.append("MARKET_SNAPSHOT", { market: normalized, price: liquidity.tradePrice, liquidityScore: liquidity.score, multiTimeframeScore: multiTimeframe.oracleTradeScore, eventScore: eventScore ?? null });
    this.ledger.append("SIGNAL", {
      market: normalized,
      baseAction: baseDecision.action,
      action: decision.action,
      side: decision.side,
      directionalScore: multiTimeframe.directionalScore,
      oracleTradeScore: multiTimeframe.oracleTradeScore,
      confidence: decision.confidence,
      governanceMode: governance?.finalDecision.mode ?? (governanceEvaluator ? "ENFORCE" : null),
      governancePolicy: governance?.finalDecision.policy ?? null,
      intelligenceDisposition: governance?.finalDecision.intelligenceDisposition ?? null,
      intelligencePackageId: governance?.intelligence.id ?? null,
      scenarioSetId: governance?.intelligence.scenarios.id ?? null,
      councilRunId: governance?.intelligence.council.id ?? null,
      portfolioEntryBlockReasons: newEntryAllowed ? [] : newEntryBlockReasons,
      governanceError
    });
    let fill = null;
    let closedTrade = null;
    if (decision.action === "ENTER" && decision.side === "BUY") {
      const orderId = `paper-${Date.now()}-${normalized}-buy`;
      this.ledger.append("ORDER_SUBMITTED", { orderId, market: normalized, side: "BUY", notional: decision.notional });
      fill = this.broker.executeMarketOrder({ id: orderId, market: normalized, side: "BUY", notional: decision.notional, referencePrice: liquidity.tradePrice, timestamp: Date.now(), strategyVersion: TRADING_STRATEGY_VERSION });
      this.portfolio.applyFill(fill);
      this.entryMetadata.set(normalized, { fill, oracleTradeScore: multiTimeframe.oracleTradeScore });
      if (decision.stopLossPrice && decision.takeProfitPrice) this.portfolio.setProtection(normalized, decision.stopLossPrice, decision.takeProfitPrice, fill.timestamp);
      this.ledger.append("ORDER_FILLED", { ...fill });
      this.ledger.append("POSITION_UPDATED", { market: normalized, position: this.portfolio.getPosition(normalized) });
    } else if (decision.action === "EXIT" && decision.side === "SELL" && position) {
      const orderId = `paper-${Date.now()}-${normalized}-sell`;
      this.ledger.append("ORDER_SUBMITTED", { orderId, market: normalized, side: "SELL", quantity: position.quantity });
      fill = this.broker.executeMarketOrder({ id: orderId, market: normalized, side: "SELL", quantity: position.quantity, referencePrice: liquidity.tradePrice, timestamp: Date.now(), strategyVersion: TRADING_STRATEGY_VERSION });
      const entry = this.entryMetadata.get(normalized);
      const costBasis = position.averageCost * fill.quantity;
      const entryFee = entry?.fill.fee ?? Math.max(0, (position.averageCost - position.entryPrice) * fill.quantity);
      const grossPnl = (fill.fillPrice - position.entryPrice) * fill.quantity;
      const netPnl = fill.notional - fill.fee - costBasis;
      closedTrade = { id: `trade-${normalized}-${position.openedAt}-${fill.timestamp}`, market: normalized, openedAt: position.openedAt, closedAt: fill.timestamp, entryPrice: position.entryPrice, exitPrice: fill.fillPrice, quantity: fill.quantity, grossPnl, fees: entryFee + fill.fee, netPnl, returnPct: costBasis > 0 ? netPnl / costBasis : 0, exitReason: decision.reasons[0] ?? "Exit policy triggered.", strategyVersion: TRADING_STRATEGY_VERSION, entryOracleTradeScore: entry?.oracleTradeScore ?? 50, exitOracleTradeScore: multiTimeframe.oracleTradeScore };
      this.portfolio.applyFill(fill);
      this.entryMetadata.delete(normalized);
      this.closedTrades.push(closedTrade);
      if (this.closedTrades.length > 5e3) this.closedTrades.splice(0, this.closedTrades.length - 5e3);
      this.ledger.append("ORDER_FILLED", { ...fill });
      this.ledger.append("POSITION_UPDATED", { market: normalized, position: null, closedTrade });
    }
    const after = this.portfolio.snapshot(Object.fromEntries(this.markPrices), Date.now());
    const performance = buildPaperPerformance(this.closedTrades, after.equityCurve, after.initialEquity, after.equity, after.drawdownPct);
    return { success: true, mode: "PAPER", strategyVersion: TRADING_STRATEGY_VERSION, liquidity, multiTimeframe, eventScore: eventScore ?? null, baseDecision, decision, governance, governanceError, fill, closedTrade, portfolio: after, performance, ledgerTail: this.ledger.snapshot().slice(-8) };
  }
};
var paperTradingSession = new PaperTradingSession();

// server/trading/tradeCaseStore.ts
var cloneTrace = (trace) => ({
  ...trace,
  router: { ...trace.router, reasons: trace.router.reasons.slice() },
  forecast: { ...trace.forecast, evidenceIds: trace.forecast.evidenceIds.slice(), reasons: trace.forecast.reasons.slice() },
  evidenceIds: trace.evidenceIds.slice(),
  reasons: trace.reasons.slice(),
  riskReasons: trace.riskReasons.slice(),
  governance: trace.governance ? { ...trace.governance, reasons: trace.governance.reasons.slice() } : void 0
});
var cloneRecord = (record) => ({
  ...record,
  entry: {
    ...record.entry,
    multiTimeframe: {
      ...record.entry.multiTimeframe,
      frames: {
        fourHour: { ...record.entry.multiTimeframe.frames.fourHour },
        oneHour: { ...record.entry.multiTimeframe.frames.oneHour },
        fifteenMinute: { ...record.entry.multiTimeframe.frames.fifteenMinute }
      }
    },
    decision: {
      ...record.entry.decision,
      evidenceIds: record.entry.decision.evidenceIds.slice(),
      forecast: {
        ...record.entry.decision.forecast,
        evidenceIds: record.entry.decision.forecast.evidenceIds.slice(),
        reasons: record.entry.decision.forecast.reasons.slice()
      },
      reasons: record.entry.decision.reasons.slice(),
      riskReasons: record.entry.decision.riskReasons.slice()
    }
  },
  latestDecision: cloneTrace(record.latestDecision),
  decisionHistory: record.decisionHistory.map(cloneTrace),
  governanceSnapshot: record.governanceSnapshot ? {
    ...record.governanceSnapshot,
    scenarios: record.governanceSnapshot.scenarios.map((item) => ({ ...item, triggerConditions: item.triggerConditions.slice(), invalidationConditions: item.invalidationConditions.slice(), watchItems: item.watchItems.slice(), evidenceIds: item.evidenceIds.slice() })),
    councilRankings: record.governanceSnapshot.councilRankings.map((item) => ({ ...item, unresolvedUncertainty: item.unresolvedUncertainty.slice(), preservedDissent: item.preservedDissent.slice() })),
    lensReviews: record.governanceSnapshot.lensReviews.map((item) => ({ ...item, reasons: item.reasons.slice() }))
  } : record.governanceSnapshot,
  supervisionNotes: record.supervisionNotes.slice()
});
var TradeCaseStore = class {
  constructor() {
    this.records = /* @__PURE__ */ new Map();
  }
  replaceAll(records) {
    this.records.clear();
    for (const record of records || []) {
      if (!record?.id || !record?.market || !record?.entry) continue;
      this.records.set(record.id, cloneRecord(record));
    }
    return this.list();
  }
  recordEntry(record) {
    this.records.set(record.id, cloneRecord(record));
    return this.get(record.id);
  }
  appendDecision(market, trace) {
    const open = this.findOpenByMarket(market);
    if (!open) return null;
    open.latestDecision = cloneTrace(trace);
    open.decisionHistory.push(cloneTrace(trace));
    if (open.decisionHistory.length > 512) open.decisionHistory.splice(0, open.decisionHistory.length - 512);
    this.records.set(open.id, open);
    return cloneRecord(open);
  }
  closeMarket(market, closedAt, trace) {
    const open = this.findOpenByMarket(market);
    if (!open) return null;
    open.status = "CLOSED";
    open.closedAt = closedAt;
    if (trace) {
      open.latestDecision = cloneTrace(trace);
      open.decisionHistory.push(cloneTrace(trace));
    }
    this.records.set(open.id, open);
    return cloneRecord(open);
  }
  linkIntelligence(market, links) {
    const open = this.findOpenByMarket(market);
    if (!open) return null;
    if (links.intelligencePackageId !== void 0) open.intelligencePackageId = links.intelligencePackageId;
    if (links.scenarioSetId !== void 0) open.scenarioSetId = links.scenarioSetId;
    if (links.councilRunId !== void 0) open.councilRunId = links.councilRunId;
    if (links.finalDecisionId !== void 0) open.finalDecisionId = links.finalDecisionId;
    if (links.note) open.supervisionNotes.push(links.note.slice(0, 500));
    if (open.supervisionNotes.length > 256) open.supervisionNotes.splice(0, open.supervisionNotes.length - 256);
    this.records.set(open.id, open);
    return cloneRecord(open);
  }
  linkGovernance(market, governance, finalDecisionId) {
    const open = this.findOpenByMarket(market);
    if (!open) return null;
    open.intelligencePackageId = governance.id;
    open.scenarioSetId = governance.scenarios.id;
    open.councilRunId = governance.council.id;
    open.finalDecisionId = finalDecisionId;
    open.governanceSnapshot = buildTradeCaseGovernanceSnapshot(governance, finalDecisionId);
    open.supervisionNotes.push(`Governance snapshot updated: ${governance.council.id}, recommended scenario ${governance.council.recommendedScenarioId ?? "none"}.`);
    if (open.supervisionNotes.length > 256) open.supervisionNotes.splice(0, open.supervisionNotes.length - 256);
    this.records.set(open.id, open);
    return cloneRecord(open);
  }
  get(id) {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : null;
  }
  findOpenByMarket(market) {
    const normalized = market.toUpperCase();
    const matches = Array.from(this.records.values()).filter((record) => record.market === normalized && record.status === "OPEN").sort((a, b) => b.openedAt - a.openedAt);
    return matches[0] ? cloneRecord(matches[0]) : null;
  }
  list() {
    return Array.from(this.records.values()).sort((a, b) => b.openedAt - a.openedAt).map(cloneRecord);
  }
};
var tradeCaseStore = new TradeCaseStore();

// server/trading/paperLoop.ts
var DEFAULT_CONFIG = { intervalMs: 15 * 60 * 1e3, maxMarkets: 6, maxOpenPositions: 4 };
var MAX_MARKET_HISTORY_POINTS = 384;
var MAX_CYCLE_HISTORY = 96;
var MAX_VALIDATION_SAMPLES = 1e4;
var MAX_COUNCIL_COMPARISONS = 5e3;
var VALIDATION_HORIZON_MS = 4 * 60 * 6e4;
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var validateConfig = (config) => {
  if (!Number.isInteger(config.intervalMs) || config.intervalMs < 5 * 60 * 1e3) throw new Error("Paper loop intervalMs must be at least 300000 (5 minutes).");
  if (!Number.isInteger(config.maxMarkets) || config.maxMarkets < 1 || config.maxMarkets > 12) throw new Error("Paper loop maxMarkets must be an integer between 1 and 12.");
  if (!Number.isInteger(config.maxOpenPositions) || config.maxOpenPositions < 1 || config.maxOpenPositions > 8) throw new Error("Paper loop maxOpenPositions must be an integer between 1 and 8.");
};
var cloneHistory = (history) => history.map((snapshot) => ({ timestamp: snapshot.timestamp, prices: snapshot.prices.map(([market, price]) => [market, price]) }));
var cloneValidationSample = (sample) => ({ ...sample });
var cloneCouncilComparison = (item) => ({ ...item, v1: { ...item.v1 }, v2: { ...item.v2 }, executionAuthority: false, promotionAuthority: false });
var cloneCycle = (cycle) => ({
  ...cycle,
  errors: cycle.errors.map((item) => ({ ...item })),
  markets: cycle.markets.map((item) => ({
    ...item,
    evidenceIds: item.evidenceIds.slice(),
    reasons: item.reasons.slice(),
    riskReasons: item.riskReasons.slice(),
    governance: item.governance ? { ...item.governance, reasons: item.governance.reasons.slice() } : void 0,
    router: { ...item.router, reasons: item.router.reasons.slice() },
    forecast: { ...item.forecast, evidenceIds: item.forecast.evidenceIds.slice(), reasons: item.forecast.reasons.slice() }
  }))
});
var normalizeHistory = (history) => {
  if (!Array.isArray(history)) return [];
  return history.flatMap((candidate) => {
    if (!Number.isFinite(candidate?.timestamp) || candidate.timestamp <= 0 || !Array.isArray(candidate?.prices)) return [];
    const prices = candidate.prices.flatMap((entry) => {
      if (!Array.isArray(entry) || entry.length !== 2) return [];
      const market = String(entry[0] ?? "").toUpperCase();
      const price = Number(entry[1]);
      if (!/^KRW-[A-Z0-9]+$/.test(market) || !Number.isFinite(price) || price <= 0) return [];
      return [[market, price]];
    });
    return prices.length ? [{ timestamp: candidate.timestamp, prices }] : [];
  }).sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_MARKET_HISTORY_POINTS);
};
var normalizeValidationSamples = (samples) => {
  if (!Array.isArray(samples)) return [];
  return mergeValidationSamples([], samples.flatMap((candidate) => {
    const market = String(candidate?.market ?? "").toUpperCase();
    const action = String(candidate?.action ?? "").toUpperCase();
    if (!/^KRW-[A-Z0-9]+$/.test(market) || !["ENTER", "EXIT", "HOLD"].includes(action)) return [];
    const numeric = ["decisionTimestamp", "anchorTimestamp", "targetTimestamp", "anchorPrice", "targetPrice", "rawReturn", "directionalReturn"];
    if (numeric.some((field) => !Number.isFinite(candidate?.[field]))) return [];
    return [{
      market,
      decisionTimestamp: Number(candidate.decisionTimestamp),
      anchorTimestamp: Number(candidate.anchorTimestamp),
      targetTimestamp: Number(candidate.targetTimestamp),
      action,
      regime: String(candidate.regime ?? "UNKNOWN"),
      anchorPrice: Number(candidate.anchorPrice),
      targetPrice: Number(candidate.targetPrice),
      rawReturn: Number(candidate.rawReturn),
      directionalReturn: Number(candidate.directionalReturn),
      favorable: Boolean(candidate.favorable)
    }];
  }), MAX_VALIDATION_SAMPLES);
};
var normalizeCouncilComparisons = (items) => {
  if (!Array.isArray(items)) return [];
  return items.flatMap((candidate) => {
    if (!candidate || typeof candidate.id !== "string" || !/^KRW-[A-Z0-9]+$/.test(String(candidate.market ?? "").toUpperCase())) return [];
    if (!Number.isFinite(candidate.generatedAt) || !Number.isFinite(candidate.targetTimestamp) || !Number.isFinite(candidate.anchorPrice) || candidate.anchorPrice <= 0) return [];
    if (!candidate.v1 || !candidate.v2) return [];
    return [cloneCouncilComparison({
      ...candidate,
      market: String(candidate.market).toUpperCase(),
      generatedAt: Number(candidate.generatedAt),
      targetTimestamp: Number(candidate.targetTimestamp),
      anchorPrice: Number(candidate.anchorPrice),
      resolvedAt: Number.isFinite(candidate.resolvedAt) ? Number(candidate.resolvedAt) : null,
      targetPrice: Number.isFinite(candidate.targetPrice) ? Number(candidate.targetPrice) : null,
      rawReturn: Number.isFinite(candidate.rawReturn) ? Number(candidate.rawReturn) : null,
      v1DirectionalUtility: Number.isFinite(candidate.v1DirectionalUtility) ? Number(candidate.v1DirectionalUtility) : null,
      v2DirectionalUtility: Number.isFinite(candidate.v2DirectionalUtility) ? Number(candidate.v2DirectionalUtility) : null,
      v1Favorable: typeof candidate.v1Favorable === "boolean" ? candidate.v1Favorable : null,
      v2Favorable: typeof candidate.v2Favorable === "boolean" ? candidate.v2Favorable : null,
      executionAuthority: false,
      promotionAuthority: false
    })];
  }).sort((a, b) => a.generatedAt - b.generatedAt).slice(-MAX_COUNCIL_COMPARISONS);
};
var normalizeCycleHistory = (history, fallback) => {
  const source = Array.isArray(history) ? history : fallback ? [fallback] : [];
  return source.filter((candidate) => Number.isFinite(candidate?.startedAt) && Number.isFinite(candidate?.finishedAt)).map((candidate) => cloneCycle({
    ...candidate,
    startedAt: Number(candidate.startedAt),
    finishedAt: Number(candidate.finishedAt),
    scanned: Number.isInteger(candidate.scanned) ? candidate.scanned : 0,
    entered: Number.isInteger(candidate.entered) ? candidate.entered : 0,
    exited: Number.isInteger(candidate.exited) ? candidate.exited : 0,
    held: Number.isInteger(candidate.held) ? candidate.held : 0,
    noTrade: Number.isInteger(candidate.noTrade) ? candidate.noTrade : 0,
    errors: Array.isArray(candidate.errors) ? candidate.errors : [],
    markets: Array.isArray(candidate.markets) ? candidate.markets : []
  })).sort((a, b) => a.finishedAt - b.finishedAt).slice(-MAX_CYCLE_HISTORY);
};
var PaperLoopController = class {
  constructor() {
    this.timer = null;
    this.cycleInProgress = false;
    this.config = { ...DEFAULT_CONFIG };
    this.lastCycle = null;
    this.cycleCount = 0;
    this.marketHistory = [];
    this.cycleHistory = [];
    this.validationSamples = [];
    this.councilComparisons = [];
    this.strategyReturnPanel = createStrategyReturnPanelCheckpoint();
  }
  checkpoint() {
    return {
      schemaVersion: 1,
      running: this.timer !== null,
      config: { ...this.config },
      cycleCount: this.cycleCount,
      lastCycle: this.lastCycle ? cloneCycle(this.lastCycle) : null,
      marketHistory: cloneHistory(this.marketHistory),
      cycleHistory: this.cycleHistory.map(cloneCycle),
      validationSamples: this.validationSamples.map(cloneValidationSample),
      councilComparisons: this.councilComparisons.map(cloneCouncilComparison),
      strategyReturnPanel: normalizeStrategyReturnPanel(this.strategyReturnPanel)
    };
  }
  restore(checkpoint, resume = false) {
    if (!checkpoint || checkpoint.schemaVersion !== 1) throw new Error("Unsupported Paper loop checkpoint schema.");
    validateConfig(checkpoint.config);
    this.stop();
    this.config = { ...checkpoint.config };
    this.cycleCount = Number.isInteger(checkpoint.cycleCount) && checkpoint.cycleCount >= 0 ? checkpoint.cycleCount : 0;
    this.lastCycle = checkpoint.lastCycle ? cloneCycle({ ...checkpoint.lastCycle, noTrade: Number.isInteger(checkpoint.lastCycle.noTrade) ? checkpoint.lastCycle.noTrade : 0, errors: Array.isArray(checkpoint.lastCycle.errors) ? checkpoint.lastCycle.errors : [], markets: Array.isArray(checkpoint.lastCycle.markets) ? checkpoint.lastCycle.markets : [] }) : null;
    this.marketHistory = normalizeHistory(checkpoint.marketHistory);
    this.cycleHistory = normalizeCycleHistory(checkpoint.cycleHistory, this.lastCycle);
    this.validationSamples = normalizeValidationSamples(checkpoint.validationSamples);
    this.councilComparisons = normalizeCouncilComparisons(checkpoint.councilComparisons);
    this.strategyReturnPanel = normalizeStrategyReturnPanel(checkpoint.strategyReturnPanel);
    if (!this.lastCycle && this.cycleHistory.length) this.lastCycle = cloneCycle(this.cycleHistory[this.cycleHistory.length - 1]);
    if (checkpoint.running && resume) this.start(this.config);
    return this.status();
  }
  status() {
    return {
      running: this.timer !== null,
      cycleInProgress: this.cycleInProgress,
      config: { ...this.config },
      cycleCount: this.cycleCount,
      lastCycle: this.lastCycle ? cloneCycle(this.lastCycle) : null,
      cycleHistory: this.cycleHistory.map(cloneCycle),
      marketHistory: cloneHistory(this.marketHistory),
      validationSamples: this.validationSamples.map(cloneValidationSample),
      session: paperTradingSession.state(),
      governance: {
        mode: "ENFORCE",
        policy: "STRICT_CONSENSUS",
        engine: "DETERMINISTIC_COUNCIL_CORE_V1",
        entryRule: "New ENTER requires source-backed Evidence + deterministic Scenario/Council support + deterministic Risk approval.",
        correlationPolicy: "New concurrent crypto exposure fails closed when aligned correlation history is insufficient; >1 existing market above 0.82 correlation rejects the candidate.",
        protectiveExitAuthority: true,
        challenger: {
          engine: "COUNCIL-V2-CHALLENGER-0.1",
          executionAuthority: false,
          promotionAuthority: false,
          comparison: summarizeCouncilComparison(this.councilComparisons)
        }
      },
      strategyResearch: summarizeStrategyReturnPanel(this.strategyReturnPanel),
      validationRetention: {
        horizonMs: VALIDATION_HORIZON_MS,
        retainedSamples: this.validationSamples.length,
        maxSamples: MAX_VALIDATION_SAMPLES,
        noLookahead: true,
        councilComparisonSamples: this.councilComparisons.length,
        strategyReturnObservations: this.strategyReturnPanel.observations.length
      }
    };
  }
  start(config = {}) {
    const next = { ...this.config, ...config };
    validateConfig(next);
    this.config = next;
    if (this.timer) return this.status();
    this.timer = setInterval(() => {
      void this.runCycle().catch((error) => console.error("Black Oracle paper loop cycle failed:", error));
    }, this.config.intervalMs);
    this.timer.unref?.();
    return this.status();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    return this.status();
  }
  async runCycle() {
    if (this.cycleInProgress) throw new Error("A Paper loop cycle is already in progress.");
    this.cycleInProgress = true;
    const startedAt = Date.now();
    const result = { startedAt, finishedAt: startedAt, scanned: 0, entered: 0, exited: 0, held: 0, noTrade: 0, errors: [], markets: [] };
    const cycleMarkPrices = [];
    try {
      const universe = await buildKrwLiquidityUniverse(Math.max(this.config.maxMarkets, 8), 30);
      const liquidityByMarket = new Map(universe.map((item) => [item.market, item]));
      const state = paperTradingSession.state();
      const openMarkets = state.portfolio.positions.map((position) => position.market);
      const eligibleCandidates = universe.filter((item) => item.eligible).slice(0, this.config.maxMarkets).map((item) => item.market);
      const orderedMarkets = [.../* @__PURE__ */ new Set([...openMarkets, ...eligibleCandidates])];
      for (const market of orderedMarkets) {
        const currentState = paperTradingSession.state();
        const currentlyOpen = currentState.portfolio.positions.map((position) => position.market);
        const alreadyOpen = currentlyOpen.includes(market);
        const capacityAllowed = alreadyOpen || currentlyOpen.length < this.config.maxOpenPositions;
        const correlationRisk = alreadyOpen ? null : assessPortfolioCorrelationRisk({ candidateMarket: market, openMarkets: currentlyOpen, marketHistory: this.marketHistory });
        const correlationAllowed = alreadyOpen || correlationRisk?.disposition === "PASS" || correlationRisk?.disposition === "WATCH";
        const newEntryAllowed = alreadyOpen || capacityAllowed && correlationAllowed;
        const newEntryBlockReasons = [
          ...!capacityAllowed ? [`Paper portfolio open-position limit ${this.config.maxOpenPositions} rejected another concurrent position.`] : [],
          ...!correlationAllowed && correlationRisk ? correlationRisk.reasons : []
        ];
        try {
          let liquidity = liquidityByMarket.get(market);
          if (!liquidity) liquidity = await getMarketLiquidity(market);
          const evidence = tradingEvidenceStore.aggregate(market);
          let councilComparison = null;
          let strategyObservation = null;
          const step = await paperTradingSession.step(
            market,
            evidence.activeCount > 0 ? evidence.score : void 0,
            liquidity,
            newEntryAllowed,
            (context) => {
              const governanceNow = Date.now();
              const governanceInput = { market, evidence, multiTimeframe: context.multiTimeframe, liquidity: context.liquidity, scope: context.hasOpenPositionBefore ? "HELD" : "CANDIDATE", now: governanceNow };
              const intelligence = buildDeterministicGovernancePackage(governanceInput);
              const challenger = buildCouncilV2Challenger(governanceInput);
              councilComparison = createCouncilComparisonObservation({ base: intelligence, challenger: challenger.challenger }, context.liquidity.tradePrice, VALIDATION_HORIZON_MS);
              strategyObservation = createStrategyReturnObservation(this.strategyReturnPanel, {
                market,
                generatedAt: governanceNow,
                anchorPrice: context.liquidity.tradePrice,
                multiTimeframe: context.multiTimeframe,
                evidence,
                liquidity: context.liquidity,
                horizonMs: VALIDATION_HORIZON_MS
              });
              const finalDecision = buildFinalDecision({ market, executionDecision: context.executionDecision, hasOpenPositionBefore: context.hasOpenPositionBefore, intelligence, mode: "ENFORCE", policy: "STRICT_CONSENSUS", now: intelligence.generatedAt });
              return { intelligence, finalDecision };
            },
            newEntryBlockReasons
          );
          if (councilComparison && !this.councilComparisons.some((item) => item.id === councilComparison.id)) {
            this.councilComparisons.push(cloneCouncilComparison(councilComparison));
            if (this.councilComparisons.length > MAX_COUNCIL_COMPARISONS) this.councilComparisons.splice(0, this.councilComparisons.length - MAX_COUNCIL_COMPARISONS);
          }
          if (strategyObservation) this.strategyReturnPanel = appendStrategyReturnObservation(this.strategyReturnPanel, strategyObservation);
          const hasOpenPositionAfterStep = step.portfolio.positions.some((position) => position.market === market);
          const trace = buildDecisionTrace({
            timestamp: Date.now(),
            market,
            decision: step.decision,
            multiTimeframe: step.multiTimeframe,
            evidence,
            hasOpenPositionAfterStep,
            governance: step.governance ? { finalDecision: step.governance.finalDecision, intelligencePackageId: step.governance.intelligence.id, scenarioSetId: step.governance.intelligence.scenarios.id, councilRunId: step.governance.intelligence.council.id } : null
          });
          if (trace.action === "ENTER" && step.fill) {
            tradeCaseStore.recordEntry(buildTradeCaseRecord({ market, fill: step.fill, trace, multiTimeframe: step.multiTimeframe, governance: step.governance?.intelligence ?? null }));
          } else if (trace.action === "EXIT") {
            if (step.governance) tradeCaseStore.linkGovernance(market, step.governance.intelligence, trace.governance?.finalDecisionId ?? null);
            tradeCaseStore.closeMarket(market, step.fill?.timestamp ?? trace.timestamp, trace);
          } else if (alreadyOpen || hasOpenPositionAfterStep) {
            tradeCaseStore.appendDecision(market, trace);
            if (step.governance) tradeCaseStore.linkGovernance(market, step.governance.intelligence, trace.governance?.finalDecisionId ?? null);
          }
          result.scanned += 1;
          if (trace.action === "ENTER") result.entered += 1;
          else if (trace.action === "EXIT") result.exited += 1;
          else if (trace.action === "HOLD") result.held += 1;
          else result.noTrade += 1;
          result.markets.push({ ...trace, decision: trace.action });
          if (Number.isFinite(step.liquidity.tradePrice) && step.liquidity.tradePrice > 0) cycleMarkPrices.push([market, step.liquidity.tradePrice]);
        } catch (error) {
          result.errors.push({ market, error: error instanceof Error ? error.message : "Unknown Paper loop error." });
        }
        await sleep(350);
      }
      result.finishedAt = Date.now();
      this.lastCycle = cloneCycle(result);
      this.cycleHistory.push(cloneCycle(result));
      if (this.cycleHistory.length > MAX_CYCLE_HISTORY) this.cycleHistory.splice(0, this.cycleHistory.length - MAX_CYCLE_HISTORY);
      if (cycleMarkPrices.length) {
        this.marketHistory.push({ timestamp: result.finishedAt, prices: cycleMarkPrices.slice().sort((a, b) => a[0].localeCompare(b[0])) });
        if (this.marketHistory.length > MAX_MARKET_HISTORY_POINTS) this.marketHistory.splice(0, this.marketHistory.length - MAX_MARKET_HISTORY_POINTS);
      }
      const recentDecisions = this.cycleHistory.flatMap((cycle) => cycle.markets);
      const newlyEvaluable = buildBlindValidationSamples(recentDecisions, this.marketHistory, VALIDATION_HORIZON_MS);
      this.validationSamples = mergeValidationSamples(this.validationSamples, newlyEvaluable, MAX_VALIDATION_SAMPLES);
      this.councilComparisons = resolveCouncilComparisonObservations(this.councilComparisons, this.marketHistory).slice(-MAX_COUNCIL_COMPARISONS);
      this.strategyReturnPanel = resolveStrategyReturnPanel(this.strategyReturnPanel, this.marketHistory);
      this.cycleCount += 1;
      return result;
    } finally {
      this.cycleInProgress = false;
    }
  }
};
var paperLoopController = new PaperLoopController();

// src/trading/evidenceIngestion.ts
var clamp11 = (value, min, max) => Math.min(max, Math.max(min, value));
var hashString = (value) => {
  let hash2 = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash2 ^= value.charCodeAt(index);
    hash2 = Math.imul(hash2, 16777619);
  }
  return (hash2 >>> 0).toString(16).padStart(8, "0");
};
var buildEvidenceId = (candidate) => `ext-${candidate.market.toLowerCase()}-${hashString(`${candidate.sourceUrl}|${candidate.title}`)}`;
var buildExternalTradingEvidence = (candidate, classification, observedAt = Date.now()) => {
  if (!classification.relevant) return null;
  if (!/^KRW-[A-Z0-9]+$/.test(candidate.market.toUpperCase())) {
    throw new Error("External evidence candidate market must be a normalized KRW market.");
  }
  if (!candidate.title.trim() || !candidate.publisher.trim() || !candidate.sourceUrl.trim()) {
    throw new Error("External evidence requires title, publisher and sourceUrl.");
  }
  if (!Number.isFinite(candidate.publishedAt) || candidate.publishedAt <= 0) {
    throw new Error("External evidence publishedAt is required.");
  }
  if (!Number.isFinite(candidate.reliability) || candidate.reliability < 0 || candidate.reliability > 1) {
    throw new Error("External evidence reliability must be between 0 and 1.");
  }
  const publishedAgeMs = Math.max(0, observedAt - candidate.publishedAt);
  const maxAgeMs = candidate.sourceType === "PRIMARY" ? 7 * 24 * 60 * 60 * 1e3 : 48 * 60 * 60 * 1e3;
  if (publishedAgeMs > maxAgeMs) return null;
  const expiryHours = clamp11(Math.round(classification.expiryHours || 24), 4, candidate.sourceType === "PRIMARY" ? 96 : 48);
  const evidence = {
    id: buildEvidenceId(candidate),
    market: candidate.market.toUpperCase(),
    title: candidate.title.trim().slice(0, 500),
    direction: classification.direction,
    strength: clamp11(Math.round(classification.strength || 0), 0, 100),
    reliability: candidate.reliability,
    sourceType: candidate.sourceType,
    source: candidate.publisher.trim(),
    publisher: candidate.publisher.trim(),
    sourceUrl: candidate.sourceUrl.trim(),
    summary: (candidate.summary || classification.rationale || "").trim().slice(0, 1200) || void 0,
    observedAt,
    expiresAt: observedAt + expiryHours * 60 * 60 * 1e3,
    contradictionOf: classification.contradictionOf || void 0,
    tags: Array.from(/* @__PURE__ */ new Set([...candidate.tags || [], "external", "auto-ingested"]))
  };
  validateTradingEvidence(evidence);
  return evidence;
};
export {
  buildExternalTradingEvidence,
  paperLoopController,
  paperTradingSession,
  tradeCaseStore,
  tradingEvidenceStore
};
