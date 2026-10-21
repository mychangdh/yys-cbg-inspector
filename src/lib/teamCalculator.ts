import type { RelicView } from "@/types";
import {
  calculatePanelMetric,
  calculateRelicPanel,
  satisfiesPanelRange,
} from "./calculator/panel";
import type { CalculatedPanel, CalculatorResult } from "./calculator/types";
import type {
  TeamCalculationMember,
  TeamCalculationProgress,
  TeamCalculationRequest,
  TeamCalculationResult,
  TeamMemberCalculationResult,
  TeamMemberConfig,
} from "@/types/team";

const POSITIONS = [1, 2, 3, 4, 5, 6] as const;
const POSITION_CANDIDATE_LIMIT = 44;
const MEMBER_BEAM_WIDTH = 420;
const MEMBER_RESULT_LIMIT = 72;
const MAX_GLOBAL_SEARCH_NODES = 500_000;

type BeamState = {
  relics: RelicView[];
  panel: CalculatedPanel;
};

type MemberCandidateSet = {
  member: TeamCalculationMember;
  results: TeamMemberCalculationResult[];
};

function relicKey(relic: RelicView) {
  return String(relic.id || "");
}

function targetValue(panel: CalculatedPanel, config: TeamMemberConfig) {
  return calculatePanelMetric(panel, config.targetAttribute);
}

function compareTarget(
  left: number,
  right: number,
  direction: TeamMemberConfig["targetDirection"],
) {
  return direction === "max" ? right - left : left - right;
}

function constraintPenalty(
  panel: CalculatedPanel,
  constraints: TeamMemberConfig["constraints"],
) {
  return Object.entries(constraints).reduce((total, [rawKey, range]) => {
    const value = panel[rawKey as keyof CalculatedPanel] as number;
    const scale = Math.max(
      1,
      Math.abs(range?.min || 0),
      Math.abs(range?.max || 0),
    );
    const below = range?.min === undefined ? 0 : Math.max(0, range.min - value);
    const above = range?.max === undefined ? 0 : Math.max(0, value - range.max);
    return total + (below + above) / scale;
  }, 0);
}

function compareBeamStates(
  left: BeamState,
  right: BeamState,
  member: TeamCalculationMember,
) {
  const leftPenalty = constraintPenalty(left.panel, member.config.constraints);
  const rightPenalty = constraintPenalty(
    right.panel,
    member.config.constraints,
  );
  return (
    leftPenalty - rightPenalty ||
    compareTarget(
      targetValue(left.panel, member.config),
      targetValue(right.panel, member.config),
      member.config.targetDirection,
    ) ||
    left.relics
      .map(relicKey)
      .join("|")
      .localeCompare(right.relics.map(relicKey).join("|"))
  );
}

function sortCandidateRelics(
  relics: RelicView[],
  member: TeamCalculationMember,
  suitTwoPieceAttributes: ReadonlyMap<string, string>,
) {
  const scored = relics
    .filter(
      (relic) => relic.quality === 6 && relic.level === 15 && relicKey(relic),
    )
    .map((relic) => ({
      relic,
      value: targetValue(
        calculateRelicPanel({
          baseStats: member.baseStats,
          relics: [relic],
          suitTwoPieceAttributes,
          extraAttributes: member.config.extraAttributes,
        }),
        member.config,
      ),
    }))
    .sort((left, right) =>
      compareTarget(left.value, right.value, member.config.targetDirection),
    );

  const selected: RelicView[] = [];
  const selectedIds = new Set<string>();
  const add = (relic: RelicView) => {
    const id = relicKey(relic);
    if (selectedIds.has(id) || selected.length >= POSITION_CANDIDATE_LIMIT)
      return;
    selectedIds.add(id);
    selected.push(relic);
  };

  scored.forEach(({ relic }) => add(relic));
  const suitRepresentatives = new Map<string, RelicView>();
  scored.forEach(({ relic }) => {
    const suit = relic.suit?.name || "散件";
    if (!suitRepresentatives.has(suit)) suitRepresentatives.set(suit, relic);
  });
  suitRepresentatives.forEach(add);
  return selected;
}

function satisfiesSuitRequirements(
  relics: readonly RelicView[],
  config: TeamMemberConfig,
  suitTwoPieceAttributes: ReadonlyMap<string, string>,
) {
  const suitCounts = new Map<string, number>();
  relics.forEach((relic) => {
    const suit = relic.suit?.name;
    if (suit) suitCounts.set(suit, (suitCounts.get(suit) || 0) + 1);
  });

  if (
    config.requiredFourPiece &&
    (suitCounts.get(config.requiredFourPiece) || 0) < 4
  )
    return false;

  if (
    config.requiredTwoPieceNames.some((name) => (suitCounts.get(name) || 0) < 2)
  )
    return false;

  return config.requiredTwoPieceAttributes.every((attribute) =>
    [...suitCounts.entries()].some(
      ([name, count]) =>
        count >= 2 &&
        name !== config.requiredFourPiece &&
        suitTwoPieceAttributes.get(name) === attribute,
    ),
  );
}

