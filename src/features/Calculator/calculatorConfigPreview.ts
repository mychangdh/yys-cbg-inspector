import { format, heroes, metricOptions, panelFields } from "./calculatorShared";
import type { SavedCalculatorConfig } from "@/types";

/** 生成已保存计算配置的摘要，供配置库列表预览使用。 */
export function getCalculatorConfigPreview(config: SavedCalculatorConfig) {
  const configHero = heroes.find((item) => item.id === config.heroId);
  const configMetric =
    metricOptions.find((option) => option.value === config.metric)?.label ||
    "计算指标";
  const suitSummary = [
    ...(config.relicSuitSelection.fourPiece
      ? [`4件 ${config.relicSuitSelection.fourPiece}`]
      : []),
    ...config.relicSuitSelection.twoPieceAttributes.map(
      (attribute) => `2件 ${attribute}`,
    ),
    ...config.relicSuitSelection.omaTwoPieces.map((name) => `2件 ${name}`),
  ].join(" / ");
  const mainAttributeSummary = ([2, 4, 6] as const)
    .map((position) => {
      const values = config.mainAttributes[position] || [];
      return values.length ? `${position}号：${values.join("/")}` : "";
    })
    .filter(Boolean)
    .join(" · ");
  const constraintSummary = panelFields
    .flatMap(({ key, label, suffix }) => {
      const range = config.constraints[key];
      const baseValue = configHero?.baseStats[key] || 0;
      const entries: string[] = [];
      if (range?.min !== undefined && range.min > baseValue) {
        entries.push(`${label}${suffix || ""}≥${format(range.min, 2)}`);
      }
      if (range?.max !== undefined) {
        entries.push(`${label}${suffix || ""}≤${format(range.max, 2)}`);
      }
      return entries;
    })
    .slice(0, 3)
    .join(" · ");

  return {
    heroName: configHero?.name || "未指定式神",
    metric: configMetric,
    suitSummary: suitSummary || "全部御魂类型",
    mainAttributeSummary,
    constraintSummary,
  };
}
