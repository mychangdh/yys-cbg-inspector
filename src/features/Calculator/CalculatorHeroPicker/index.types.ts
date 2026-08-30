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
