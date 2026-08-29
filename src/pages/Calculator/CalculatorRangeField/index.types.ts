import type { PanelConstraintKey } from "@/lib/calculator/types";

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
