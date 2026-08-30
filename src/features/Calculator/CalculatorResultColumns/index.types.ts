import type {
  CalculatorMetric,
  CalculatorResult,
  HeroBaseStats,
  PanelConstraintKey,
} from "@/lib/calculator/types";
import type { TableProps } from "antd";
import type { PanelField } from "../calculatorShared";

export type ResultColumnOptions = {
  metric: CalculatorMetric;
  metricLabel: string;
  hero?: { baseStats: HeroBaseStats };
  results: CalculatorResult[];
  panelFields: PanelField[];
  isActivePanelConstraint: (key: PanelConstraintKey) => boolean;
  onSelectResult: (result: CalculatorResult) => void;
};

export type CalculatorResultColumns = NonNullable<
  TableProps<CalculatorResult>["columns"]
>;
