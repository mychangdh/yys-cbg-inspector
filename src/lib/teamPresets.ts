import type {
  CalculatorExtraAttributeKey,
  CalculatorMetric,
  PanelConstraintKey,
} from "./calculator/types";
import type { TeamMemberConfig } from "@/types/team";

export type SavedTeamPreset = {
  id: string;
  label: string;
  members: TeamMemberConfig[];
};

export const teamPresetStorageKey = "yys-team-calculator-presets-v1";

const metrics: CalculatorMetric[] = [
  "attack",
  "health",
  "defense",
  "speed",
  "critRate",
  "critDamage",
  "effectHit",
  "effectResistance",
  "hitResistance",
  "damage",
  "healing",
  "defenseOutput",
];
const panelKeys: PanelConstraintKey[] = [
  "attack",
  "health",
  "defense",
  "speed",
  "critRate",
  "critDamage",
  "effectHit",
  "effectResistance",
];
const extraAttributeKeys: CalculatorExtraAttributeKey[] = [
  "attackPercent",
  "healthPercent",
  "defensePercent",
  "speed",
  "critRate",
  "critDamage",
  "effectHit",
  "effectResistance",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMainAttributes(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([position, attributes]) =>
        ["2", "4", "6"].includes(position) &&
        Array.isArray(attributes) &&
        attributes.every((attribute) => typeof attribute === "string"),
    )
  );
}

function isTeamMemberConfig(value: unknown): value is TeamMemberConfig {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !Number.isInteger(value.heroId) ||
    !metrics.includes(value.targetAttribute as CalculatorMetric) ||
    !isRecord(value.targetDirections) ||
    !isRecord(value.constraints) ||
    (value.mainAttributes !== undefined &&
      !isMainAttributes(value.mainAttributes)) ||
    !isRecord(value.extraAttributes) ||
    !Array.isArray(value.requiredTwoPieceAttributes) ||
    !value.requiredTwoPieceAttributes.every(
      (item) => typeof item === "string",
    ) ||
    !Array.isArray(value.requiredTwoPieceNames) ||
    !value.requiredTwoPieceNames.every((item) => typeof item === "string") ||
    (value.requiredFourPiece !== undefined &&
      typeof value.requiredFourPiece !== "string")
  ) {
    return false;
  }

  const extraAttributes = value.extraAttributes;
  return (
    Object.values(value.targetDirections).every((direction) =>
      ["none", "max", "min"].includes(String(direction)),
    ) &&
    Object.entries(value.constraints).every(([key, range]) => {
      if (!panelKeys.includes(key as PanelConstraintKey) || !isRecord(range))
        return false;
      const min = range.min;
      const max = range.max;
      return (
        (min === undefined ||
          (typeof min === "number" && Number.isFinite(min))) &&
        (max === undefined ||
          (typeof max === "number" && Number.isFinite(max))) &&
        (min === undefined || max === undefined || min <= max)
      );
    }) &&
    extraAttributeKeys.every(
      (key) =>
        typeof extraAttributes[key] === "number" &&
        Number.isFinite(extraAttributes[key]) &&
        extraAttributes[key] >= 0,
    )
  );
}

function isSavedTeamPreset(value: unknown): value is SavedTeamPreset {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Boolean(value.id.trim()) &&
    typeof value.label === "string" &&
    Boolean(value.label.trim()) &&
    Array.isArray(value.members) &&
    value.members.length > 0 &&
    value.members.length <= 20 &&
    value.members.every(isTeamMemberConfig)
  );
}

export function parseTeamPresets(serialized: string | null): SavedTeamPreset[] {
  if (!serialized) return [];
  try {
    const parsed: unknown = JSON.parse(serialized);
    return Array.isArray(parsed) ? parsed.filter(isSavedTeamPreset) : [];
  } catch {
    return [];
  }
}

export function loadSavedTeamPresets(): SavedTeamPreset[] {
  if (typeof window === "undefined") return [];
  try {
    return parseTeamPresets(window.localStorage.getItem(teamPresetStorageKey));
  } catch {
    return [];
  }
}
