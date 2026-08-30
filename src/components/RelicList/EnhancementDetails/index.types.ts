import type { RelicView } from "@/types";

export type EnhancementDetailsProps = {
  item: RelicView;
  highlightedAttributes: ReadonlySet<string>;
};
