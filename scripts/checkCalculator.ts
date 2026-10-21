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
  calculatePanelMetric,
  isPanelShortcutActive,
  satisfiesPanelRange,
  togglePanelShortcutConstraints,
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
import { calculateTeam } from "../src/lib/teamCalculator";
import { parseTeamPresets } from "../src/lib/teamPresets";
import type { TeamCalculationMember } from "../src/types/team";

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

  const critRateShortcut = { critRate: { min: 100 } };
  const shortcutApplied = togglePanelShortcutConstraints(
    {},
    critRateShortcut,
    baseStats,
  );
  assert.equal(
    isPanelShortcutActive(shortcutApplied, critRateShortcut),
    true,
    "队伍计算快捷筛选应用后应显示为选中",
  );
  const shortcutCleared = togglePanelShortcutConstraints(
    shortcutApplied,
    critRateShortcut,
    baseStats,
  );
  assert.equal(
    isPanelShortcutActive(shortcutCleared, critRateShortcut),
    false,
    "再次点击队伍计算快捷筛选应恢复基础面板范围",
  );
  assert.equal(shortcutCleared.critRate?.min, baseStats.critRate);

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

  const teamRelicsByPosition = Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((position) => [
      String(position),
      [
        ...Array.from({ length: 44 }, (_, index) =>
          relic(`distractor-${position}-${index}`, "干扰套", {
            position,
            subAttributes: [{ label: speed, value: 20, isPercent: false }],
          }),
        ),
        relic(`required-${position}`, "目标四件套", {
          position,
          subAttributes: [{ label: speed, value: 10, isPercent: false }],
        }),
      ],
    ]),
  );
  const teamResult = calculateTeam({
    members: [
      {
        config: {
          id: "team-test",
          heroId: 1,
          targetAttribute: "damage",
          targetDirections: { attack: "max", critDamage: "max" },
          constraints: {},
          extraAttributes: {
            attackPercent: 0,
            healthPercent: 0,
            defensePercent: 0,
            speed: 0,
            critRate: 0,
            critDamage: 0,
            effectHit: 0,
            effectResistance: 0,
          },
          requiredFourPiece: "目标四件套",
          requiredTwoPieceAttributes: [],
          requiredTwoPieceNames: [],
        },
        heroName: "测试式神",
        baseStats,
      },
    ],
    relicsByPosition: teamRelicsByPosition,
    suitTwoPieceAttributes: {},
  });
  assert.equal(
    teamResult.members[0].result.relics.filter(
      (item) => item.suit?.name === "目标四件套",
    ).length,
    4,
    "队伍候选裁剪必须保留可满足硬性四件套要求的组合",
  );
  assert.equal(
    teamResult.members[0].result.score,
    calculatePanelMetric(teamResult.members[0].result.panel, "damage"),
    "队伍优化目标应支持计算器的派生指标",
  );

  const mainAttributeResult = calculateTeam({
    members: [
      {
        config: {
          ...teamResult.members[0].config,
          id: "main-attribute-test",
          targetAttribute: "speed",
          requiredFourPiece: undefined,
          mainAttributes: {
            2: [attackPercent],
            4: [attackPercent],
            6: [attackPercent],
          },
        },
        heroName: "主属性筛选测试",
        baseStats,
      },
    ],
    relicsByPosition: Object.fromEntries(
      [1, 2, 3, 4, 5, 6].map((position) => [
        String(position),
        position === 2
          ? [
              relic("main-attack", "主属性测试", {
                position,
                mainAttribute: {
                  label: attackPercent,
                  value: 55,
                  isPercent: true,
                },
              }),
              relic("main-speed", "主属性测试", {
                position,
                mainAttribute: { label: speed, value: 57, isPercent: false },
              }),
            ]
          : [
              relic(`main-other-${position}`, "主属性测试", {
                position,
                mainAttribute:
                  position === 4 || position === 6
                    ? {
                        label: attackPercent,
                        value: 55,
                        isPercent: true,
                      }
                    : null,
              }),
            ],
      ]),
    ),
    suitTwoPieceAttributes: {},
  });
  assert.ok(
    mainAttributeResult.members[0].result.relics.find(
      (item) => item.position === 2,
    )?.mainAttribute?.label === attackPercent,
    "队伍计算必须排除不符合 2 号位主属性约束的御魂",
  );
  assert.throws(
    () =>
      calculateTeam({
        members: [
          {
            config: {
              ...teamResult.members[0].config,
              mainAttributes: { 2: [] },
            },
            heroName: "未选主属性测试",
            baseStats,
          },
        ],
        relicsByPosition: teamRelicsByPosition,
        suitTwoPieceAttributes: {},
      }),
    /2 \/ 4 \/ 6 号位主属性都至少需要选择一项/,
    "号位主属性为空时不得按不限制条件继续计算",
  );

  const priorityRelicsByPosition = Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((position) => [
      String(position),
      [
        relic(`fast-high-attack-${position}`, "优先套", {
          position,
          subAttributes: [
            { label: speed, value: 11, isPercent: false },
            { label: attack, value: 100, isPercent: false },
          ],
        }),
        relic(`slow-low-attack-${position}`, "优先套", {
          position,
          subAttributes: [
            { label: speed, value: 10, isPercent: false },
            { label: attack, value: 0, isPercent: false },
          ],
        }),
        relic(`fast-low-attack-${position}`, "优先套", {
          position,
          subAttributes: [
            { label: speed, value: 11, isPercent: false },
            { label: attack, value: 0, isPercent: false },
          ],
        }),
      ],
    ]),
  );
  const priorityResult = calculateTeam({
    members: [
      {
        config: {
          id: "priority-test",
          heroId: 1,
          targetAttribute: "speed",
          targetDirections: { speed: "max", attack: "min" },
          constraints: {},
          extraAttributes: {
            attackPercent: 0,
            healthPercent: 0,
            defensePercent: 0,
            speed: 0,
            critRate: 0,
            critDamage: 0,
            effectHit: 0,
            effectResistance: 0,
          },
          requiredTwoPieceAttributes: [],
          requiredTwoPieceNames: [],
        },
        heroName: "优先级测试",
        baseStats,
      },
    ],
    relicsByPosition: priorityRelicsByPosition,
    suitTwoPieceAttributes: {},
  });
  assert.equal(
    priorityResult.members[0].result.panel.speed,
    baseStats.speed + 11 * 6,
    "计算目标的面板属性优先于其他方向",
  );
  assert.equal(
    priorityResult.members[0].result.score,
    calculatePanelMetric(priorityResult.members[0].result.panel, "speed"),
    "选择速度作为计算目标时结果分数必须使用速度指标",
  );
  assert.equal(
    priorityResult.members[0].result.panel.attack,
    baseStats.attack,
    "相同计算目标下应继续按其他启用方向排序",
  );

  const maxObjectiveRelicsByPosition = Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((position) => [
      String(position),
      [0, 1, 2, 3].map((variant) =>
        relic(`direction-frontier-${position}-${variant}`, "方向测试套", {
          position,
          subAttributes: [
            { label: speed, value: 11, isPercent: false },
            { label: attack, value: variant * 100, isPercent: false },
            {
              label: critDamage,
              value: (3 - variant) * 60,
              isPercent: false,
            },
          ],
        }),
      ),
    ]),
  );
  const maxObjectiveMember: TeamCalculationMember = {
    config: {
      ...teamResult.members[0].config,
      id: "max-objective-frontier",
      targetAttribute: "speed",
      targetDirections: { attack: "max" },
      constraints: {},
      requiredFourPiece: undefined,
      requiredTwoPieceAttributes: [],
      requiredTwoPieceNames: [],
    },
    heroName: "最大方向测试",
    baseStats,
  };
  const maxObjectiveRequest = {
    members: [maxObjectiveMember],
    relicsByPosition: maxObjectiveRelicsByPosition,
    suitTwoPieceAttributes: {},
  };
  const maxObjectiveResult = calculateTeam(maxObjectiveRequest);
  const maxObjectiveWithoutDirection = calculateTeam({
    ...maxObjectiveRequest,
    members: [
      {
        ...maxObjectiveMember,
        config: { ...maxObjectiveMember.config, targetDirections: {} },
      },
    ],
  });
  assert.equal(
    maxObjectiveResult.members[0].result.panel.speed,
    baseStats.speed + 11 * 6,
    "最大方向不应改变该属性的计算结果",
  );
  assert.equal(
    maxObjectiveResult.members[0].result.panel.attack,
    baseStats.attack + 300 * 6,
    "最大方向的候选不能在主目标 Top-N 截断前丢失",
  );
  assert.ok(
    maxObjectiveResult.members[0].result.panel.attack >
      maxObjectiveWithoutDirection.members[0].result.panel.attack,
    "开启攻击最大后应优先选择同速度面板中攻击更高的方案",
  );

  const conflictingObjectiveMember: TeamCalculationMember = {
    ...maxObjectiveMember,
    config: {
      ...maxObjectiveMember.config,
      id: "conflicting-objectives",
      targetAttribute: "damage",
    },
    baseStats: { ...baseStats, attack: 1000 },
  };
  const conflictingObjectiveRequest = {
    ...maxObjectiveRequest,
    members: [conflictingObjectiveMember],
  };
  const conflictingObjectiveResult = calculateTeam(conflictingObjectiveRequest)
    .members[0].result;
  const damagePriorityResult = calculateTeam({
    ...conflictingObjectiveRequest,
    members: [
      {
        ...conflictingObjectiveMember,
        config: {
          ...conflictingObjectiveMember.config,
          targetDirections: {},
        },
      },
    ],
  }).members[0].result;
  assert.equal(
    conflictingObjectiveResult.panel.attack,
    2800,
    "攻击最大必须优先于冲突的伤害计算目标",
  );
  assert.ok(
    conflictingObjectiveResult.score < damagePriorityResult.score,
    "启用攻击最大时允许选择伤害较低但攻击更高的方案",
  );
  assert.equal(
    conflictingObjectiveResult.score,
    calculatePanelMetric(conflictingObjectiveResult.panel, "damage"),
    "最大方向优先后仍需展示真实伤害指标分数",
  );

  const duplicateHeroMember = {
    config: {
      id: "duplicate-hero",
      heroId: 609,
      targetAttribute: "speed",
      targetDirections: { speed: "max" },
      constraints: { speed: { min: 120 } },
      extraAttributes: {
        attackPercent: 0,
        healthPercent: 0,
        defensePercent: 0,
        speed: 0,
        critRate: 0,
        critDamage: 0,
        effectHit: 0,
        effectResistance: 0,
      },
      requiredTwoPieceAttributes: [],
      requiredTwoPieceNames: [],
    },
    heroName: "咲耶",
    baseStats,
  } satisfies TeamCalculationMember;
  const duplicateHeroRelicsByPosition = Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((position) => [
      String(position),
      [10, 9, 8].map((value) =>
        relic(`team-${position}-${value}`, "速度套", {
          position,
          subAttributes: [{ label: speed, value, isPercent: false }],
        }),
      ),
    ]),
  );
  const duplicateHeroResult = calculateTeam({
    members: ["duplicate-1", "duplicate-2"].map((id) => ({
      ...duplicateHeroMember,
      config: { ...duplicateHeroMember.config, id },
    })),
    relicsByPosition: duplicateHeroRelicsByPosition,
    suitTwoPieceAttributes: {},
  });
  const duplicateHeroRelicIds = duplicateHeroResult.members.flatMap((member) =>
    member.result.relics.map((item) => item.id),
  );
  assert.equal(
    new Set(duplicateHeroRelicIds).size,
    12,
    "两名相同式神应在不重复使用御魂的前提下找到各自方案",
  );
  assert.ok(
    duplicateHeroResult.members.every(
      (member) => member.result.panel.speed >= 120,
    ),
    "重复式神的候选重算仍需满足各自面板下限",
  );
  assert.equal(
    duplicateHeroResult.members[0].result.panel.speed,
    baseStats.speed + 10 * 6,
    "优先级靠前的式神应先获得其最大方向对应的御魂",
  );
  assert.equal(
    duplicateHeroResult.members[1].result.panel.speed,
    baseStats.speed + 9 * 6,
    "后续式神应在排除前序已用御魂后继续计算",
  );

  assert.throws(
    () =>
      calculateTeam({
        members: [
          { ...duplicateHeroMember, heroName: "优先式神" },
          {
            ...duplicateHeroMember,
            config: { ...duplicateHeroMember.config, id: "later-member" },
            heroName: "后续式神",
          },
        ],
        relicsByPosition: Object.fromEntries(
          [1, 2, 3, 4, 5, 6].map((position) => [
            String(position),
            [
              relic(`only-${position}`, "唯一套", {
                position,
                subAttributes: [{ label: speed, value: 11, isPercent: false }],
              }),
            ],
          ]),
        ),
        suitTwoPieceAttributes: {},
      }),
    /后续式神.*没有符合要求的剩余御魂方案/,
    "前序分配后无解时应明确提示无法计算的后续式神",
  );

  const parsedTeamPresets = parseTeamPresets(
    JSON.stringify([
      {
        id: "preset-1",
        label: "双咲耶",
        members: [duplicateHeroMember.config],
      },
      { id: "invalid", label: "损坏预设", members: [{ id: "broken" }] },
    ]),
  );
  assert.deepEqual(
    parsedTeamPresets.map(({ id }) => id),
    ["preset-1"],
    "队伍预设读取应保留有效配置并跳过损坏条目",
  );
  assert.deepEqual(parseTeamPresets("{invalid json"), []);
}

run();
console.log("calculator domain checks passed");
