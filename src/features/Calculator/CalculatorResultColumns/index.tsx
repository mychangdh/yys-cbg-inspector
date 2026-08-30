import "./index.scss";
import { EyeOutlined } from "@ant-design/icons";
import { Button, Tag } from "antd";
import type { CalculatorResult } from "@/lib/calculator/types";
import { format, metricPanelHighlights } from "../calculatorShared";
import type {
  CalculatorResultColumns,
  ResultColumnOptions,
} from "./index.types";

/** 构造结果表格列，避免工作区同时承担结果展示细节。 */
export function createCalculatorResultColumns({
  metric,
  metricLabel,
  hero,
  panelFields,
  isActivePanelConstraint,
  onSelectResult,
}: ResultColumnOptions): CalculatorResultColumns {
  return [
    {
      title: metricLabel,
      dataIndex: "score",
      key: "score",
      className: "calculator-metric-column",
      onHeaderCell: () => ({ className: "calculator-metric-column" }),
      render: (value: number, row: CalculatorResult) => (
        <strong className="calculator-score">
          {format(value, 2)}
          {metric === "speed" && (
            <small>
              （御魂 +
              {format(row.panel.speed - (hero?.baseStats.speed || 0), 2)}）
            </small>
          )}
        </strong>
      ),
    },
    {
      title: "套装",
      key: "suits",
      render: (_value: unknown, row: CalculatorResult) =>
        row.suits.length
          ? row.suits.map((suit) => <Tag key={suit}>{suit}</Tag>)
          : "散件",
    },
    ...panelFields
      .filter(({ key }) => key !== metric)
      .map(({ key, label, suffix }) => {
        const isMetricRelated = metricPanelHighlights[metric].includes(key);
        const isConstraintRelated = isActivePanelConstraint(key);
        const columnClassName = [
          isMetricRelated ? "calculator-metric-related-column" : "",
          isConstraintRelated ? "calculator-constraint-related-column" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return {
          title: label,
          key,
          className: columnClassName,
          onHeaderCell: () => ({ className: columnClassName }),
          render: (_value: unknown, row: CalculatorResult) => {
            const value = `${format(row.panel[key], 2)}${suffix || ""}`;
            if (key !== "speed") return value;
            return `${value}（御魂 +${format(row.panel.speed - (hero?.baseStats.speed || 0), 2)}）`;
          },
        };
      }),
    {
      title: "御魂详情",
      key: "relics",
      fixed: "right" as const,
      width: 88,
      render: (_value: unknown, row: CalculatorResult) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => onSelectResult(row)}
        >
          查看
        </Button>
      ),
    },
  ];
}
