import type {
  CalculatorMetric,
  PanelConstraintKey,
} from "../lib/calculator/types";

export type CalculatorPanelShortcut = {
  label: string;
  values: Partial<Record<PanelConstraintKey, { min?: number; max?: number }>>;
};

// 在这里增加面板规则即可，页面会自动渲染，不需要修改页面组件。
export const calculatorPanelShortcuts: CalculatorPanelShortcut[] = [
  { label: "满暴", values: { critRate: { min: 100 } } },
  { label: "超星", values: { speed: { min: 128 } } },
];

export type CalculatorMainAttributePreset = {
  label: string;
  icon?: "clear";
  mainAttributes: Partial<Record<2 | 4 | 6, string[]>>;
  metric?: CalculatorMetric;
};

export const calculatorMainAttributePresets: CalculatorMainAttributePreset[] = [
  {
    label: "攻攻爆",
    metric: "damage",
    mainAttributes: {
      2: ["攻击加成"],
      4: ["攻击加成"],
      6: ["暴击", "暴击伤害"],
    },
  },
  {
    label: "生生爆",
    metric: "healing",
    mainAttributes: {
      2: ["生命加成"],
      4: ["生命加成"],
      6: ["暴击", "暴击伤害"],
    },
  },
  {
    label: "纯速度",
    mainAttributes: {
      2: ["速度"],
      4: ["攻击加成", "生命加成", "防御加成", "效果命中", "效果抵抗"],
      6: ["攻击加成", "生命加成", "防御加成", "暴击", "暴击伤害"],
    },
    metric: "speed",
  },
  {
    label: "清空",
    icon: "clear",
    mainAttributes: {},
  },
];
