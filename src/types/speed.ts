import type { ReactNode } from "react";
import type { RelicEvidence } from "@/lib/accountAnalysis";
import type { RelicView } from "./relic";

export type SpeedCombinationPreview = {
  relics: RelicView[];
  speed: number;
};

export type SpeedCombinationOptions = {
  fourthMainAttributes?: readonly string[];
  sixthMainAttributes?: readonly string[];
};

export type SpeedSuitOption = {
  id: number;
  name: string;
};

export type PositionSpeedDetailsProps = {
  relics: RelicView[];
  highlightedMainAttributes?: Record<number, readonly string[] | undefined>;
};

export type PvpPositionSpeedDetailsProps = {
  relics: RelicEvidence[];
  suitName: string;
};

export type FullSpeedCompactListProps = {
  items: RelicView[];
  highlightedSuitNames: string[];
};

export type CollapseControlProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export type DetailToggleProps = {
  checked: boolean;
  className: string;
  onChange: (checked: boolean) => void;
};

export type CollapsiblePanelTitleProps = {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  onPointerDown?: () => void;
};

export type CollapsiblePanelContentProps = {
  collapsed: boolean;
  children: ReactNode;
};

export type PvpSuitPickerModalProps = {
  open: boolean;
  options: SpeedSuitOption[];
  selectedSuitNames: string[];
  onToggleSuit: (suitName: string) => void;
  onClose: () => void;
};
