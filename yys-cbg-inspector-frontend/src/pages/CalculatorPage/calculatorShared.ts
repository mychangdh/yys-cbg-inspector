import type {
  CalculatorExtraAttributeKey,
  CalculatorMetric,
  HeroBaseStats,
  PanelConstraintKey,
  RelicCalculationRequest,
} from "../../lib/calculator/types";

export type HeroRecord = {
  id: number;
  name: string;
  rarityCode?: number;
  lowestRank?: number;
  isCollaboration?: boolean;
  baseStats: HeroBaseStats;
};
export type HeroStaticPayload = {
  heroesById?: Record<string, HeroRecord>;
};
export type SuitType = {
  id: number;
  name: string;
  twoPieceText: string;
  isOma: boolean;
};
export type CbgYuhunConfig = {
  yuhun_list?: Array<
    [
      id: number,
      name: string,
      slug: string,
      twoPieceText?: string,
      effectText?: string,
    ]
  >;
  two_suit_yuhun?: Record<string, string>;
};

export type StaticUpdateReport = {
  heroCount: number;
  suitCount: number;
};

export const rarityLabels: Record<number, string> = {
  6: "UR",
  5: "SP",
  4: "SSR",
  3: "SR",
  2: "R",
  1: "N",
};
export const metricOptions: { value: CalculatorMetric; label: string }[] = [
  { value: "damage", label: "伤害指标：攻击 × 暴击伤害" },
  { value: "speed", label: "速度" },
  { value: "attack", label: "攻击" },
  { value: "health", label: "生命" },
  { value: "defense", label: "防御" },
  { value: "critRate", label: "暴击" },
  { value: "critDamage", label: "暴击伤害" },
  { value: "effectHit", label: "效果命中" },
  { value: "effectResistance", label: "效果抵抗" },
  { value: "hitResistance", label: "命抗双修：命中 + 抵抗" },
  { value: "healing", label: "治疗量：生命 × 暴击伤害" },
  { value: "defenseOutput", label: "防御输出：防御 × 暴击伤害" },
];
export const metricPanelHighlights: Record<
  CalculatorMetric,
  PanelConstraintKey[]
> = {
  damage: ["attack", "critDamage"],
  healing: ["health", "critDamage"],
  defenseOutput: ["defense", "critDamage"],
  hitResistance: ["effectHit", "effectResistance"],
  attack: ["attack"],
  health: ["health"],
  defense: ["defense"],
  speed: ["speed"],
  critRate: ["critRate"],
  critDamage: ["critDamage"],
  effectHit: ["effectHit"],
  effectResistance: ["effectResistance"],
};

export const panelAttributeAliases: Record<string, PanelConstraintKey> = {
  攻击: "attack",
  攻击加成: "attack",
  生命: "health",
  生命加成: "health",
  防御: "defense",
  防御加成: "defense",
  速度: "speed",
  暴击: "critRate",
  暴击伤害: "critDamage",
  效果命中: "effectHit",
  效果抵抗: "effectResistance",
};

export function panelKeyForAttribute(
  label: string,
): PanelConstraintKey | undefined {
  return panelAttributeAliases[label];
}

export function isMetricSubAttribute(label: string, metric: CalculatorMetric) {
  const normalized = panelKeyForAttribute(label);
  return Boolean(
    normalized &&
    metricPanelHighlights[metric].includes(normalized as PanelConstraintKey),
  );
}

export type PanelField = {
  key: PanelConstraintKey;
  label: string;
  suffix?: string;
};

export const panelFields: PanelField[] = [
  { key: "attack", label: "攻击" },
  { key: "health", label: "生命" },
  { key: "defense", label: "防御" },
  { key: "speed", label: "速度" },
  { key: "critRate", label: "暴击", suffix: "%" },
  { key: "critDamage", label: "暴击伤害", suffix: "%" },
  { key: "effectHit", label: "效果命中", suffix: "%" },
  { key: "effectResistance", label: "效果抵抗", suffix: "%" },
];

export const extraAttributeFields: {
  key: CalculatorExtraAttributeKey;
  label: string;
  suffix?: string;
}[] = [
  { key: "attackPercent", label: "攻击加成", suffix: "%" },
  { key: "healthPercent", label: "生命加成", suffix: "%" },
  { key: "defensePercent", label: "防御加成", suffix: "%" },
  { key: "speed", label: "速度" },
  { key: "critRate", label: "暴击", suffix: "%" },
  { key: "critDamage", label: "暴击伤害", suffix: "%" },
  { key: "effectHit", label: "效果命中", suffix: "%" },
  { key: "effectResistance", label: "效果抵抗", suffix: "%" },
];

export const defaultExtraAttributes: Record<
  CalculatorExtraAttributeKey,
  number
> = {
  attackPercent: 0,
  healthPercent: 0,
  defensePercent: 0,
  speed: 0,
  critRate: 0,
  critDamage: 0,
  effectHit: 0,
  effectResistance: 0,
};

