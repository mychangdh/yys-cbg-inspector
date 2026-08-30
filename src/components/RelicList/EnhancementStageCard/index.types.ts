import type { EnhancementStage, RelicView } from "@/types";

export type EnhancementStageCardProps = {
  item: RelicView;
  stage: EnhancementStage;
  highlightedAttributes: ReadonlySet<string>;
};
