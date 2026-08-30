import { speedOf, displayMainAttribute } from "../speedFormatters";
import type { PositionSpeedDetailsProps } from "../index.types";
import "./index.scss";

export function PositionSpeedDetails({
  relics,
  highlightedMainAttributes = {},
}: PositionSpeedDetailsProps) {
  return (
    <div className="speed-combination-positions">
      {relics.map((relic) => (
        <span
          className={
            highlightedMainAttributes[relic.position || 0]?.includes(
              relic.mainAttribute?.label || "",
            )
              ? "is-tail"
              : ""
          }
          key={relic.id || String(relic.position)}
        >
          {speedOf(relic).toFixed(2)}
          {displayMainAttribute(
            relic.position || 0,
            relic.mainAttribute?.label,
          )}
        </span>
      ))}
    </div>
  );
}