export const panelBadgeLabels: Partial<Record<PanelConstraintKey, string>> = {
  effectHit: "命",
  effectResistance: "抵",
};

export type CustomPanelShortcut = {
  id: string;
  label: string;
  values: Partial<Record<PanelConstraintKey, { min?: number; max?: number }>>;
};

export type CustomMainAttributeShortcut = {
  id: string;
  label: string;
  mainAttributes: Partial<Record<2 | 4 | 6, string[]>>;
};

export type SavedCalculatorConfig = {
  id: string;
  label: string;
  heroId?: number;
  metric: CalculatorMetric;
  resultLimit: number;
  constraints: Partial<
    Record<PanelConstraintKey, { min?: number; max?: number }>
  >;
  extraAttributes: Record<CalculatorExtraAttributeKey, number>;
  mainAttributes: Partial<Record<2 | 4 | 6, string[]>>;
  relicSuitSelection: {
    fourPiece?: string;
    twoPieceAttributes: string[];
    omaTwoPieces: string[];
  };
};

export type CalculationRequest = Omit<
  Required<RelicCalculationRequest>,
  "fixedSuitPhase" | "initialResults"
>;

export type RelicSuitSelection = {
  fourPiece?: string;
  twoPieceAttributes: Set<string>;
  omaTwoPieces: Set<string>;
};

export type RecentRelicChoice = {
  kind: "fourPiece" | "twoPieceAttribute" | "omaTwoPiece";
  value: string;
};

export const customShortcutStorageKey =
  "yys-cbg-inspector.calculator.shortcuts";
export const customMainShortcutStorageKey =
  "yys-cbg-inspector.calculator.main-attribute-shortcuts";
export const savedCalculatorConfigStorageKey =
  "yys-cbg-inspector.calculator.saved-configs";
export const recentHeroStorageKey =
  "yys-cbg-inspector.calculator.recent-heroes";
export const recentRelicStorageKey =
  "yys-cbg-inspector.calculator.recent-relics";
export const recentChoiceLimit = 8;
export const minimumCalculationNoticeDuration = 900;
const maxSavedCalculatorConfigs = 50;

export function loadCustomPanelShortcuts(): CustomPanelShortcut[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(customShortcutStorageKey) || "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): CustomPanelShortcut[] => {
      if (!item || typeof item !== "object") return [];
      const label = String(item.label || "").trim();
      if (!label) return [];
      const values: CustomPanelShortcut["values"] = {};
      panelFields.forEach(({ key }) => {
        const value = item.values?.[key];
        // 兼容旧版仅保存下限数字的快捷条件。
        if (typeof value === "number" && Number.isFinite(value)) {
          values[key] = { min: value };
          return;
        }
        if (!value || typeof value !== "object") return;
        const min = Number(value.min);
        const max = Number(value.max);
        if (Number.isFinite(min) || Number.isFinite(max)) {
          values[key] = {
            ...(Number.isFinite(min) ? { min } : {}),
            ...(Number.isFinite(max) ? { max } : {}),
          };
        }
      });
      return Object.keys(values).length
        ? [
            {
              id: String(item.id || `${Date.now()}-${label}`),
              label,
              values,
            },
          ]
        : [];
    });
  } catch {
    return [];
  }
}
export const mainAttributeOptions: Record<2 | 4 | 6, string[]> = {
  2: ["速度", "攻击加成", "生命加成", "防御加成"],
  4: ["攻击加成", "生命加成", "防御加成", "效果命中", "效果抵抗"],
  6: ["攻击加成", "生命加成", "防御加成", "暴击", "暴击伤害"],
};
export function allMainAttributes(): Partial<Record<2 | 4 | 6, string[]>> {
  return {
    2: [...mainAttributeOptions[2]],
    4: [...mainAttributeOptions[4]],
    6: [...mainAttributeOptions[6]],
  };
}

export function loadCustomMainAttributeShortcuts(): CustomMainAttributeShortcut[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(customMainShortcutStorageKey) || "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): CustomMainAttributeShortcut[] => {
      if (!item || typeof item !== "object") return [];
      const label = String(item.label || "").trim();
      const mainAttributes = ([2, 4, 6] as const).reduce<
        Partial<Record<2 | 4 | 6, string[]>>
      >((result, position) => {
        const selected = Array.isArray(item.mainAttributes?.[position])
          ? item.mainAttributes[position].filter(
              (value: unknown): value is string =>
                typeof value === "string" &&
                mainAttributeOptions[position].includes(value),
            )
          : [];
        if (selected.length) result[position] = selected;
        return result;
      }, {});
      if (
        !label ||
        !([2, 4, 6] as const).every(
          (position) => mainAttributes[position]?.length,
        )
      )
        return [];
      return [
        {
          id: String(item.id || `${Date.now()}-${label}`),
          label,
          mainAttributes,
        },
      ];
    });
  } catch {
    return [];
  }
}

