import assert from "node:assert/strict";

import {
  calculateMetricValue,
  calculateRelicPanel,
  calculateRelicCombinations,
  satisfiesPanelConstraints,
  type HeroBaseStats,
} from "../src/lib/relicCalculator";
import { calculateFastFixedSuitSearch } from "../src/lib/fastRelicCalculator";
import type { RelicView } from "../src/types";
import {
  calculatePanelFromStats,
  satisfiesPanelRange,
} from "../src/lib/calculator/panel";
import { createCalculationRelics } from "../src/lib/calculator/relicInput";
import { prioritizeCalculatorResults } from "../src/lib/calculator/resultRanking";
import {
  metricStatKeys,
  removeDominatedRelics,
  statKeysForPanelKey,
} from "../src/lib/calculator/pruning";
import {
  createFixedSuitLayoutPlan,
  fixedSuitPatterns,
} from "../src/lib/calculator/fixedSuitPlan";
import { offerBest } from "../src/lib/calculator/boundedHeap";
import {
  workerLimitForCapacity,
  workerLimitForRelicCount,
} from "../src/lib/calculator/workerCapacity";

const attack = "攻击";
const attackPercent = "攻击加成";
const critDamage = "暴击伤害";
const speed = "速度";

const baseStats: HeroBaseStats = {
  attack: 100,
  health: 1000,
  defense: 100,
  speed: 100,
  critRate: 10,
  critDamage: 150,
  effectHit: 0,
  effectResistance: 0,
};

function relic(
  id: string,
  suitName: string,
  options: Partial<RelicView> = {},
): RelicView {
  return {
    id,
    quality: 6,
    level: 15,
    position: 1,
    suit: { id: 1, name: suitName },
    mainAttribute: null,
    subAttributes: [],
    ...options,
  };
}

