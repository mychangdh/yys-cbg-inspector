import type { TableProps } from "antd";
import type {
  CalculatorMetric,
  CalculatorResult,
  HeroBaseStats,
  PanelConstraintKey,
} from "@/lib/calculator/types";

export type PanelField = {
  key: PanelConstraintKey;
  label: string;
  suffix?: string;
};

export type CalculatorResultsState = {
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
