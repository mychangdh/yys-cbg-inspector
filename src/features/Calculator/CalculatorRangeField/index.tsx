import { InputNumber, Slider } from "antd";
import type { PanelConstraintKey } from "@/lib/calculator/types";
import styles from "./index.module.scss";
import type {
  CalculatorNumericRange,
  CalculatorRangeFieldProps,
} from "@/types";

const MAX_SUB_ATTRIBUTE_VALUE: Record<PanelConstraintKey, number> = {
  attack: 16,
  health: 114,
  defense: 5,
  speed: 3,
  critRate: 3,
  critDamage: 4,
  effectHit: 4,
  effectResistance: 4,
};

const MAX_MAIN_PERCENT = 55;
const MAX_TWO_PIECE_PERCENT = 15;
const MAX_SUB_ATTRIBUTE_SEGMENTS = 6;

/**
 * 按六星 +15 御魂的理论极限给数轴划定上限。
 * 每件御魂最多包含初始词条加五次强化，共六段副属性成长；
 * 2/4/6 号位各可提供一次百分比主属性，且最多叠加三组两件套。
 */
export function relicPanelCeiling(
  field: PanelConstraintKey,
  baseValue: number,
): number {
  const subAttributeTotal =
    MAX_SUB_ATTRIBUTE_VALUE[field] * 6 * MAX_SUB_ATTRIBUTE_SEGMENTS;

  if (field === "speed") return baseValue + 57 + subAttributeTotal;
  if (field === "critRate") {
    return baseValue + 55 + subAttributeTotal + MAX_TWO_PIECE_PERCENT * 3;
  }
  if (field === "critDamage") return baseValue + 85 + subAttributeTotal;
  if (field === "effectHit" || field === "effectResistance") {
    return baseValue + 55 + subAttributeTotal + MAX_TWO_PIECE_PERCENT * 3;
  }

  const fixedMainAttribute =
    field === "attack" ? 486 : field === "health" ? 2052 : 114;
  const percentageBonus = MAX_MAIN_PERCENT * 3 + MAX_TWO_PIECE_PERCENT * 3;
  return (
    baseValue * (1 + percentageBonus * 0.01) +
    fixedMainAttribute +
    subAttributeTotal
  );
}

function getStep(field: PanelConstraintKey): number {
  return field === "attack" || field === "health" || field === "defense"
    ? 1
    : 0.01;
}

function roundToFieldPrecision(value: number, step: number): number {
  const digits = step === 1 ? 0 : 2;
  return Number(value.toFixed(digits));
}

function formatRangeValue(value: number, step: number): string {
  const digits = step === 1 ? 0 : 2;
  return Number(value.toFixed(digits)).toString();
}

function normalizeRange(
  value: CalculatorNumericRange,
  minimum: number,
  maximum: number,
  step: number,
): CalculatorNumericRange {
  const min = roundToFieldPrecision(
    Math.min(Math.max(value.min ?? minimum, minimum), maximum),
    step,
  );
  return {
    min,
    max:
      value.max === undefined
        ? undefined
        : roundToFieldPrecision(
            Math.min(Math.max(value.max, min), maximum),
            step,
          ),
  };
}

export function CalculatorRangeField({
  field,
  label,
  suffix,
  minimum,
  range,
  emptyMinWhenUnset = false,
  disabled = false,
  onChange,
}: CalculatorRangeFieldProps) {
  const step = getStep(field);
  const sliderMaximum = roundToFieldPrecision(
    relicPanelCeiling(field, minimum),
    step,
  );
  const normalized = normalizeRange(range || {}, minimum, sliderMaximum, step);
  const visualRange: [number, number] = [
    normalized.min ?? roundToFieldPrecision(minimum, step),
    normalized.max ?? sliderMaximum,
  ];
  const updateBound = (bound: "min" | "max", value: number | null) => {
    const next = {
      ...(range || {}),
      [bound]: value === null ? undefined : Number(value),
    };
    const normalizedNext = normalizeRange(next, minimum, sliderMaximum, step);
    onChange({
      min:
        emptyMinWhenUnset && next.min === undefined
          ? undefined
          : normalizedNext.min,
      max: normalizedNext.max,
    });
  };

  return (
    <div className={styles.scope}>
      <div className="calculator-range-field">
        <label className="calculator-range-field__label">{`${label}${suffix || ""}`}</label>
        <div className="calculator-range-field__body">
          <div className="calculator-range-field__slider">
            <Slider
              range
              min={minimum}
              max={sliderMaximum}
              step={step}
              value={visualRange}
              disabled={disabled}
              tooltip={{
                formatter: (value) =>
                  `${formatRangeValue(value ?? minimum, step)}${suffix || ""}`,
              }}
              onChange={(value) => {
                const [nextMin, nextMax] = value as [number, number];
                const normalizedNext = normalizeRange(
                  { min: nextMin, max: nextMax },
                  minimum,
                  sliderMaximum,
                  step,
                );
                onChange({
                  min: normalizedNext.min,
                  // 右端位于理论上限时表示不设上限，避免每个范围默认增加限制。
                  max:
                    normalizedNext.max !== undefined &&
                    normalizedNext.max >= sliderMaximum
                      ? undefined
                      : normalizedNext.max,
                });
              }}
            />
            <div className="calculator-range-field__scale" aria-hidden="true">
              <span>{`${formatRangeValue(visualRange[0], step)}${suffix || ""}`}</span>
              <span>{`${formatRangeValue(visualRange[1], step)}${suffix || ""}`}</span>
            </div>
          </div>
          <div className="calculator-range-field__inputs">
            <InputNumber
              min={minimum}
              max={sliderMaximum}
              step={step}
              value={
                emptyMinWhenUnset && range?.min === undefined
                  ? undefined
                  : normalized.min
              }
              placeholder="下限"
              disabled={disabled}
              onChange={(value) => updateBound("min", value)}
            />
            <span>-</span>
            <InputNumber
              min={normalized.min ?? minimum}
              max={sliderMaximum}
              step={step}
              value={normalized.max ?? sliderMaximum}
              placeholder="上限"
              disabled={disabled}
              onChange={(value) => updateBound("max", value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
