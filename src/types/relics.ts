import type { ReactNode } from "react";
import type { EnhancementStage, RelicDataset, RelicView } from "./index";

export type RelicIconProps = {
  item: RelicView;
  compact?: boolean;
  displayLevel?: number;
  showLevelBadge?: boolean;
};

export type RelicListProps = {
  items: RelicView[];
  highlightedSubAttributes: string[];
  highlightedSuitNames?: string[];
  desktopColumns?: number;
  desktopRows?: number;
  disablePagination?: boolean;
  interactive?: boolean;
  compact?: boolean;
  itemBadge?: (item: RelicView) => ReactNode;
  hiddenMainAttributePositions?: number[];
  mobileTextOnly?: boolean;
};

export type EnhancementDetailsProps = {
  item: RelicView;
  highlightedAttributes: ReadonlySet<string>;
};

export type EnhancementStageCardProps = {
  item: RelicView;
  stage: EnhancementStage;
  stageIndex: number;
  highlightedAttributes: ReadonlySet<string>;
};

export type RelicsPageProps = {
  dataset: RelicDataset;
};
