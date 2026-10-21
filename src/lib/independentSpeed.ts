import {
  getBestScatteredSpeedCombination,
  getBestSpeedCombinationForSuit,
  type SpeedCombination,
} from "./accountAnalysis";
import type { RelicDataset } from "@/types";

export type IndependentSpeedConfig = {
  id: string;
  suitName?: string;
  fourthMainAttributes: string[];
  sixthMainAttributes: string[];
};

export type IndependentSpeedPreset = {
  id: string;
  name: string;
  configs: IndependentSpeedConfig[];
};

export type IndependentSpeedResult = {
  configId: string;
  combination: SpeedCombination | null;
};

export const independentSpeedPresetStorageKey =
  "yys-cbg-inspector.independent-speed-presets-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isIndependentSpeedConfig(
  value: unknown,
): value is IndependentSpeedConfig {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Boolean(value.id.trim()) &&
    (value.suitName === undefined || typeof value.suitName === "string") &&
    isStringArray(value.fourthMainAttributes) &&
    isStringArray(value.sixthMainAttributes)
  );
}

function isIndependentSpeedPreset(
  value: unknown,
): value is IndependentSpeedPreset {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    !Array.isArray(value.configs) ||
    !value.configs.length ||
    !value.configs.every(isIndependentSpeedConfig)
  ) {
    return false;
  }

  return (
    new Set(value.configs.map((config) => config.id)).size ===
    value.configs.length
  );
}

export function parseIndependentSpeedPresets(
  serialized: string | null,
): IndependentSpeedPreset[] {
  if (!serialized) return [];
  try {
    const parsed: unknown = JSON.parse(serialized);
    return Array.isArray(parsed) ? parsed.filter(isIndependentSpeedPreset) : [];
  } catch {
    return [];
  }
}

/** 逐套计算，并将已使用的御魂从后续套件候选中排除。 */
export function calculateIndependentSpeed(
  dataset: RelicDataset,
  configs: readonly IndependentSpeedConfig[],
): IndependentSpeedResult[] {
  const usedRelicIds = new Set<string>();
  const relicsByPosition = Object.fromEntries(
    Object.entries(dataset.relicsByPosition || {}).map(([position, relics]) => [
      position,
      relics.map((relic, index) =>
        relic.id ? relic : { ...relic, id: `independent-${position}-${index}` },
      ),
    ]),
  );

  return configs.map((config) => {
    const availableDataset: RelicDataset = {
      ...dataset,
      relicsByPosition: Object.fromEntries(
        Object.entries(relicsByPosition).map(([position, relics]) => [
          position,
          relics.filter((relic) => !usedRelicIds.has(relic.id || "")),
        ]),
      ),
    };
    const options = {
      fourthMainAttributes: config.fourthMainAttributes,
      sixthMainAttributes: config.sixthMainAttributes,
    };
    const combination = config.suitName
      ? getBestSpeedCombinationForSuit(
          availableDataset,
          config.suitName,
          options,
        )
      : getBestScatteredSpeedCombination(availableDataset, options);

    combination?.relics.forEach(({ relicId }) => {
      if (relicId) usedRelicIds.add(relicId);
    });

    return { configId: config.id, combination };
  });
}
