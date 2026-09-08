import { getRelicSubAttributeTotals } from "@/lib/accountAnalysis";
import type { FullSpeedCompactListProps } from "@/types/speed";
import "./index.scss";

export function FullSpeedCompactList({
  items,
  highlightedSuitNames,
}: FullSpeedCompactListProps) {
  const highlightedSuitNameSet = new Set(highlightedSuitNames);

  return (
    <div className="full-speed-compact-list">
      {items.map((relic) => {
        const mainAttributeLabel = relic.mainAttribute?.label;
        const speed = getRelicSubAttributeTotals(relic).speed || 0;
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
            <b>{speed.toFixed(2)}</b>
          </div>
        );
      })}
    </div>
  );
}
