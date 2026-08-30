import type { PanelConstraintKey } from "@/lib/calculator/types";

export type CalculatorConstraintRanges = Partial<
  Record<PanelConstraintKey, { min?: number; max?: number }>
>;
