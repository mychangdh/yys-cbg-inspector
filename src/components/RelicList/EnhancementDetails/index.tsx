import { ArrowLeftOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { useRef, useState } from "react";
import { buildEnhancementStages } from "@/lib/relics";
import { EnhancementStageCard } from "../EnhancementStageCard";
import type { RelicView } from "@/types";
import styles from "./index.module.scss";

type EnhancementDetailsProps = {
  item: RelicView;
  highlightedAttributes: ReadonlySet<string>;
};

export function EnhancementDetails({
  item,
  highlightedAttributes,
}: EnhancementDetailsProps) {
  const stages =
    item.detail?.enhancementStages ||
    buildEnhancementStages(
      item.detail?.growthRolls,
      item.level,
      item.mainAttribute,
      item.quality,
    ).enhancementStages;
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeStage = stages[activeIndex] || stages[0];

  const switchStage = (nextIndex: number) => {
    const safeIndex = Math.max(0, Math.min(stages.length - 1, nextIndex));
    setActiveIndex(safeIndex);
    trackRef.current?.children[safeIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  };

  return (
    <div className={styles.scope}>
      <section className="enhance-mobile-switcher" aria-label="强化过程">
        <div className="enhance-mobile-switcher-controls">
          <button
            type="button"
            aria-label="上一强化阶段"
            disabled={activeIndex === 0}
            onClick={() => switchStage(activeIndex - 1)}
          >
            <ArrowLeftOutlined />
          </button>
          <strong>+{activeStage?.level ?? 0}</strong>
          <button
            type="button"
            aria-label="下一强化阶段"
            disabled={activeIndex >= stages.length - 1}
            onClick={() => switchStage(activeIndex + 1)}
          >
            <ArrowRightOutlined />
          </button>
        </div>
        <div
          className="enhance-mobile-stage-track"
          ref={trackRef}
          onScroll={(event) => {
            const width = event.currentTarget.clientWidth;
            if (!width) return;
            setActiveIndex(
              Math.max(
                0,
                Math.min(
                  stages.length - 1,
                  Math.round(event.currentTarget.scrollLeft / width),
                ),
              ),
            );
          }}
        >
          {stages.map((stage) => (
            <div className="enhance-mobile-stage-slide" key={stage.level}>
              <EnhancementStageCard
                item={item}
                stage={stage}
                highlightedAttributes={highlightedAttributes}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
