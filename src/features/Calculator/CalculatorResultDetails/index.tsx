"use client";

import { Button, Grid, Modal, Tag } from "antd";
import { useEffect, useState } from "react";
import { RelicIcon } from "@/components/RelicIcon";
import { CalculatorHeroPortrait } from "../CalculatorHeroPicker/HeroPortrait";
import {
  formatAttribute,
  formatDetailedNumber,
  getDetailedSubAttributes,
} from "@/lib/relics";
import type {
  CalculatorMetric,
  CalculatorResult,
  HeroBaseStats,
  PanelConstraintKey,
} from "@/lib/calculator/types";
import type {
  CalculatorConstraintRanges,
  PanelField,
  RelicView,
} from "@/types";
import calculatorStyles from "../CalculatorResults/index.module.scss";
import styles from "./index.module.scss";

type CalculatorResultDetailsProps = {
  result?: CalculatorResult;
  hero?: { id?: number; name: string; baseStats: HeroBaseStats };
  metric: CalculatorMetric;
  metricLabel: string;
  metricIsPanelField: boolean;
  panelFields: PanelField[];
  panelConstraints?: CalculatorConstraintRanges;
  isMetricPanelRelated: (key: PanelConstraintKey) => boolean;
  isMetricSubAttribute: (label: string, metric: CalculatorMetric) => boolean;
  panelKeyForAttribute: (label: string) => PanelConstraintKey | undefined;
  isActivePanelConstraint: (key: PanelConstraintKey) => boolean;
  onClose: () => void;
};

function format(value: number, digits = 0) {
  return Number.isFinite(value)
    ? value.toLocaleString("zh-CN", { maximumFractionDigits: digits })
    : "-";
}

