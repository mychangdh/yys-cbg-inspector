import { displayPvpDetailLabel } from "../speedFormatters";
import type { PvpPositionSpeedDetailsProps } from "../index.types";
import "./index.scss";

export function PvpPositionSpeedDetails({
  relics,
  suitName,
}: PvpPositionSpeedDetailsProps) {
  return (
    <div className="speed-combination-positions">
      {relics.map((relic) => (
        <span
          className={relic.suitName === suitName ? "is-target-suit" : ""}
          key={relic.relicId || String(relic.position)}
        >
          {relic.value.toFixed(2)}
          {displayPvpDetailLabel(relic, suitName)}
        </span>
      ))}
    </div>
  );
}
