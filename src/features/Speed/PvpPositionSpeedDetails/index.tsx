import { displayPvpDetailLabel } from "../speedFormatters";
import type { PvpPositionSpeedDetailsProps } from "@/types";
import styles from "./index.module.scss";

export function PvpPositionSpeedDetails({
  relics,
  suitName,
}: PvpPositionSpeedDetailsProps) {
  return (
    <div className={styles.scope}>
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
    </div>
  );
}