function closeTo(actual: number, expected: number, message: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual}`);
}

/**
 * 伤害追求攻击，攻击上限却偏好更低攻击；两者方向冲突时不能删除任一候选。
 * 这是平将门防御平“攻击不超过 7700”漏掉可行组合的最小复现。
 */
function assertMaximumConstraintDoesNotDropDamageCandidate(): void {
  const lowAttack = relic("upper-bound-low-attack", "测试套装", {
    subAttributes: [
      { label: attack, value: 10, isPercent: false },
      { label: critDamage, value: 5, isPercent: true },
    ],
  });
  const highAttack = relic("upper-bound-high-attack", "测试套装", {
    subAttributes: [
      { label: attack, value: 30, isPercent: false },
      { label: critDamage, value: 10, isPercent: true },
    ],
  });
  const retained = removeDominatedRelics(
    [lowAttack, highAttack],
    "damage",
    {
      quality: 6,
      level: 15,
      mainAttributes: {},
      panelConstraints: { attack: { max: 150 } },
    },
    (item) =>
      calculateMetricValue(
        calculateRelicPanel({ baseStats, relics: [item] }),
        "damage",
      ),
  );
  assert.deepStrictEqual(
    retained.map((item) => item.id),
    [lowAttack.id, highAttack.id],
    "攻击上限与伤害指标冲突时必须保留低攻击候选",
  );
}

/**
 * 攻击上限与伤害指标冲突时，不同攻击值不能互相支配；但攻击相关词条完全相同
 * 的候选仍可在组内按其他正向词条裁剪。该用例保证精确分组不会退化回全量保留。
 */
function assertExactConflictGroupingStillPrunesDuplicates(): void {
  const lowerCritDamage = relic("same-attack-lower-crit-damage", "测试套装", {
    subAttributes: [
      { label: attack, value: 10, isPercent: false },
      { label: critDamage, value: 5, isPercent: true },
    ],
  });
  const higherCritDamage = relic("same-attack-higher-crit-damage", "测试套装", {
    subAttributes: [
      { label: attack, value: 10, isPercent: false },
      { label: critDamage, value: 10, isPercent: true },
    ],
  });
  const retained = removeDominatedRelics(
    [lowerCritDamage, higherCritDamage],
    "damage",
    {
      quality: 6,
      level: 15,
      mainAttributes: {},
      panelConstraints: { attack: { max: 150 } },
    },
    (item) =>
      calculateMetricValue(
        calculateRelicPanel({ baseStats, relics: [item] }),
        "damage",
      ),
  );
  assert.deepStrictEqual(
    retained.map((item) => item.id),
    [higherCritDamage.id],
    "冲突属性相同的候选仍应裁掉被其余正向词条完全覆盖的御魂",
  );
}

/**
 * 固定四件套紧凑搜索会同时处理四件套、散件和剩余两件套。这里用小型完整候选集
 * 对照标准搜索，覆盖上限属性与正向指标方向相反的情况，防止优化路径误删可行组合。
 */
function assertFastFixedSuitMatchesStandard(): void {
  const suitTwoPieceAttributes = new Map([
    ["四件套", "暴击+15%"],
    ["暴击套", "暴击+15%"],
    ["攻击套", "攻击加成15%"],
  ]);
  const relicsByPosition = Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((position) => {
      const offset = position % 3;
      return [
        String(position),
        [
          relic(`differential-fixed-${position}`, "四件套", {
            position,
            subAttributes: [
              { label: attack, value: 12 + offset, isPercent: false },
              { label: "生命", value: 8 + offset * 2, isPercent: false },
              { label: "防御", value: 3 + offset, isPercent: false },
              { label: critDamage, value: 3 + offset, isPercent: true },
            ],
          }),
          relic(`differential-crit-${position}`, "暴击套", {
            position,
            subAttributes: [
              { label: attack, value: 7 + offset, isPercent: false },
              { label: "生命", value: 16 - offset, isPercent: false },
              { label: "防御", value: 4 + offset, isPercent: false },
              { label: critDamage, value: 8 + offset, isPercent: true },
            ],
          }),
          relic(`differential-attack-${position}`, "攻击套", {
            position,
            subAttributes: [
              { label: attack, value: 15 - offset, isPercent: false },
              { label: "生命", value: 4 + offset, isPercent: false },
              { label: "防御", value: 2 + offset, isPercent: false },
              { label: critDamage, value: 5 + offset, isPercent: true },
            ],
          }),
          relic(`differential-free-${position}`, "散件", {
            position,
            subAttributes: [
              { label: attack, value: 4 + offset, isPercent: false },
              { label: "生命", value: 20 - offset, isPercent: false },
              { label: "防御", value: 5 + offset, isPercent: false },
              { label: critDamage, value: 9 - offset, isPercent: true },
            ],
          }),
        ],
      ];
    }),
  );
  const scenarios = [
    {
      metric: "damage" as const,
      constraints: {
        attack: { max: 225 },
        health: { min: 1050, max: 1115 },
        defense: { min: 112 },
        critRate: { min: 50, max: 100 },
      },
    },
    {
      metric: "damage" as const,
      constraints: {
        attack: { max: 215 },
        defense: { min: 116, max: 124 },
        critDamage: { min: 175, max: 205 },
      },
    },
    {
      metric: "defenseOutput" as const,
      constraints: {
        attack: { max: 218 },
        health: { max: 1100 },
        defense: { min: 115, max: 126 },
        critRate: { min: 35, max: 100 },
      },
    },
  ];
  scenarios.forEach(({ metric, constraints }) => {
    const filters = {
      quality: 6,
      level: 15,
      mainAttributes: {},
      requiredFourPiece: "四件套",
      suitTwoPieceAttributes,
      panelConstraints: constraints,
      fastMode: true,
    };
    const standard = calculateRelicCombinations(
      relicsByPosition,
      baseStats,
      metric,
      filters,
      3,
    );
    const fast = calculateFastFixedSuitSearch({
      relicsByPosition,
      baseStats,
      metric,
      filters,
      resultLimit: 3,
    })
      .map((result) => {
        const panel = calculateRelicPanel({
          baseStats,
          relics: result.relics,
          suitTwoPieceAttributes,
        });
        return { score: calculateMetricValue(panel, metric), panel };
      })
      .sort((left, right) => right.score - left.score);
    const exhaustive: Array<{
      score: number;
      panel: ReturnType<typeof calculateRelicPanel>;
    }> = [];
    const positions = [1, 2, 3, 4, 5, 6] as const;
    const selected: RelicView[] = [];
    const enumerate = (depth: number): void => {
      if (depth === positions.length) {
        if (
          selected.filter((relic) => relic.suit?.name === "四件套").length <
          4
        )
          return;
        const panel = calculateRelicPanel({
          baseStats,
          relics: selected,
          suitTwoPieceAttributes,
        });
        if (!satisfiesPanelConstraints(panel, constraints)) return;
        exhaustive.push({ score: calculateMetricValue(panel, metric), panel });
        return;
      }
      const relics = relicsByPosition[String(positions[depth])] || [];
      relics.forEach((relic) => {
        selected.push(relic);
        enumerate(depth + 1);
        selected.pop();
      });
    };
    enumerate(0);
    exhaustive.sort((left, right) => right.score - left.score);

    assert.ok(
      fast.length >= standard.length,
      `紧凑搜索不能比标准搜索遗漏更多结果：${metric} ${JSON.stringify(constraints)}`,
    );
    exhaustive.slice(0, 3).forEach((result, index) => {
      closeTo(
        fast[index].score,
        result.score,
        "紧凑固定套搜索必须与穷举最优指标一致",
      );
      closeTo(
        fast[index].panel.attack,
        result.panel.attack,
        "紧凑固定套搜索必须与穷举攻击面板一致",
      );
    });
    standard.forEach((result, index) => {
      closeTo(
        fast[index].score,
        result.score,
        "紧凑与标准固定套搜索的指标必须一致",
      );
      closeTo(
        fast[index].panel.attack,
        result.panel.attack,
        "紧凑与标准固定套搜索的攻击面板必须一致",
      );
      closeTo(
        fast[index].panel.critDamage,
        result.panel.critDamage,
        "紧凑与标准固定套搜索的暴击伤害面板必须一致",
      );
    });
  });
}

/**
 * 四件套全覆盖路径会压缩两个自由号位的套装计数。这个用例确认自由格同套时
 * 仍会触发两件套属性，且最终结果标签按实际六件御魂完整还原。
 */
function assertUnrestrictedFixedSuitKeepsFreeTwoPieceBonus(): void {
  const relicsByPosition = Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((position) => [
      String(position),
      [
        relic(`unrestricted-fixed-${position}`, "四件套", { position }),
        relic(`unrestricted-free-${position}`, "自由套", {
          position,
          subAttributes: [{ label: attack, value: 20, isPercent: false }],
        }),
      ],
    ]),
  );
  const results = calculateRelicCombinations(
    relicsByPosition,
    baseStats,
    "damage",
    {
      quality: 6,
      level: 15,
      mainAttributes: {},
      requiredFourPiece: "四件套",
      // 上限让本用例明确经过标准固定套路径，而不是紧凑搜索实现。
      panelConstraints: { attack: { max: 10_000 } },
      suitTwoPieceAttributes: new Map([["自由套", "攻击加成+15%"]]),
    },
    1,
    undefined,
    "unrestricted",
  );
  assert.equal(results.length, 1, "全覆盖四件套搜索必须返回自由两件套组合");
  assert.equal(
    results[0].relics.filter((relic) => relic.suit?.name === "四件套").length,
    4,
    "四件固定套布局必须保留四件固定套",
  );
  assert.equal(
    results[0].relics.filter((relic) => relic.suit?.name === "自由套").length,
    2,
    "自由号位应能选择同一套装的两件",
  );
  closeTo(results[0].panel.attack, 155, "自由两件套攻击加成必须精确生效");
  assert.ok(results[0].suits.includes("四件套×4"));
  assert.ok(results[0].suits.includes("自由套×2"));
}

/**
 * 这些用例覆盖计算器不可改变的领域契约，而不是页面展示：
 * 百分比属性只能基于式神基础面板，精确副属性覆盖展示副属性，逢魔一件套逐件生效。
 */
function run(): void {
  assert.equal(
    workerLimitForCapacity({
      logicalCores: 12,
      totalMemoryMb: 32_768,
      freeMemoryMb: 20_480,
    }),
    8,
    "高配桌面机应为渲染与系统保留线程，不应开满十二个 Worker",
  );
  assert.equal(
    workerLimitForCapacity({
      logicalCores: 8,
      totalMemoryMb: 8_192,
      freeMemoryMb: 3_000,
    }),
    2,
    "低空闲内存设备必须优先限制 Worker 数，避免多个御魂仓库副本挤占内存",
  );
  assert.equal(
    workerLimitForRelicCount(8, 6_932),
    5,
    "六千件御魂仓库应在内存上限内充分利用桌面端可用核心",
  );
  assert.equal(
    workerLimitForRelicCount(8, 3_000),
    8,
    "中等规模仓库保持机器资源允许的并发数量",
  );
  assertMaximumConstraintDoesNotDropDamageCandidate();
  assertExactConflictGroupingStillPrunesDuplicates();
  assertFastFixedSuitMatchesStandard();
  assertUnrestrictedFixedSuitKeepsFreeTwoPieceBonus();
  const heap: number[] = [];
  [5, 1, 4, 2, 3].forEach((value) =>
    offerBest(heap, value, 3, (left, right) => left - right),
  );
  assert.deepEqual(
    heap.sort((left, right) => left - right),
    [1, 2, 3],
    "固定容量堆必须保留比较器定义的最优前 K 项",
  );

  assert.equal(
    fixedSuitPatterns(4).length,
    15,
    "六个号位中选择四件套必须保持十五种布局",
  );
  const layoutPlan = createFixedSuitLayoutPlan(
    Array.from({ length: 6 }, (_, position) => [
      relic(`four-${position}`, "四件套", { position: position + 1 }),
      relic(`two-${position}`, "两件套", { position: position + 1 }),
    ]),
    {
      quality: 6,
      level: 15,
      mainAttributes: {},
      suitTwoPieceAttributes: new Map([["两件套", "暴击+15%"]]),
    },
    "四件套",
    4,
    ["两件套"],
  );
  assert.equal(
    layoutPlan.variants.length,
    15,
    "固定四件套与指定两件套应覆盖全部可用布局",
  );
  assert.equal(
    layoutPlan.totalRelics,
    90,
    "布局进度总量应按每个布局的六个号位候选累计",
  );

  const fixedSearchRelics = Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((position) => [
      String(position),
      [
        relic(`fixed-four-${position}`, "四件套", { position }),
        relic(`fixed-two-${position}`, "两件套", { position }),
      ],
    ]),
  );
  const fixedSearchResults = calculateRelicCombinations(
    fixedSearchRelics,
    baseStats,
    "damage",
    {
      quality: 6,
      level: 15,
      mainAttributes: {},
      requiredFourPiece: "四件套",
      requiredTwoPieceNames: new Set(["两件套"]),
      suitTwoPieceAttributes: new Map([["两件套", "暴击+15%"]]),
    },
    3,
  );
  assert.ok(fixedSearchResults.length > 0, "固定套装搜索必须返回真实组合");
  assert.equal(fixedSearchResults[0].relics.length, 6);
  assert.equal(
    fixedSearchResults[0].relics.filter((item) => item.suit?.name === "四件套")
      .length,
    4,
  );
  assert.equal(
    fixedSearchResults[0].relics.filter((item) => item.suit?.name === "两件套")
      .length,
    2,
  );
  const fastFixedSearchResults = calculateRelicCombinations(
    fixedSearchRelics,
    baseStats,
    "damage",
    {
      quality: 6,
      level: 15,
      mainAttributes: {},
      requiredFourPiece: "四件套",
      requiredTwoPieceNames: new Set(["两件套"]),
      suitTwoPieceAttributes: new Map([["两件套", "暴击+15%"]]),
      fastMode: true,
    },
    1,
  );
  assert.equal(
    fastFixedSearchResults.length,
    1,
    "极速固定套装搜索必须返回一个最优组合",
  );

  // 攻击上限与伤害指标方向相反：较低攻击的御魂可能是唯一可行解，不能被较高攻击
  // 的候选按普通支配关系删除。该用例要求六件中至少保留一件低攻击御魂。
  // 固定四件套的两阶段 Worker 复用同一份候选缓存。缓存只节省准备工作，
  // 不能改变全覆盖阶段与具体两件套补漏阶段合并后的最优结果。
  const workerCacheFilters = {
    quality: 6,
    level: 15,
    mainAttributes: {},
    requiredFourPiece: "四件套",
    // 上限约束会让紧凑快速路径主动退出，确保本用例覆盖标准固定套两阶段缓存。
    panelConstraints: { attack: { max: 10_000 } },
    suitTwoPieceAttributes: new Map([["两件套", "暴击+15%"]]),
  };
  const workerLifecycleCache = { fixedSuitCandidateCache: new Map() };
  const unrestrictedPhaseResults = calculateRelicCombinations(
    fixedSearchRelics,
    baseStats,
    "damage",
    workerCacheFilters,
    3,
    undefined,
    "unrestricted",
    undefined,
    workerLifecycleCache,
  );
  const explicitPhaseResults = calculateRelicCombinations(
    fixedSearchRelics,
    baseStats,
    "damage",
    workerCacheFilters,
    3,
    undefined,
    "explicit",
    unrestrictedPhaseResults,
    workerLifecycleCache,
  );
  const combinedPhaseResults = prioritizeCalculatorResults(
    [...unrestrictedPhaseResults, ...explicitPhaseResults],
    workerCacheFilters,
    "damage",
    3,
  );
  const completeFixedResults = calculateRelicCombinations(
    fixedSearchRelics,
    baseStats,
    "damage",
    workerCacheFilters,
    3,
  );
  assert.ok(
    workerLifecycleCache.eligibleRelics,
    "两阶段计算必须缓存已筛选御魂",
  );
  assert.ok(
    workerLifecycleCache.fixedSuitCandidateCache.size > 0,
    "两阶段计算必须缓存固定套候选前沿",
  );
  assert.equal(
    combinedPhaseResults[0]?.score,
    completeFixedResults[0]?.score,
    "复用缓存的两阶段固定套搜索必须保持最优指标一致",
  );

  const upperBoundRelics = Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((position) => [
      String(position),
      [
        relic(`upper-fixed-low-${position}`, "四件套", {
          position,
          subAttributes: [{ label: attack, value: 0, isPercent: false }],
        }),
        relic(`upper-fixed-high-${position}`, "四件套", {
          position,
          subAttributes: [{ label: attack, value: 20, isPercent: false }],
        }),
        relic(`upper-free-low-${position}`, "散件", {
          position,
          subAttributes: [{ label: attack, value: 0, isPercent: false }],
        }),
        relic(`upper-free-high-${position}`, "散件", {
          position,
          subAttributes: [{ label: attack, value: 20, isPercent: false }],
        }),
      ],
    ]),
  );
  const upperBoundResults = calculateRelicCombinations(
    upperBoundRelics,
    baseStats,
    "damage",
    {
      quality: 6,
      level: 15,
      mainAttributes: {},
      requiredFourPiece: "四件套",
      panelConstraints: { attack: { max: 210 } },
      fastMode: true,
    },
    1,
  );
  assert.equal(
    upperBoundResults.length,
    1,
    "攻击上限下的固定四件套搜索必须保留可行组合",
  );
  assert.equal(
    upperBoundResults[0].panel.attack,
    200,
    "攻击上限下必须选择一件较低攻击御魂而非丢失全部结果",
  );

  // 不是当前指标的属性也可能有上限。生命上限下，高爆伤候选不能把低生命候选
  // 直接支配掉，否则伤害搜索会错误返回空结果。
  const healthBoundRelics = Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((position) => [
      String(position),
      [
        relic(`health-fixed-low-${position}`, "四件套", {
          position,
          subAttributes: [{ label: "生命", value: 0, isPercent: false }],
        }),
        relic(`health-fixed-high-${position}`, "四件套", {
          position,
          subAttributes: [
            { label: "生命", value: 20, isPercent: false },
            { label: critDamage, value: 2, isPercent: true },
          ],
        }),
        relic(`health-free-low-${position}`, "散件", {
          position,
          subAttributes: [{ label: "生命", value: 0, isPercent: false }],
        }),
        relic(`health-free-high-${position}`, "散件", {
          position,
          subAttributes: [
            { label: "生命", value: 20, isPercent: false },
            { label: critDamage, value: 2, isPercent: true },
          ],
        }),
      ],
    ]),
  );
  const healthBoundResults = calculateRelicCombinations(
    healthBoundRelics,
    baseStats,
    "damage",
    {
      quality: 6,
      level: 15,
      mainAttributes: {},
      requiredFourPiece: "四件套",
      panelConstraints: { health: { max: 1100 } },
      fastMode: true,
    },
    1,
  );
  assert.equal(
    healthBoundResults.length,
    1,
    "非指标属性上限下的固定四件套搜索必须保留可行组合",
  );
  assert.equal(
    healthBoundResults[0].panel.health,
    1100,
    "生命上限下必须保留一件低生命御魂",
  );

  const generalSearchResults = calculateRelicCombinations(
    fixedSearchRelics,
    baseStats,
    "damage",
    {
      quality: 6,
      level: 15,
      mainAttributes: {},
    },
    3,
  );
  assert.ok(
    generalSearchResults.length > 0,
    "通用 Beam 搜索必须返回至少一个真实御魂组合",
  );
  assert.equal(
    generalSearchResults[0].relics.length,
    6,
    "通用 Beam 搜索结果必须覆盖六个号位",
  );

  assert.deepEqual(
    statKeysForPanelKey("attack"),
    ["attackPercent", "attack"],
    "攻击面板必须同时考虑百分比和固定攻击词条",
  );
  assert.deepEqual(
    metricStatKeys("damage"),
    ["attackPercent", "attack", "critDamage"],
    "伤害指标的剪枝维度必须包含攻击、攻击加成和爆伤",
  );
  const dominated = removeDominatedRelics(
    [
      relic("dominator", "测试套", {
        subAttributes: [
          { label: attackPercent, value: 20, isPercent: true },
          { label: critDamage, value: 20, isPercent: true },
        ],
      }),
      relic("dominated", "测试套", {
        subAttributes: [
          { label: attackPercent, value: 10, isPercent: true },
          { label: critDamage, value: 10, isPercent: true },
        ],
      }),
    ],
    "damage",
    { quality: 6, level: 15, mainAttributes: {} },
    (item) => (item.id === "dominator" ? 200 : 100),
  );
  assert.deepEqual(
    dominated.map((item) => item.id),
    ["dominator"],
    "同号位同套装且所有相关词条都被覆盖时才允许剪枝",
  );

  const rankingRelics = [
    relic("rank-one", "测试套"),
    relic("rank-two", "测试套"),
  ];
  const rankingPanel = {
    ...calculatePanelFromStats(baseStats, {}),
    critRate: 100,
  };
  const rankedResults = prioritizeCalculatorResults(
    [
      {
        score: 100,
        panel: rankingPanel,
        relics: rankingRelics,
        suits: [],
        criticalRateOverflow: 15,
      },
      {
        score: 100,
        panel: rankingPanel,
        relics: [...rankingRelics].reverse(),
        suits: [],
        criticalRateOverflow: 5,
      },
      {
        score: 120,
        panel: { ...rankingPanel, critRate: 99.99 },
        relics: [relic("invalid", "测试套")],
        suits: [],
      },
    ],
    {
      quality: 6,
      level: 15,
      mainAttributes: {},
      panelConstraints: { critRate: { min: 100 } },
    },
    5,
  );
  assert.equal(rankedResults.length, 1, "结果排名先复核面板约束并按组合去重");
  assert.equal(
    rankedResults[0].criticalRateOverflow,
    15,
    "相同组合按 Worker 合并顺序稳定去重",
  );

  const calculationRelics = createCalculationRelics({
    1: [
      relic("included", "测试套", {
        enhancement: {
          totals: [
            {
              key: "speedAdditionVal",
              label: speed,
              count: 1,
              total: 4,
              values: [4],
            },
          ],
        },
      }),
      relic("excluded", "测试套", { quality: 5 }),
    ],
  });
  assert.equal(
    calculationRelics[1].length,
    1,
    "Worker 输入只保留六星十五级御魂",
  );
  assert.deepEqual(
    calculationRelics[1][0].enhancement,
    { totals: calculationRelics[1][0].enhancement?.totals },
    "Worker 输入只保留强化精确累计值",
  );

  const directPanel = calculatePanelFromStats(baseStats, {
    attackPercent: 15,
    attack: 10,
  });
  closeTo(directPanel.attack, 125, "独立面板计算遵循基础攻击规则");
  assert.equal(
    satisfiesPanelRange(directPanel, {
      attack: { min: directPanel.attack, max: directPanel.attack },
    }),
    true,
    "独立面板范围判断包含边界值",
  );

  const twoPiecePanel = calculateRelicPanel({
    baseStats,
    relics: [
      relic("one", "测试套", {
        subAttributes: [{ label: attack, value: 10, isPercent: false }],
      }),
      relic("two", "测试套"),
    ],
    suitTwoPieceAttributes: new Map([["测试套", `${attackPercent}15%`]]),
  });
  closeTo(twoPiecePanel.attack, 125, "两件套只乘基础攻击");

  const preciseSubAttributePanel = calculateRelicPanel({
    baseStats,
    relics: [
      relic("precise", "散件", {
        subAttributes: [{ label: speed, value: 4, isPercent: false }],
        enhancement: {
          totals: [
            {
              key: "speedAdditionVal",
              label: speed,
              count: 5,
              total: 17.34,
              values: [17.34],
            },
          ],
        },
      }),
    ],
  });
  closeTo(preciseSubAttributePanel.speed, 117.34, "精确副属性优先");

  const omaPanel = calculateRelicPanel({
    baseStats,
    relics: [
      relic("oma-one", "荒骷髅", {
        setBonusAttribute: { label: critDamage, value: 10, isPercent: true },
      }),
      relic("oma-two", "荒骷髅", {
        setBonusAttribute: { label: critDamage, value: 10, isPercent: true },
      }),
    ],
    suitTwoPieceAttributes: new Map([["荒骷髅", `${critDamage}20%`]]),
  });
  closeTo(omaPanel.critDamage, 170, "逢魔一件套逐件生效");
  closeTo(
    calculateMetricValue(omaPanel, "damage"),
    170,
    "伤害指标需换算爆伤百分比",
  );

  assert.equal(
    satisfiesPanelConstraints(omaPanel, { critDamage: { min: 170, max: 170 } }),
    true,
    "面板上下限包含边界值",
  );
  assert.equal(
    satisfiesPanelConstraints(omaPanel, { critDamage: { max: 169.99 } }),
    false,
    "面板上限必须严格满足",
  );
}

run();
console.log("calculator domain checks passed");
