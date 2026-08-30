import type { ReactNode } from "react";
import type { RelicView } from "@/types";

export type RelicListProps = {
  items: RelicView[];
  highlightedSubAttributes: string[];
  highlightedSuitNames?: string[];
  desktopColumns?: number;
  desktopRows?: number;
  mobileSwipePagination?: boolean;
  mobilePageSize?: number;
  disablePagination?: boolean;
  itemBadge?: (item: RelicView) => ReactNode;
  hiddenMainAttributePositions?: number[];
};