function createResult(
  member: TeamCalculationMember,
  state: BeamState,
): TeamMemberCalculationResult {
  const suitCounts = new Map<string, number>();
  state.relics.forEach((relic) => {
    const name = relic.suit?.name;
    if (name) suitCounts.set(name, (suitCounts.get(name) || 0) + 1);
  });
  const result: CalculatorResult = {
    score: targetValue(state.panel, member.config),
    panel: state.panel,
    relics: state.relics,
    criticalRateOverflow: Math.max(0, state.panel.critRate - 100),
    suits: [...suitCounts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((left, right) => right[1] - left[1])
      .map(([name, count]) => `${name}×${count}`),
  };
  return { config: member.config, heroName: member.heroName, result };
}

function generateMemberCandidates(
  member: TeamCalculationMember,
  relicsByPosition: Record<string, RelicView[]>,
  suitTwoPieceAttributes: ReadonlyMap<string, string>,
) {
  const candidatesByPosition = POSITIONS.map((position) => {
    const allowedMainAttributes = member.config.mainAttributes[position];
    return sortCandidateRelics(
      (relicsByPosition[String(position)] || []).filter((relic) => {
        const mainAttribute = relic.mainAttribute?.label;
        return (
          !allowedMainAttributes?.length ||
          (mainAttribute && allowedMainAttributes.includes(mainAttribute))
        );
      }),
      member,
      suitTwoPieceAttributes,
    );
  });

  if (candidatesByPosition.some((items) => items.length === 0)) return [];

  let states: BeamState[] = [
    {
      relics: [],
      panel: calculateRelicPanel({
        baseStats: member.baseStats,
        relics: [],
        suitTwoPieceAttributes,
        extraAttributes: member.config.extraAttributes,
      }),
    },
  ];

  candidatesByPosition.forEach((candidates) => {
    const nextStates: BeamState[] = [];
    states.forEach((state) => {
      const usedIds = new Set(state.relics.map(relicKey));
      candidates.forEach((relic) => {
        if (usedIds.has(relicKey(relic))) return;
        const relics = [...state.relics, relic];
        nextStates.push({
          relics,
          panel: calculateRelicPanel({
            baseStats: member.baseStats,
            relics,
            suitTwoPieceAttributes,
            extraAttributes: member.config.extraAttributes,
          }),
        });
      });
    });
    nextStates.sort((left, right) => compareBeamStates(left, right, member));
    states = nextStates.slice(0, MEMBER_BEAM_WIDTH);
  });

  return states
    .filter(
      (state) =>
        satisfiesPanelRange(state.panel, member.config.constraints) &&
        satisfiesSuitRequirements(
          state.relics,
          member.config,
          suitTwoPieceAttributes,
        ),
    )
    .sort((left, right) =>
      compareTarget(
        targetValue(left.panel, member.config),
        targetValue(right.panel, member.config),
        member.config.targetDirection,
      ),
    )
    .slice(0, MEMBER_RESULT_LIMIT)
    .map((state) => createResult(member, state));
}

function hasRelicConflict(
  candidate: TeamMemberCalculationResult,
  usedRelicIds: ReadonlySet<string>,
) {
  return candidate.result.relics.some((relic) =>
    usedRelicIds.has(relicKey(relic)),
  );
}

export function calculateTeam(
  request: TeamCalculationRequest,
  onProgress?: (progress: TeamCalculationProgress) => void,
): TeamCalculationResult {
  const suitTwoPieceAttributes = new Map(
    Object.entries(request.suitTwoPieceAttributes),
  );
  const candidateSets: MemberCandidateSet[] = [];

  onProgress?.({
    stage: "preparing",
    completed: 0,
    total: request.members.length,
    message: "正在准备队伍计算",
  });

  request.members.forEach((member, index) => {
    const results = generateMemberCandidates(
      member,
      request.relicsByPosition,
      suitTwoPieceAttributes,
    );
    if (!results.length) {
      throw new Error(`式神「${member.heroName}」没有符合要求的御魂方案`);
    }
    candidateSets.push({ member, results });
    onProgress?.({
      stage: "generating",
      completed: index + 1,
      total: request.members.length,
      message: `正在整理 ${member.heroName} 的候选方案`,
    });
  });

  onProgress?.({
    stage: "matching",
    completed: 0,
    total: request.members.length,
    message: "正在按优先级匹配整队御魂",
  });

  const failedStates = new Set<string>();
  const selected: TeamMemberCalculationResult[] = [];
  const usedRelicIds = new Set<string>();
  let searchNodes = 0;

  const search = (index: number): boolean => {
    if (index >= candidateSets.length) return true;
    if (searchNodes >= MAX_GLOBAL_SEARCH_NODES) return false;
    searchNodes += 1;
    const stateKey = `${index}:${[...usedRelicIds].sort().join(",")}`;
    if (failedStates.has(stateKey)) return false;

    const set = candidateSets[index];
    for (const candidate of set.results) {
      if (hasRelicConflict(candidate, usedRelicIds)) continue;
      const addedIds = candidate.result.relics.map(relicKey);
      addedIds.forEach((id) => usedRelicIds.add(id));
      selected.push(candidate);
      if (search(index + 1)) return true;
      selected.pop();
      addedIds.forEach((id) => usedRelicIds.delete(id));
    }
    failedStates.add(stateKey);
    return false;
  };

  if (!search(0)) {
    throw new Error(
      "没有找到同时满足全部式神要求且御魂不重复的队伍方案，请放宽条件或减少队伍人数",
    );
  }

  onProgress?.({
    stage: "done",
    completed: request.members.length,
    total: request.members.length,
    message: "队伍计算完成",
  });
  return { members: selected };
}
