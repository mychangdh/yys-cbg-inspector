import { Button, Card, Modal, Select, Table, Tag, Typography } from "antd";
import { CalculatorOutlined } from "@ant-design/icons";
import { RelicIcon } from "@/components/RelicIcon";
import { formatAttribute, sortAttributes } from "@/lib/relics";
import type { CalculatorResult } from "@/lib/calculator/types";
import type { CalculatorResultsProps } from "@/types";
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
  const { columns, panelFields, panelBadgeLabels } = options;
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
        rootClassName={styles.scope}
        title={`御魂组合详情 · ${hero?.name || "未选择式神"}`}
        footer={
          <Button onClick={() => setSelectedResult(undefined)} type="primary">
            关闭
          </Button>
        }
        width={860}
        className="calculator-result-modal"
        onCancel={() => setSelectedResult(undefined)}
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
            <section className="calculator-result-panel-card">
              <div className="calculator-result-panel-card-heading">
                <strong>最终面板</strong>
                <span>基础属性 / 御魂增量</span>
              </div>
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
                      <span>
                        <i aria-hidden="true">
                          {panelBadgeLabels[key] || label.slice(0, 1)}
                        </i>
                        {label}
                      </span>
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
            </section>
            <div className="calculator-result-detail-grid">
              {selectedResult.relics.map((relic, index) => (
                <section
                  className="calculator-result-detail-item"
                  key={relic.id || index}
                >
                  <div className="calculator-result-detail-head">
                    <div className="calculator-result-detail-identity">
                      <strong>
                        <span>{relic.suit?.name || "未知御魂"}</span>
                        <em>+{relic.level || 0}</em>
                      </strong>
                      <span className="calculator-result-detail-position">
                        {relic.position ? `${relic.position}号位` : "位置未知"}
                      </span>
                    </div>
                    <RelicIcon item={relic} compact />
                  </div>
                  <div className="calculator-result-detail-attributes">
                    {relic.mainAttribute &&
                      (() => {
                        const mainAttributeKey = panelKeyForAttribute(
                          relic.mainAttribute.label,
                        );
                        const isMainConstraintRelated = Boolean(
                          mainAttributeKey &&
                          isActivePanelConstraint(mainAttributeKey),
                        );
                        return (
                          <div
                            className={[
                              "is-main",
                              isMainConstraintRelated
                                ? "is-constraint-related"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <span>{relic.mainAttribute.label}</span>
                            <strong>
                              +{formatAttribute(relic.mainAttribute)}
                            </strong>
                          </div>
                        );
                      })()}
                    {sortAttributes(relic.subAttributes || []).map(
                      (attribute, attributeIndex) => {
                        const attributeKey = panelKeyForAttribute(
                          attribute.label,
                        );
                        const isMetricRelated = isMetricSubAttribute(
                          attribute.label,
                          metric,
                        );
                        const isConstraintRelated = Boolean(
                          attributeKey && isActivePanelConstraint(attributeKey),
                        );
                        return (
                          <div
                            className={[
                              isMetricRelated ? "is-metric-related" : "",
                              isConstraintRelated
                                ? "is-constraint-related"
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={`${attribute.label}-${attributeIndex}`}
                          >
                            <span>{attribute.label}</span>
                            <strong>+{formatAttribute(attribute)}</strong>
                          </div>
                        );
                      },
                    )}
                  </div>
                  <div
                    className={`calculator-result-detail-set-bonus${relic.setBonusAttribute ? "" : " is-empty"}`}
                  >
                    {relic.setBonusAttribute && (
                      <>
                        两件套：{relic.setBonusAttribute.label} +
                        {formatAttribute(relic.setBonusAttribute)}
                      </>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
