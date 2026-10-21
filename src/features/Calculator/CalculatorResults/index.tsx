import { Card, Select, Table, Tag, Typography } from "antd";
import { CalculatorOutlined } from "@ant-design/icons";
import type { CalculatorResult } from "@/lib/calculator/types";
import type { CalculatorResultsProps } from "@/types";
import { CalculatorResultDetails } from "../CalculatorResultDetails";
import styles from "./index.module.scss";

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
                <Tag className="neutral-status-tag">
                  4件：{selectedFourPiece}
                </Tag>
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
      <CalculatorResultDetails
        result={selectedResult}
        hero={hero}
        metric={metric}
        metricLabel={metricLabel}
        metricIsPanelField={metricIsPanelField}
        panelFields={panelFields}
        isMetricPanelRelated={isMetricPanelRelated}
        isMetricSubAttribute={isMetricSubAttribute}
        panelKeyForAttribute={panelKeyForAttribute}
        isActivePanelConstraint={isActivePanelConstraint}
        onClose={() => setSelectedResult(undefined)}
      />
    </>
  );
}
