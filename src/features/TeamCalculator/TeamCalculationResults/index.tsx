import { EyeOutlined } from "@ant-design/icons";
import { Button, Card, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import { useEffect, useState } from "react";
import { CalculatorHeroPortrait } from "@/features/Calculator/CalculatorHeroPicker/HeroPortrait";
import { CalculatorResultDetails } from "@/features/Calculator/CalculatorResultDetails";
import {
  format,
  isMetricSubAttribute,
  metricOptions,
  metricPanelHighlights,
  panelKeyForAttribute,
  panelFields,
} from "@/features/Calculator/calculatorShared";
import type { HeroRecord, TeamMemberCalculationResult } from "@/types";
import styles from "./index.module.scss";

type TeamCalculationResultsProps = {
  results: TeamMemberCalculationResult[];
  heroById: ReadonlyMap<number, HeroRecord>;
  running: boolean;
};

function getMetricLabel(metric: string) {
  return metricOptions.find(({ value }) => value === metric)?.label || metric;
}

function formatResult(value: number, suffix = "") {
  return `${format(value, 2)}${suffix}`;
}

/** 以计算器结果表的形式展示全队面板，并提供每名式神的御魂详情。 */
export function TeamCalculationResults({
  results,
  heroById,
  running,
}: TeamCalculationResultsProps) {
  const [selectedMember, setSelectedMember] =
    useState<TeamMemberCalculationResult>();
  const selectedHero = selectedMember
    ? heroById.get(selectedMember.config.heroId)
    : undefined;
  const selectedMetric = selectedMember?.config.targetAttribute || "speed";

  useEffect(() => {
    if (
      selectedMember &&
      !results.some((item) => item.config.id === selectedMember.config.id)
    ) {
      setSelectedMember(undefined);
    }
  }, [results, selectedMember]);

  const columns: TableColumnsType<TeamMemberCalculationResult> = [
    {
      title: "式神",
      key: "hero",
      fixed: "left",
      width: 150,
      render: (_value, row) => (
        <div className={styles.heroCell}>
          <CalculatorHeroPortrait
            hero={{ id: row.config.heroId, name: row.heroName }}
          />
          <strong>{row.heroName}</strong>
        </div>
      ),
    },
    {
      title: "计算目标",
      key: "metric",
      width: 190,
      render: (_value, row) => getMetricLabel(row.config.targetAttribute),
    },
    {
      title: "目标值",
      key: "score",
      width: 120,
      className: styles.scoreCell,
      render: (_value, row) => formatResult(row.result.score),
    },
    {
      title: "御魂套装",
      key: "suits",
      width: 190,
      render: (_value, row) =>
        row.result.suits.length ? (
          <div className={styles.suits}>
            {row.result.suits.map((suit) => (
              <Tag key={suit}>{suit}</Tag>
            ))}
          </div>
        ) : (
          "散件"
        ),
    },
    ...panelFields.map(({ key, label, suffix }) => ({
      title: label,
      key,
      width: 116,
      render: (_value: unknown, row: TeamMemberCalculationResult) =>
        formatResult(row.result.panel[key], suffix),
    })),
    {
      title: "御魂方案",
      key: "details",
      fixed: "right",
      width: 128,
      render: (_value, row) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => setSelectedMember(row)}
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card
        className={styles.resultsCard}
        title={
          <div className={styles.cardHeading}>
            <span>计算结果</span>
            {results.length > 0 && <Tag>{results.length} 名式神已匹配</Tag>}
          </div>
        }
      >
        <Table<TeamMemberCalculationResult>
          rowKey={(row) => row.config.id}
          size="small"
          pagination={false}
          loading={running}
          scroll={{ x: 1760 }}
          columns={columns}
          dataSource={results}
          locale={{
            emptyText: running
              ? "正在计算队伍搭配…"
              : "点击「一键计算」后，这里会显示全队面板和御魂方案",
          }}
        />
      </Card>

      <CalculatorResultDetails
        result={selectedMember?.result}
        hero={selectedHero}
        metric={selectedMetric}
        metricLabel={getMetricLabel(selectedMetric)}
        metricIsPanelField={panelFields.some(
          ({ key }) => key === selectedMetric,
        )}
        panelFields={panelFields}
        panelConstraints={selectedMember?.config.constraints}
        isMetricPanelRelated={(key) =>
          metricPanelHighlights[selectedMetric].includes(key)
        }
        isMetricSubAttribute={isMetricSubAttribute}
        panelKeyForAttribute={panelKeyForAttribute}
        isActivePanelConstraint={(key) => {
          const range = selectedMember?.config.constraints[key];
          const baseValue = selectedHero?.baseStats[key] || 0;
          return Boolean(
            (range?.min !== undefined && range.min > baseValue) ||
            range?.max !== undefined,
          );
        }}
        onClose={() => setSelectedMember(undefined)}
      />
    </>
  );
}
