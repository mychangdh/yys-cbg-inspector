import {
  getRelicSubAttributeTotals,
  type RelicEvidence,
} from "@/lib/accountAnalysis";
import type { RelicView } from "@/types";

export function speedOf(relic: RelicView) {
  return getRelicSubAttributeTotals(relic).speed || 0;
}

export function displayMainAttribute(position: number, mainAttribute?: string) {
  if (position !== 4 && position !== 6) return "";
  return mainAttribute ? " · " + mainAttribute : "";
}

export function displayPvpDetailLabel(relic: RelicEvidence, suitName: string) {
  const mainAttribute = displayMainAttribute(
    relic.position,
    relic.mainAttribute,
  );
  if (relic.suitName === suitName) return mainAttribute;
  return mainAttribute
    ? mainAttribute + " · " + relic.suitName
    : " · " + relic.suitName;
}
