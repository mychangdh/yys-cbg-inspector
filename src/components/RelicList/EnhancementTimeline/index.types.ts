import type { RelicView } from "@/types";

export type EnhancementTimelineProps = {
  item: RelicView;
  highlightedAttributes: ReadonlySet<string>;
};
