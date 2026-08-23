import type {
  CalculatorFilters,
  CalculatorMetric,
  CalculatedPanel,
  HeroBaseStats,
  PanelConstraintKey,
} from "./types";
import type { SuitCounts } from "./fixedSuitState";

export function constraintsForSearch(
  filters: CalculatorFilters,
  metric: CalculatorMetric,
): CalculatorFilters["panelConstraints"] {
  if (
    !(
      metric === "damage" ||
      metric === "healing" ||
      metric === "defenseOutput"
    ) ||
    (filters.panelConstraints?.critRate?.min || 0) < 100
  ) {
    return filters.panelConstraints;
  }
  const { critRate: _critRate, ...constraints } =
    filters.panelConstraints || {};
  return constraints;
}

export function requirementSignature(
  suitCounts: SuitCounts,
  filters: CalculatorFilters,
): string {
  const parts: string[] = [];
  if (filters.requiredFourPiece) {
    parts.push(
      `four:${Math.min(suitCounts[filters.requiredFourPiece] || 0, 4)}`,
    );
  }
  for (const name of [...(filters.requiredTwoPieceNames || [])].sort()) {
    parts.push(`name:${name}:${Math.min(suitCounts[name] || 0, 2)}`);
  }
  for (const attribute of [
    ...(filters.requiredTwoPieceAttributes || []),
  ].sort()) {
    const matchingCount = Math.max(
      0,
      ...Object.entries(suitCounts)
        .filter(
          ([name]) =>
            name !== filters.requiredFourPiece &&
            filters.suitTwoPieceAttributes?.get(name) === attribute,
        )
        .map(([, count]) => count),
    );
    parts.push(`attribute:${attribute}:${Math.min(matchingCount, 2)}`);
  }
  return parts.join("|") || "all";
}

export function panelConstraintProgress(
  panel: CalculatedPanel,
  constraints: CalculatorFilters["panelConstraints"],
  base: HeroBaseStats,
): number {
  let progress = 0;
  for (const [rawKey, range] of Object.entries(constraints || {})) {
    const key = rawKey as PanelConstraintKey;
    const actual = panel[key];
    if (range?.min !== undefined && range.min > base[key]) {
      progress += Math.min(actual / Math.max(Math.abs(range.min), 1), 1);
    }
    if (range?.max !== undefined) {
      const scale = Math.max(Math.abs(range.max), 1);
      progress +=
        actual <= range.max ? 1 : -Math.abs(actual - range.max) / scale;
    }
  }
  return progress;
}

export function panelConstraintBucketSignature(
  panel: CalculatedPanel,
  constraints: CalculatorFilters["panelConstraints"],
  base: HeroBaseStats,
  bucketCount = 4,
): string {
  return Object.entries(constraints || {})
    .filter(([rawKey, range]) => {
      const key = rawKey as PanelConstraintKey;
      return range?.min !== undefined && range.min > base[key];
    })
    .map(([rawKey, range]) => {
      const key = rawKey as PanelConstraintKey;
      const min = range?.min || base[key];
      const progress = Math.max(
        0,
        Math.min(1, (panel[key] - base[key]) / (min - base[key])),
      );
      return `${key}:${Math.floor(progress * bucketCount)}`;
    })
    .join("|");
}
