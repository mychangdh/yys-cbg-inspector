import assert from "node:assert/strict";

import {
  calculateMetricValue,
  calculateRelicPanel,
  calculateRelicCombinations,
  satisfiesPanelConstraints,
  type HeroBaseStats,
} from "../src/lib/relicCalculator";
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
 * 这些用例覆盖计算器不可改变的领域契约，而不是页面展示：
 * 百分比属性只能基于式神基础面板，精确副属性覆盖展示副属性，逢魔一件套逐件生效。
 */
function run(): void {
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
