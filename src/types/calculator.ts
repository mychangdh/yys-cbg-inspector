import type { TableProps } from "antd";
import type { Dispatch, SetStateAction } from "react";
import type {
  CalculatorExtraAttributeKey,
  CalculatorMetric,
  CalculatorResult,
  HeroBaseStats,
  PanelConstraintKey,
  RelicCalculationRequest,
} from "@/lib/calculator/types";
import type { HeroRecord, HeroStaticPayload } from "./hero";

export type { HeroRecord, HeroStaticPayload };

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

export type PanelField = {
  key: PanelConstraintKey;
  label: string;
  suffix?: string;
};

export type ExtraAttributeField = {
  key: CalculatorExtraAttributeKey;
  label: string;
  suffix?: string;
};

export type CalculatorPanelShortcut = {
  label: string;
  values: Partial<Record<PanelConstraintKey, { min?: number; max?: number }>>;
};

export type CalculatorMainAttributePreset = {
  label: string;
  icon?: "clear";
  mainAttributes: Partial<Record<2 | 4 | 6, string[]>>;
  metric?: CalculatorMetric;
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

export type ConfigPreview = {
  heroName: string;
  metric: string;
  suitSummary: string;
  mainAttributeSummary: string;
  constraintSummary?: string;
};

export type CalculatorConfigState = {
  saveOpen: boolean;
  libraryOpen: boolean;
  label: string;
  savedConfigs: SavedCalculatorConfig[];
  getPreview: (config: SavedCalculatorConfig) => ConfigPreview;
  apply: (config: SavedCalculatorConfig) => void;
  remove: (id: string) => void;
  save: () => void;
  setSaveOpen: (open: boolean) => void;
  setLibraryOpen: (open: boolean) => void;
  setLabel: (label: string) => void;
};

export type MainShortcutState = {
  open: boolean;
  editingId?: string;
  label: string;
  attributes: Partial<Record<2 | 4 | 6, string[]>>;
  options: Record<2 | 4 | 6, string[]>;
  shortcuts: CustomMainAttributeShortcut[];
  setOpen: (open: boolean) => void;
  setLabel: (label: string) => void;
  toggleAttribute: (position: 2 | 4 | 6, value: string) => void;
  save: () => void;
  edit: (shortcut: CustomMainAttributeShortcut) => void;
  remove: (id: string) => void;
};

export type PanelShortcutState = {
  open: boolean;
  editingId?: string;
  label: string;
  values: Partial<Record<PanelConstraintKey, { min?: number; max?: number }>>;
  baseStats?: HeroBaseStats;
  fields: PanelField[];
  shortcuts: CustomPanelShortcut[];
  setOpen: (open: boolean) => void;
  setLabel: (label: string) => void;
  setValues: Dispatch<
    SetStateAction<
      Partial<Record<PanelConstraintKey, { min?: number; max?: number }>>
    >
  >;
  save: () => void;
  edit: (shortcut: CustomPanelShortcut) => void;
  remove: (id: string) => void;
};

export type CalculatorConfigModalsProps = {
  config: CalculatorConfigState;
  mainShortcut: MainShortcutState;
  panelShortcut: PanelShortcutState;
};

export type CalculatorConstraintRanges = Partial<
  Record<PanelConstraintKey, { min?: number; max?: number }>
>;

export type CalculatorConstraintsState = {
  running: boolean;
  hero?: { baseStats: HeroBaseStats };
  metric: CalculatorMetric;
  metricIsPanelField: boolean;
  mainAttributes: Partial<Record<2 | 4 | 6, string[]>>;
  constraints: CalculatorConstraintRanges;
  extraAttributes: Record<CalculatorExtraAttributeKey, number>;
  extraAttributesOpen: boolean;
  fastMode: boolean;
  hasCompleteMainAttributeSelection: boolean;
  staticDataReady: boolean;
};

export type CalculatorConstraintsActions = {
  applyMainPreset: (preset: CalculatorMainAttributePreset) => void;
  toggleMainAttribute: (position: 2 | 4 | 6, value: string) => void;
  applyPanelShortcut: (values: CalculatorPanelShortcut["values"]) => void;
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
  options: {
    mainAttributePresets: CalculatorMainAttributePreset[];
    mainAttributeOptions: Record<2 | 4 | 6, string[]>;
    panelShortcuts: CalculatorPanelShortcut[];
    panelFields: PanelField[];
    extraAttributeFields: ExtraAttributeField[];
    savedCalculatorConfigs: SavedCalculatorConfig[];
  };
  actions: CalculatorConstraintsActions;
  commands: CalculatorConstraintsCommands;
};

export type MetricOption = { value: CalculatorMetric; label: string };

export type CalculatorControlsProps = {
  state: {
    running: boolean;
    heroName?: string;
    metric: CalculatorMetric;
    selectedSuitSummary: string;
    accountName?: string;
    serverName?: string;
    relicCount: number;
  };
  options: { metricOptions: MetricOption[] };
  actions: {
    onOpenHeroPicker: () => void;
    onMetricChange: (metric: CalculatorMetric) => void;
    onOpenSuitPicker: () => void;
  };
};

export type CalculatorHeroOption = {
  id: number;
  name: string;
  rarityCode?: number;
};

export type CalculatorHeroPickerProps = {
  state: {
    open: boolean;
    search: string;
    selectedHeroId?: number;
    disabled: boolean;
  };
  options: {
    recentHeroes: CalculatorHeroOption[];
    heroGroups: ReadonlyArray<readonly [number, CalculatorHeroOption[]]>;
    rarityLabels: Record<number, string>;
  };
  actions: {
    onSearchChange: (value: string) => void;
    onSelect: (hero: CalculatorHeroOption) => void;
  };
  commands: { onClose: () => void };
};

export type CalculatorHeroPortraitProps = {
  hero: CalculatorHeroOption;
};

export type CalculatorSuitOption = {
  id: number;
  name: string;
  twoPieceText: string;
  isOma: boolean;
};

export type CalculatorTwoPieceGroup = {
  label: string;
  suits: CalculatorSuitOption[];
};

export type CalculatorRecentRelicChoice = RecentRelicChoice;

export type CalculatorSuitPickerProps = {
  state: {
    open: boolean;
    running: boolean;
    fourPiece?: string;
    twoPieceAttributes: Set<string>;
    omaTwoPieces: Set<string>;
    selectedTwoPieceCount: number;
    selectedRelicSlots: number;
  };
  options: {
    suitTypes: CalculatorSuitOption[];
    twoPieceGroups: CalculatorTwoPieceGroup[];
    omaSuits: CalculatorSuitOption[];
    recentChoices: CalculatorRecentRelicChoice[];
  };
  actions: {
    onSelectFourPiece: (name: string) => void;
    onToggleTwoPieceAttribute: (attribute: string) => void;
    onToggleOmaTwoPiece: (name: string) => void;
  };
  commands: { onClose: () => void };
};

export type CalculatorNumericRange = { min?: number; max?: number };

export type CalculatorRangeFieldProps = {
  field: PanelConstraintKey;
  label: string;
  suffix?: string;
  minimum: number;
  range?: CalculatorNumericRange;
  emptyMinWhenUnset?: boolean;
  disabled?: boolean;
  onChange: (range: CalculatorNumericRange) => void;
};

export type CalculatorResultColumnOptions = {
  metric: CalculatorMetric;
  metricLabel: string;
  hero?: { baseStats: HeroBaseStats };
  panelFields: PanelField[];
  isActivePanelConstraint: (key: PanelConstraintKey) => boolean;
  onSelectResult: (result: CalculatorResult) => void;
};

export type CalculatorResultColumns = NonNullable<
  TableProps<CalculatorResult>["columns"]
>;

export type CalculatorResultsProps = {
  state: {
    hero?: { name: string; baseStats: HeroBaseStats };
    metric: CalculatorMetric;
    metricLabel: string;
    metricIsPanelField: boolean;
    results: CalculatorResult[];
    selectedResult?: CalculatorResult;
    running: boolean;
    elapsed?: number;
    fastMode: boolean;
    resultLimit: number;
    selectedFourPiece?: string;
    selectedTwoPieceAttributes: Set<string>;
    selectedOmaTwoPieces: Set<string>;
  };
  options: {
    columns: TableProps<CalculatorResult>["columns"];
    panelFields: PanelField[];
    panelBadgeLabels: Partial<Record<PanelConstraintKey, string>>;
  };
  selectors: {
    isMetricPanelRelated: (key: PanelConstraintKey) => boolean;
    isMetricSubAttribute: (label: string, metric: CalculatorMetric) => boolean;
    panelKeyForAttribute: (label: string) => PanelConstraintKey | undefined;
    isActivePanelConstraint: (key: PanelConstraintKey) => boolean;
  };
  actions: {
    onResultLimitChange: (value: number) => void;
    onSelectResult: (result?: CalculatorResult) => void;
  };
};

export type CalculatorRunningStateProps = {
  state: { running: boolean; fastMode: boolean };
  progress: {
    calculationProgress: number;
    calculationStage: "preparing" | "matching" | "validating" | "ranking";
    calculationProgressText: string;
  };
  commands: { onStop: () => void };
};

export type CalculatorStaticUpdateModalProps = {
  report?: StaticUpdateReport;
  onClose: () => void;
};
