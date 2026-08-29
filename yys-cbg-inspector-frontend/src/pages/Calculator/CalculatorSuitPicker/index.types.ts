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
