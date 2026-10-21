import type { RelicView } from "@/types";
import {
  calculateMetricValue,
  calculateRelicCombinations,
} from "./relicCalculator";
import { panelConstraintOrder } from "./calculator/panel";
import type {
  CalculatorFilters,
  CalculatorMetric,
  PanelConstraintKey,
  CalculatorResult,
} from "./calculator/types";
import type {
  TeamCalculationMember,
  TeamCalculationProgress,
  TeamCalculationRequest,
  TeamCalculationResult,
  TeamMemberCalculationResult,
  TeamMemberConfig,
} from "@/types/team";

const MEMBER_RESULT_LIMIT = 72;

function relicKey(relic: RelicView) {
  return String(relic.id);
}

function compareTarget(
  left: number,
  right: number,
  direction: TeamMemberConfig["targetDirections"][PanelConstraintKey],
) {
  if (direction === "max") return right - left;
  if (direction === "min") return left - right;
  return 0;
}

function compareObjectives(
  left: CalculatorResult,
  right: CalculatorResult,
  config: TeamMemberConfig,
) {
  for (const field of panelConstraintOrder) {
    if (config.targetDirections?.[field] !== "max") continue;
    const comparison = compareTarget(
      left.panel[field],
      right.panel[field],
      "max",
    );
    if (comparison) return comparison;
  }
  if (left.score !== right.score) return right.score - left.score;
  for (const field of panelConstraintOrder) {
    if (config.targetDirections?.[field] !== "min") continue;
    const comparison = compareTarget(
      left.panel[field],
      right.panel[field],
      "min",
    );
    if (comparison) return comparison;
  }
  return 0;
}

function generateMemberCandidates(
  member: TeamCalculationMember,
  relicsByPosition: Record<string, RelicView[]>,
  suitTwoPieceAttributes: Map<string, string>,
  excludedRelicIds: Set<string>,
) {
  const filters: CalculatorFilters = {
    quality: 6,
    level: 15,
    excludedRelicIds,
    mainAttributes: member.config.mainAttributes || {},
    requiredFourPiece: member.config.requiredFourPiece,
    requiredTwoPieceAttributes: new Set(
      member.config.requiredTwoPieceAttributes,
    ),
    requiredTwoPieceNames: new Set(member.config.requiredTwoPieceNames),
    panelConstraints: member.config.constraints,
    extraAttributes: member.config.extraAttributes,
    suitTwoPieceAttributes,
  };

  const searchMetrics: CalculatorMetric[] = [
    member.config.targetAttribute,
    ...panelConstraintOrder.filter(
      (field) =>
        field !== member.config.targetAttribute &&
        member.config.targetDirections?.[field] === "max",
    ),
  ];
  const resultsByRelicSet = new Map<string, CalculatorResult>();

  searchMetrics.forEach((metric) => {
    calculateRelicCombinations(
      relicsByPosition,
      member.baseStats,
      metric,
      filters,
      MEMBER_RESULT_LIMIT,
    ).forEach((result) => {
      const relicSetKey = result.relics
        .map((relic) => `${relic.position}:${relicKey(relic)}`)
        .sort()
        .join("|");
      resultsByRelicSet.set(relicSetKey, {
        ...result,
        score: calculateMetricValue(
          result.panel,
          member.config.targetAttribute,
        ),
      });
    });
  });

  return [...resultsByRelicSet.values()]
    .map((result) => ({
      config: member.config,
      heroName: member.heroName,
      result: {
        ...result,
        suits: result.suits.map((suit) => suit.replace(" x ", "×")),
      },
    }))
    .sort(
      (left, right) =>
        compareObjectives(left.result, right.result, member.config) ||
        (left.result.criticalRateOverflow || 0) -
          (right.result.criticalRateOverflow || 0),
    )
    .slice(0, MEMBER_RESULT_LIMIT);
}

export function calculateTeam(
  request: TeamCalculationRequest,
  onProgress?: (progress: TeamCalculationProgress) => void,
): TeamCalculationResult {
  const suitTwoPieceAttributes = new Map(
    Object.entries(request.suitTwoPieceAttributes),
  );
  const selected: TeamMemberCalculationResult[] = [];
  const usedRelicIds = new Set<string>();

  onProgress?.({
    stage: "preparing",
    completed: 0,
    total: request.members.length,
    message: "正在准备队伍计算",
  });

  for (const [index, member] of request.members.entries()) {
    if (
      member.config.mainAttributes &&
      ([2, 4, 6] as const).some(
        (position) => !member.config.mainAttributes?.[position]?.length,
      )
    ) {
      throw new Error(
        `式神「${member.heroName}」的 2 / 4 / 6 号位主属性都至少需要选择一项`,
      );
    }
    onProgress?.({
      stage: "generating",
      completed: index,
      total: request.members.length,
      message: `正在计算优先级 ${index + 1} 的 ${member.heroName}`,
    });
    const results = generateMemberCandidates(
      member,
      request.relicsByPosition,
      suitTwoPieceAttributes,
      usedRelicIds,
    );
    if (!results.length) {
      throw new Error(
        index === 0
          ? `式神「${member.heroName}」没有符合要求的御魂方案`
          : `按优先级分配前序式神后，式神「${member.heroName}」没有符合要求的剩余御魂方案`,
      );
    }
    const bestResult = results[0];
    selected.push(bestResult);
    bestResult.result.relics.forEach((relic) =>
      usedRelicIds.add(relicKey(relic)),
    );
    onProgress?.({
      stage: "generating",
      completed: index + 1,
      total: request.members.length,
      message: `${member.heroName} 计算完成，继续计算下一位`,
    });
  }

  onProgress?.({
    stage: "done",
    completed: request.members.length,
    total: request.members.length,
    message: "队伍计算完成",
  });
  return { members: selected };
}
