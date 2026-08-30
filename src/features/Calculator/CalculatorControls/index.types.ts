import type { CalculatorMetric } from "@/lib/calculator/types";

export type MetricOption = { value: CalculatorMetric; label: string };

export type CalculatorControlsState = {
  running: boolean;
  heroName?: string;
  metric: CalculatorMetric;
  selectedSuitSummary: string;
  accountName?: string;
  serverName?: string;
  relicCount: number;
};

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
