import type { RelicSuitOption } from "../index.types";

export type RelicSuitPickerModalProps = {
  open: boolean;
  search: string;
  options: RelicSuitOption[];
  selectedSuitNames: string[];
  onSearchChange: (value: string) => void;
  onToggleSuit: (name: string) => void;
  onClose: () => void;
};
