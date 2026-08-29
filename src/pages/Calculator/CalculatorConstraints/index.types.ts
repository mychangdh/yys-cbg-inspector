import type { Dispatch, SetStateAction } from "react";
import type {
  CalculatorExtraAttributeKey,
  CalculatorMetric,
  HeroBaseStats,
  PanelConstraintKey,
} from "@/lib/calculator/types";

export type PanelField = {
  key: PanelConstraintKey;
  label: string;
  suffix?: string;
};

export type ExtraField = {
  key: CalculatorExtraAttributeKey;
  label: string;
  suffix?: string;
};

export type MainPreset = {
  label: string;
  icon?: string;
  mainAttributes?: Partial<Record<2 | 4 | 6, string[]>>;
};

export type PanelShortcut = {
  label: string;
  values: Partial<Record<PanelConstraintKey, { min?: number; max?: number }>>;
};

export type CalculatorConstraintsState = {
  running: boolean;
  hero?: { baseStats: HeroBaseStats };
  metric: CalculatorMetric;
  metricIsPanelField: boolean;
  mainAttributes: Partial<Record<2 | 4 | 6, string[]>>;
  constraints: Partial<
    Record<PanelConstraintKey, { min?: number; max?: number }>
  >;
  extraAttributes: Record<CalculatorExtraAttributeKey, number>;
  extraAttributesOpen: boolean;
  fastMode: boolean;
  hasCompleteMainAttributeSelection: boolean;
  staticDataReady: boolean;
};

export type CalculatorConstraintsOptions = {
  mainAttributePresets: MainPreset[];
  mainAttributeOptions: Record<2 | 4 | 6, string[]>;
  panelShortcuts: PanelShortcut[];
  panelFields: PanelField[];
  extraAttributeFields: ExtraField[];
  savedCalculatorConfigs: unknown[];
};

export type CalculatorConstraintsActions = {
  applyMainPreset: (preset: MainPreset) => void;
  toggleMainAttribute: (position: 2 | 4 | 6, value: string) => void;
  applyPanelShortcut: (
    values: Partial<Record<PanelConstraintKey, { min?: number; max?: number }>>,
  ) => void;
  updateConstraintRange: (
    key: PanelConstraintKey,
    range: { min?: number; max?: number },
  ) => void;
  updateExtraAttribute: (
    key: CalculatorExtraAttributeKey,
    value: number | null,
  ) => void;
  setExtraAttributesOpen: Dispatch<SetStateAction<boolean>>;
  setFastMode: (value: boolean) => void;
};

export type CalculatorConstraintsCommands = {
  openMainShortcut: () => void;
  openPanelShortcut: () => void;
  clearPanelConstraints: () => void;
  clearExtraAttributes: () => void;
  openConfigLibrary: () => void;
  openSaveConfig: () => void;
  run: () => void;
};

export type CalculatorConstraintsProps = {
  state: CalculatorConstraintsState;
  options: CalculatorConstraintsOptions;
  actions: CalculatorConstraintsActions;
  commands: CalculatorConstraintsCommands;
};
