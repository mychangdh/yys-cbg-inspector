import type { Dispatch, SetStateAction } from "react";
import type { HeroBaseStats, PanelConstraintKey } from "@/lib/calculator/types";
import type {
  CustomMainAttributeShortcut,
  CustomPanelShortcut,
  PanelField,
  SavedCalculatorConfig,
} from "../calculatorShared";

export type ConfigPreview = {
  heroName: string;
  metric: string;
  suitSummary: string;
  mainAttributeSummary: string;
  constraintSummary?: string;
};

export type CalculatorConfigState = {
  saveOpen: boolean;
  libraryOpen: boolean;
  label: string;
  savedConfigs: SavedCalculatorConfig[];
  getPreview: (config: SavedCalculatorConfig) => ConfigPreview;
  apply: (config: SavedCalculatorConfig) => void;
  remove: (id: string) => void;
  save: () => void;
  setSaveOpen: (open: boolean) => void;
  setLibraryOpen: (open: boolean) => void;
  setLabel: (label: string) => void;
};

export type MainShortcutState = {
  open: boolean;
  editingId?: string;
  label: string;
  attributes: Partial<Record<2 | 4 | 6, string[]>>;
  options: Record<2 | 4 | 6, string[]>;
  shortcuts: CustomMainAttributeShortcut[];
  setOpen: (open: boolean) => void;
  setLabel: (label: string) => void;
  toggleAttribute: (position: 2 | 4 | 6, value: string) => void;
  save: () => void;
  edit: (shortcut: CustomMainAttributeShortcut) => void;
  remove: (id: string) => void;
};

export type PanelShortcutState = {
  open: boolean;
  editingId?: string;
  label: string;
  values: Partial<Record<PanelConstraintKey, { min?: number; max?: number }>>;
  baseStats?: HeroBaseStats;
  fields: PanelField[];
  shortcuts: CustomPanelShortcut[];
  setOpen: (open: boolean) => void;
  setLabel: (label: string) => void;
  setValues: Dispatch<
    SetStateAction<
      Partial<Record<PanelConstraintKey, { min?: number; max?: number }>>
    >
  >;
  save: () => void;
  edit: (shortcut: CustomPanelShortcut) => void;
  remove: (id: string) => void;
};

export type CalculatorConfigModalsProps = {
  config: CalculatorConfigState;
  mainShortcut: MainShortcutState;
  panelShortcut: PanelShortcutState;
};
