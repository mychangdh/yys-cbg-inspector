import { getRelicSubAttributeTotals } from "@/lib/accountAnalysis";
import type { PositionSpeedDetailsProps } from "@/types/speed";
import "./index.scss";

function speedOf(relic: PositionSpeedDetailsProps["relics"][number]) {
  return getRelicSubAttributeTotals(relic).speed || 0;
}

function displayMainAttribute(position: number, mainAttribute?: string) {
  if (position !== 4 && position !== 6) return "";
  return mainAttribute ? " · " + mainAttribute : "";
}

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
