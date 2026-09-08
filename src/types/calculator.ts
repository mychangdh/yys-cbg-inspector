import type { Dispatch, SetStateAction } from "react";
import type { TableProps } from "antd";
import type {
  CalculatorExtraAttributeKey,
  CalculatorMetric,
  CalculatorResult,
  HeroBaseStats,
  PanelConstraintKey,
  RelicCalculationRequest,
} from "@/lib/calculator/types";
import type { RelicDataset, RelicView } from "./index";

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

export type PanelField = {
  key: PanelConstraintKey;
  label: string;
  suffix?: string;
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

export type RelicConfigState = {
  saveOpen: boolean;
  libraryOpen: boolean;
  label: string;
  pendingResult?: CalculatorResult;
  savedRelics: RelicView[];
  openSave: (result: CalculatorResult) => void;
  save: () => void;
  setSaveOpen: (open: boolean) => void;
  setLibraryOpen: (open: boolean) => void;
  setLabel: (label: string) => void;
  removeGroup: (source: string) => void;
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

export type CalculatorWorkspaceProps = {
  dataset: RelicDataset;
  staticRefreshRequestId?: number;
};

export type CalculatorConfigPreview = {
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
  getPreview: (config: SavedCalculatorConfig) => CalculatorConfigPreview;
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
  relic: RelicConfigState;
  excluded: ExcludedRelicConfigPickerState;
  mainShortcut: MainShortcutState;
  panelShortcut: PanelShortcutState;
};

export type ExcludedRelicConfigPickerState = {
  open: boolean;
  selectedSources: string[];
  onChange: (sources: string[]) => void;
  onClear: () => void;
  onClose: () => void;
  onApply: () => void;
};

export type PanelFieldPreset = {
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
  savedRelicCount: number;
  excludedRelicCount: number;
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
  openSavedRelics: () => void;
  openExcludedRelics: () => void;
  run: () => void;
};

export type CalculatorConstraintsProps = {
  state: CalculatorConstraintsState;
  options: CalculatorConstraintsOptions;
  actions: CalculatorConstraintsActions;
  commands: CalculatorConstraintsCommands;
};

export type CalculatorControlsState = {
  running: boolean;
  heroName?: string;
  metric: CalculatorMetric;
  selectedSuitSummary: string;
  accountName?: string;
  serverName?: string;
  relicCount: number;
};

export type MetricOption = { value: CalculatorMetric; label: string };

export type CalculatorControlsOptions = {
  metricOptions: MetricOption[];
};

export type CalculatorControlsActions = {
  onOpenHeroPicker: () => void;
  onMetricChange: (metric: CalculatorMetric) => void;
  onOpenSuitPicker: () => void;
};

export type CalculatorControlsProps = {
  state: CalculatorControlsState;
  options: CalculatorControlsOptions;
  actions: CalculatorControlsActions;
};

export type CalculatorHeroOption = {
  id: number;
  name: string;
  rarityCode?: number;
};

export type CalculatorHeroPickerState = {
  open: boolean;
  search: string;
  selectedHeroId?: number;
  disabled: boolean;
};

export type CalculatorHeroPickerOptions = {
  recentHeroes: CalculatorHeroOption[];
  heroGroups: ReadonlyArray<readonly [number, CalculatorHeroOption[]]>;
  rarityLabels: Record<number, string>;
};

export type CalculatorHeroPickerActions = {
  onSearchChange: (value: string) => void;
  onSelect: (hero: CalculatorHeroOption) => void;
};

export type CalculatorHeroPickerCommands = {
  onClose: () => void;
};

export type CalculatorHeroPickerProps = {
  state: CalculatorHeroPickerState;
  options: CalculatorHeroPickerOptions;
  actions: CalculatorHeroPickerActions;
  commands: CalculatorHeroPickerCommands;
};

export type CalculatorHeroPortraitProps = {
  hero: CalculatorHeroOption;
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

export type ResultColumnOptions = {
  metric: CalculatorMetric;
  metricLabel: string;
  hero?: { baseStats: HeroBaseStats };
  results: CalculatorResult[];
  panelFields: PanelField[];
  isActivePanelConstraint: (key: PanelConstraintKey) => boolean;
  onSelectResult: (result: CalculatorResult) => void;
  onSaveResult: (result: CalculatorResult) => void;
};

export type CalculatorResultColumns = NonNullable<
  TableProps<CalculatorResult>["columns"]
>;

export type CalculatorResultsState = {
  hero?: { id?: number; name: string; baseStats: HeroBaseStats };
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

export type CalculatorResultsOptions = {
  columns: TableProps<CalculatorResult>["columns"];
  panelFields: PanelField[];
  panelBadgeLabels: Partial<Record<PanelConstraintKey, string>>;
};

export type CalculatorResultsSelectors = {
  isMetricPanelRelated: (key: PanelConstraintKey) => boolean;
  isMetricSubAttribute: (label: string, metric: CalculatorMetric) => boolean;
  panelKeyForAttribute: (label: string) => PanelConstraintKey | undefined;
  isActivePanelConstraint: (key: PanelConstraintKey) => boolean;
};

export type CalculatorResultsActions = {
  onResultLimitChange: (value: number) => void;
  onSelectResult: (result?: CalculatorResult) => void;
};

export type CalculatorResultsProps = {
  state: CalculatorResultsState;
  options: CalculatorResultsOptions;
  selectors: CalculatorResultsSelectors;
  actions: CalculatorResultsActions;
};

export type CalculatorRunningStateState = {
  running: boolean;
  fastMode: boolean;
};

export type CalculatorRunningStateProgress = {
  calculationProgress: number;
  calculationStage: "preparing" | "matching" | "validating" | "ranking";
  calculationProgressText: string;
};

export type CalculatorRunningStateCommands = {
  onStop: () => void;
};

export type CalculatorRunningStateProps = {
  state: CalculatorRunningStateState;
  progress: CalculatorRunningStateProgress;
  commands: CalculatorRunningStateCommands;
};

export type CalculatorStaticUpdateModalProps = {
  report?: StaticUpdateReport;
  onClose: () => void;
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

export type CalculatorRecentRelicChoice = {
  kind: "fourPiece" | "twoPieceAttribute" | "omaTwoPiece";
  value: string;
};

export type CalculatorSuitPickerState = {
  open: boolean;
  running: boolean;
  fourPiece?: string;
  twoPieceAttributes: Set<string>;
  omaTwoPieces: Set<string>;
  selectedTwoPieceCount: number;
  selectedRelicSlots: number;
};

export type CalculatorSuitPickerOptions = {
  suitTypes: CalculatorSuitOption[];
  twoPieceGroups: CalculatorTwoPieceGroup[];
  omaSuits: CalculatorSuitOption[];
  recentChoices: CalculatorRecentRelicChoice[];
};

export type CalculatorSuitPickerActions = {
  onSelectFourPiece: (name: string) => void;
  onToggleTwoPieceAttribute: (attribute: string) => void;
  onToggleOmaTwoPiece: (name: string) => void;
};

export type CalculatorSuitPickerCommands = {
  onClose: () => void;
};

export type CalculatorSuitPickerProps = {
  state: CalculatorSuitPickerState;
  options: CalculatorSuitPickerOptions;
  actions: CalculatorSuitPickerActions;
  commands: CalculatorSuitPickerCommands;
};
