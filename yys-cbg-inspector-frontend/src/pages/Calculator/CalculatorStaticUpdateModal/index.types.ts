import type { StaticUpdateReport } from "../calculatorShared";

export type CalculatorStaticUpdateModalProps = {
  report?: StaticUpdateReport;
  onClose: () => void;
};
