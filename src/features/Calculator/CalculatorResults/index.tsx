import {
  Button,
  Card,
  Grid,
  Modal,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import { CalculatorOutlined } from "@ant-design/icons";
import { useState } from "react";
import { RelicIcon } from "@/components/RelicIcon";
import { CalculatorHeroPortrait } from "../CalculatorHeroPicker/HeroPortrait";
import {
  formatAttribute,
  formatDetailedNumber,
  getDetailedSubAttributes,
} from "@/lib/relics";
import type { CalculatorResult } from "@/lib/calculator/types";
import type { CalculatorResultsProps, RelicView } from "@/types";
import styles from "./index.module.scss";

function format(value: number, digits = 0) {
  return Number.isFinite(value)
    ? value.toLocaleString("zh-CN", { maximumFractionDigits: digits })
    : "-";
}

/** 使用御魂组合生成稳定行键，避免依赖已废弃的 Table index 参数。 */
function getResultRowKey(result: CalculatorResult) {
  return result.relics
    .map((relic) => String(relic.id))
    .sort()
    .join("|");
}

/** 展示计算结果并提供单套组合详情。 */
export function CalculatorResults({
  state,
  options,
  selectors,
  actions,
}: CalculatorResultsProps) {
  const {
    hero,
    metric,
    metricLabel,
    metricIsPanelField,
    results,
    selectedResult,
    running,
    elapsed,
    fastMode,
    resultLimit,
    selectedFourPiece,
    selectedTwoPieceAttributes,
    selectedOmaTwoPieces,
  } = state;
  const { columns, panelFields } = options;
  const {
    isMetricPanelRelated,
    isMetricSubAttribute,
    panelKeyForAttribute,
    isActivePanelConstraint,
  } = selectors;
  const {
    onResultLimitChange: setResultLimit,
    onSelectResult: setSelectedResult,
  } = actions;
  const [selectedRelic, setSelectedRelic] = useState<RelicView>();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const closeResultDetail = () => {
    setSelectedResult(undefined);
    setSelectedRelic(undefined);
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

  return (
    <>
      <div className={styles.scope}>
        <Card className="calculator-summary">
          <div className="calculator-summary-head">
            <div>
              <CalculatorOutlined />
              <span>{hero?.name || "未选择式神"}</span>
              <Tag>{metricLabel}</Tag>
            </div>
            <Typography.Text
              type="secondary"
              className="calculator-summary-note"
            >
              <span>仅计算 满级6星御魂</span>
              <span>
                {elapsed === undefined
                  ? "，尚未计算"
                  : `，耗时 ${elapsed.toFixed(0)} ms`}
              </span>
            </Typography.Text>
          </div>
          {(selectedFourPiece ||
            selectedTwoPieceAttributes.size > 0 ||
            selectedOmaTwoPieces.size > 0) && (
            <div className="calculator-selected-suits">
              {selectedFourPiece && (
                <Tag color="red">4件：{selectedFourPiece}</Tag>
              )}
              {[...selectedTwoPieceAttributes].map((attribute) => (
                <Tag key={attribute}>2件：{attribute}</Tag>
              ))}
              {[...selectedOmaTwoPieces].map((name) => (
                <Tag key={name}>2件：{name}</Tag>
              ))}
            </div>
          )}
        </Card>
        <Card
          className="calculator-results"
          title={
            <div className="calculator-results-title">
              <div className="calculator-results-heading">
                <span>{`最优组合${results.length ? `（前 ${results.length}）` : ""}`}</span>
                <small>下次计算生效</small>
              </div>
              <div className="calculator-result-limit">
                <Select
                  aria-label="候选数量"
                  value={fastMode ? 1 : resultLimit}
                  disabled={running || fastMode}
                  options={(fastMode ? [1] : [3, 5, 10]).map((value) => ({
                    value,
                    label: value === 1 ? "最优 1 条" : `前 ${value} 条`,
                  }))}
                  onChange={setResultLimit}
                />
              </div>
            </div>
          }
        >
          <Table
            rowKey={getResultRowKey}
            size="small"
            pagination={false}
            scroll={{ x: 1720 }}
            columns={columns}
            dataSource={results}
            locale={{
              emptyText: running
                ? "正在计算..."
                : elapsed !== undefined
                  ? "没有满足全部条件的御魂组合"
                  : "选择条件后点击计算",
            }}
          />
        </Card>
      </div>
      <Modal
        open={Boolean(selectedResult)}
        rootClassName={`${styles.scope}${isMobile ? ` ${styles.mobile}` : ""}`}
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
        {selectedResult && (
          <>
            <div className="calculator-result-detail-summary">
              <div className="calculator-result-detail-score">
                <strong>{metricLabel}</strong>
                {!metricIsPanelField && (
                  <span>{format(selectedResult.score, 2)}</span>
                )}
              </div>
              {selectedResult.suits.length > 0 && (
                <div className="calculator-result-detail-suits">
                  {selectedResult.suits.map((suit) => (
                    <Tag key={suit}>{suit}</Tag>
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
                    {selectedResult.relics.map((relic, index) => (
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
                      const bonus = selectedResult.panel[key] - baseValue;
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
                                {format(selectedResult.panel[key], 2)}
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
        rootClassName={`${styles.scope}${isMobile ? ` ${styles.mobile}` : ""}`}
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
    </>
  );
}
