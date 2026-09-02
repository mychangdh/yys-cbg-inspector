import { speedOf } from "../speedFormatters";
import type { FullSpeedCompactListProps } from "@/types";
import styles from "./index.module.scss";

export function FullSpeedCompactList({
  items,
  highlightedSuitNames,
}: FullSpeedCompactListProps) {
  const highlightedSuitNameSet = new Set(highlightedSuitNames);

  return (
    <div className={styles.scope}>
      <div className="full-speed-compact-list">
        {items.map((relic) => {
          const mainAttributeLabel = relic.mainAttribute?.label;
          return (
            <div
              className={
                "full-speed-compact-row" +
                (highlightedSuitNameSet.has(relic.suit?.name || "")
                  ? " is-highlighted-suit"
                  : "")
              }
              key={relic.id}
            >
              <span>
                <strong>{relic.suit?.name || "未知御魂"}</strong>
                {mainAttributeLabel && <small>[{mainAttributeLabel}]</small>}
              </span>
              <b>{speedOf(relic).toFixed(2)}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}
