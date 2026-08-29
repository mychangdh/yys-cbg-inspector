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