export function CalculatorResultDetails({
  result,
  hero,
  metric,
  metricLabel,
  metricIsPanelField,
  panelFields,
  panelConstraints,
  isMetricPanelRelated,
  isMetricSubAttribute,
  panelKeyForAttribute,
  isActivePanelConstraint,
  onClose,
}: CalculatorResultDetailsProps) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [selectedRelic, setSelectedRelic] = useState<RelicView>();
  const closeResultDetail = () => {
    setSelectedRelic(undefined);
    onClose();
  };
  const getAttributeHighlightClassName = (label: string) => {
    const panelKey = panelKeyForAttribute(label);

    return [
      isMetricSubAttribute(label, metric) ? "is-metric-related" : "",
      panelKey && isActivePanelConstraint(panelKey)
        ? "is-constraint-related"
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  };
  const activePanelConstraints = panelFields.flatMap(
    ({ key, label, suffix = "" }) => {
      const range = panelConstraints?.[key];
      const min =
        range?.min !== undefined && range.min > (hero?.baseStats[key] || 0)
          ? range.min
          : undefined;
      const max = range?.max;
      if (min === undefined && max === undefined) return [];
      return [
        {
          key,
          label,
          range: [
            min === undefined ? undefined : `≥ ${format(min, 2)}${suffix}`,
            max === undefined ? undefined : `≤ ${format(max, 2)}${suffix}`,
          ]
            .filter(Boolean)
            .join(" · "),
        },
      ];
    },
  );

  useEffect(() => {
    setSelectedRelic(undefined);
  }, [result]);

  return (
    <div className={styles.scope}>
      <Modal
        open={Boolean(result)}
        rootClassName={`${calculatorStyles.scope}${isMobile ? ` ${calculatorStyles.mobile}` : ""}`}
        title={`御魂组合详情 · ${hero?.name || "未选择式神"}`}
        footer={
          <Button onClick={closeResultDetail} type="primary">
            关闭
          </Button>
        }
        width={860}
        className="calculator-result-modal"
        onCancel={closeResultDetail}
      >
        {result && (
          <>
            <div className="calculator-result-detail-summary">
              <div className="calculator-result-detail-score">
                <strong>{metricLabel}</strong>
                {!metricIsPanelField && <span>{format(result.score, 2)}</span>}
              </div>
              {result.suits.length > 0 && (
                <div className="calculator-result-detail-suits">
                  {result.suits.map((suit) => (
                    <Tag key={suit}>{suit}</Tag>
                  ))}
                </div>
              )}
              {activePanelConstraints.length > 0 && (
                <div className="calculator-result-detail-constraints">
                  <strong>面板约束</strong>
                  {activePanelConstraints.map(({ key, label, range }) => (
                    <Tag key={key}>
                      {label} {range}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
            <div className="calculator-result-detail-main-layout">
              <section className="calculator-result-detail-section calculator-result-relic-section">
                <div className="calculator-result-detail-section-heading">
                  <strong>式神御魂</strong>
                  <span>点击御魂查看详情</span>
                </div>
                <div className="calculator-result-showcase">
                  <div className="calculator-result-showcase-grid">
                    {result.relics.map((relic, index) => (
                      <button
                        className={`calculator-result-showcase-item${selectedRelic === relic ? " is-selected" : ""}`}
                        key={relic.id || index}
                        type="button"
                        onClick={() => setSelectedRelic(relic)}
                        aria-label={`查看${relic.suit?.name || "未知御魂"}详情`}
                        aria-pressed={selectedRelic === relic}
                        data-position={relic.position || index + 1}
                      >
                        <RelicIcon item={relic} compact />
                      </button>
                    ))}
                  </div>
                  {hero?.id ? (
                    <div className="calculator-result-showcase-hero">
                      <CalculatorHeroPortrait
                        hero={{ id: hero.id, name: hero.name }}
                      />
                    </div>
                  ) : null}
                </div>
              </section>
              <section className="calculator-result-detail-section calculator-result-panel-section">
                <div className="calculator-result-detail-section-heading">
                  <strong>御魂总属性</strong>
                  <span>基础属性 / 御魂增量</span>
                </div>
                <div className="calculator-result-panel-card">
                  <div className="calculator-result-panel-card-rows">
                    {panelFields.map(({ key, label, suffix = "" }) => {
                      const isBreakdown = [
                        "attack",
                        "health",
                        "defense",
                        "speed",
                        "critRate",
                      ].includes(key);
                      const isConstraintRelated = isActivePanelConstraint(key);
                      const baseValue = hero?.baseStats[key] || 0;
                      const bonus = result.panel[key] - baseValue;
                      return (
                        <div
                          className={[
                            "calculator-result-panel-card-row",
                            isBreakdown ? "has-breakdown" : "",
                            isMetricPanelRelated(key) ? "is-related" : "",
                            isConstraintRelated ? "is-constraint-related" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          key={key}
                        >
                          <span>{label}</span>
                          <strong>
                            {isBreakdown ? (
                              <>
                                <b>
                                  {format(baseValue, 2)}
                                  {suffix}
                                </b>
                                <mark>
                                  +{format(bonus, 2)}
                                  {suffix}
                                </mark>
                              </>
                            ) : (
                              <>
                                {format(result.panel[key], 2)}
                                {suffix}
                              </>
                            )}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </Modal>
      <Modal
        open={Boolean(selectedRelic)}
        rootClassName={`${calculatorStyles.scope}${isMobile ? ` ${calculatorStyles.mobile}` : ""}`}
        className="calculator-relic-detail-modal"
        title="御魂详情"
        width={420}
        zIndex={1100}
        footer={
          <Button type="primary" onClick={() => setSelectedRelic(undefined)}>
            关闭
          </Button>
        }
        onCancel={() => setSelectedRelic(undefined)}
      >
        {selectedRelic && (
          <div className="calculator-relic-detail-content">
            <div className="calculator-relic-detail-heading">
              <RelicIcon item={selectedRelic} compact />
              <div>
                <strong>
                  {selectedRelic.suit?.name || "未知御魂"} +
                  {selectedRelic.level || 0}
                </strong>
                <span>
                  {selectedRelic.position
                    ? `${selectedRelic.position}号位`
                    : "位置未知"}
                </span>
              </div>
            </div>
            {selectedRelic.mainAttribute && (
              <div
                className={`calculator-relic-detail-main ${getAttributeHighlightClassName(selectedRelic.mainAttribute.label)}`}
              >
                <span>{selectedRelic.mainAttribute.label}</span>
                <strong>+{formatAttribute(selectedRelic.mainAttribute)}</strong>
              </div>
            )}
            <section className="calculator-relic-detail-attributes">
              <h3>副属性</h3>
              {(selectedRelic.subAttributes || []).map((attribute) => (
                <div
                  className={getAttributeHighlightClassName(attribute.label)}
                  key={attribute.label}
                >
                  <span>{attribute.label}</span>
                  <strong>+{formatAttribute(attribute)}</strong>
                </div>
              ))}
            </section>
            {getDetailedSubAttributes(selectedRelic).length > 0 && (
              <section className="calculator-relic-detail-rolls">
                <h3>强化记录</h3>
                {getDetailedSubAttributes(selectedRelic).map((attribute) => (
                  <div
                    className={getAttributeHighlightClassName(attribute.label)}
                    key={attribute.key}
                  >
                    <span>{attribute.label}</span>
                    <code>
                      {attribute.values
                        .map((value) => formatDetailedNumber(value))
                        .join(" + ")}
                    </code>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
