import { ArrowRightOutlined } from "@ant-design/icons";
import { buildEnhancementStages } from "@/lib/relics";
import { EnhancementStageCard } from "../EnhancementStageCard";
import type { RelicView } from "@/types";
import styles from "./index.module.scss";

type EnhancementTimelineProps = {
  item: RelicView;
  highlightedAttributes: ReadonlySet<string>;
};

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
    <div className={styles.scope}>
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
    </div>
  );
}
