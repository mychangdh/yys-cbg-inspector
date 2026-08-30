import { ArrowRightOutlined } from "@ant-design/icons";
import { buildEnhancementStages } from "@/lib/relics";
import { EnhancementStageCard } from "../EnhancementStageCard";
import type { EnhancementTimelineProps } from "./index.types";
import "./index.scss";

export function EnhancementTimeline({
  item,
  highlightedAttributes,
}: EnhancementTimelineProps) {
  const stages =
    item.detail?.enhancementStages ||
    buildEnhancementStages(
      item.detail?.growthRolls,
      item.level,
      item.mainAttribute,
      item.quality,
    ).enhancementStages;

  return (
    <div className="enhance-timeline">
      {stages.map((stage, index) => (
        <div className="enhance-stage-flow" key={stage.level}>
          <EnhancementStageCard
            item={item}
            stage={stage}
            highlightedAttributes={highlightedAttributes}
          />
          {index < stages.length - 1 && (
            <ArrowRightOutlined className="enhance-stage-arrow" />
          )}
        </div>
      ))}
    </div>
  );
}