export function loadSavedCalculatorConfigs(): SavedCalculatorConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(savedCalculatorConfigStorageKey) || "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed
      .slice(-maxSavedCalculatorConfigs)
      .flatMap((item): SavedCalculatorConfig[] => {
        if (!item || typeof item !== "object") return [];
        const candidate = item as Partial<SavedCalculatorConfig>;
        const label = String(candidate.label || "").trim();
        if (
          !label ||
          !metricOptions.some((option) => option.value === candidate.metric)
        )
          return [];

        const constraints: SavedCalculatorConfig["constraints"] = {};
        panelFields.forEach(({ key }) => {
          const range = candidate.constraints?.[key];
          if (!range || typeof range !== "object") return;
          const min = Number(range.min);
          const max = Number(range.max);
          if (Number.isFinite(min) || Number.isFinite(max)) {
            constraints[key] = {
              ...(Number.isFinite(min) ? { min } : {}),
              ...(Number.isFinite(max) ? { max } : {}),
            };
          }
        });

        const extraAttributes = { ...defaultExtraAttributes };
        extraAttributeFields.forEach(({ key }) => {
          const value = Number(candidate.extraAttributes?.[key]);
          if (Number.isFinite(value)) extraAttributes[key] = Math.max(0, value);
        });
        const mainAttributes = ([2, 4, 6] as const).reduce<
          SavedCalculatorConfig["mainAttributes"]
        >((result, position) => {
          const values = candidate.mainAttributes?.[position];
          if (!Array.isArray(values)) return result;
          const validValues = values.filter((value) =>
            mainAttributeOptions[position].includes(value),
          );
          if (validValues.length) result[position] = validValues;
          return result;
        }, {});
        if (
          !([2, 4, 6] as const).every(
            (position) => mainAttributes[position]?.length,
          )
        )
          return [];

        return [
          {
            id: String(candidate.id || `${Date.now()}-${label}`),
            label,
            heroId:
              typeof candidate.heroId === "number" &&
              Number.isFinite(candidate.heroId)
                ? candidate.heroId
                : undefined,
            metric: candidate.metric as CalculatorMetric,
            resultLimit:
              typeof candidate.resultLimit === "number" &&
              Number.isFinite(candidate.resultLimit)
                ? Math.min(50, Math.max(1, Math.floor(candidate.resultLimit)))
                : 5,
            constraints,
            extraAttributes,
            mainAttributes,
            relicSuitSelection: {
              fourPiece:
                typeof candidate.relicSuitSelection?.fourPiece === "string"
                  ? candidate.relicSuitSelection.fourPiece
                  : undefined,
              twoPieceAttributes: Array.isArray(
                candidate.relicSuitSelection?.twoPieceAttributes,
              )
                ? candidate.relicSuitSelection.twoPieceAttributes.filter(
                    (value): value is string => typeof value === "string",
                  )
                : [],
              omaTwoPieces: Array.isArray(
                candidate.relicSuitSelection?.omaTwoPieces,
              )
                ? candidate.relicSuitSelection.omaTwoPieces.filter(
                    (value): value is string => typeof value === "string",
                  )
                : [],
            },
          },
        ];
      });
  } catch {
    return [];
  }
}

export function loadRecentHeroIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(recentHeroStorageKey) || "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is number => typeof value === "number")
      .slice(0, recentChoiceLimit);
  } catch {
    return [];
  }
}

export function loadRecentRelicChoices(): RecentRelicChoice[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(recentRelicStorageKey) || "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is RecentRelicChoice =>
        Boolean(
          value &&
          typeof value === "object" &&
          ["fourPiece", "twoPieceAttribute", "omaTwoPiece"].includes(
            value.kind,
          ) &&
          typeof value.value === "string" &&
          value.value,
        ),
      )
      .slice(0, recentChoiceLimit);
  } catch {
    return [];
  }
}

export const twoPieceAttributeOrder = [
  "暴击15%",
  "攻击加成15%",
  "暴击伤害20%",
  "生命加成15%",
  "防御加成30%",
  "效果命中15%",
  "效果抵抗15%",
];
export const twoPieceAttributeOrderMap = new Map(
  twoPieceAttributeOrder.map((attribute, index) => [attribute, index]),
);
export let heroes: HeroRecord[] = [];
export function replaceHeroes(nextHeroes: HeroRecord[]) {
  heroes = nextHeroes;
}
export const defaultHero =
  heroes.find((hero) => hero.name === "须佐之男") || heroes[0];

export function format(value: number, digits = 0) {
  return Number.isFinite(value)
    ? value.toLocaleString("zh-CN", { maximumFractionDigits: digits })
    : "-";
}

export function basePanelConstraints(stats?: HeroBaseStats) {
  if (!stats) return {};
  return Object.fromEntries(
    panelFields.map(({ key }) => [key, { min: stats[key] }]),
  ) as Partial<Record<PanelConstraintKey, { min?: number; max?: number }>>;
}
