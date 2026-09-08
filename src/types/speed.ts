import type { RelicEvidence } from "@/lib/accountAnalysis";
import type { ReactNode } from "react";
import type { RelicDataset, RelicView } from "./index";

export type SpeedPageProps = {
  dataset: RelicDataset;
  onOpenCalculator: () => void;
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
