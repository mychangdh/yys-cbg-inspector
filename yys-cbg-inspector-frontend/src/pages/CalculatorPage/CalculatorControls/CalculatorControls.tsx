import { Button, Card, Col, Row, Select, Typography } from "antd";
import type { CalculatorMetric } from "../../../lib/calculator/types";

type MetricOption = { value: CalculatorMetric; label: string };

type CalculatorControlsState = {
  running: boolean;
  heroName?: string;
  metric: CalculatorMetric;
  selectedSuitSummary: string;
  accountName?: string;
  serverName?: string;
  relicCount: number;
};

type CalculatorControlsOptions = {
  metricOptions: MetricOption[];
};

type CalculatorControlsActions = {
  onOpenHeroPicker: () => void;
  onMetricChange: (metric: CalculatorMetric) => void;
  onOpenSuitPicker: () => void;
};

type CalculatorControlsProps = {
  state: CalculatorControlsState;
  options: CalculatorControlsOptions;
  actions: CalculatorControlsActions;
};

/** 计算器顶部信息与条件入口。 */
export function CalculatorControls({
  state,
  options,
  actions,
}: CalculatorControlsProps) {
  const {
    running,
    heroName,
    metric,
    selectedSuitSummary,
    accountName,
    serverName,
    relicCount,
  } = state;
  const { metricOptions } = options;
  const { onOpenHeroPicker, onMetricChange, onOpenSuitPicker } = actions;

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-kicker">本地组合搜索</span>
          <h1>御魂计算器</h1>
        </div>
        <Typography.Text type="secondary">
          御魂来源：{accountName || "未命名账号"}
          {serverName ? ` · ${serverName}` : ""}
          {relicCount ? ` · ${relicCount.toLocaleString("zh-CN")} 件` : ""}
        </Typography.Text>
      </div>
      <Card className="calculator-controls">
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={5}>
            <Button block disabled={running} onClick={onOpenHeroPicker}>
              式神：{heroName || "请选择"}
            </Button>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              value={metric}
              options={metricOptions}
              disabled={running}
              onChange={onMetricChange}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Button
              block
              className="calculator-suit-summary-button"
              disabled={running}
              onClick={onOpenSuitPicker}
            >
              御魂类型：{selectedSuitSummary}
            </Button>
          </Col>
        </Row>
      </Card>
    </>
  );
}
