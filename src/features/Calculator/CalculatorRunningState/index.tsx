import { Button, Modal, Progress } from "antd";
import type { CalculatorRunningStateProps } from "./index.types";

/** 计算期间的进度提示与终止操作。 */
export function CalculatorRunningState({
  state,
  progress,
  commands,
}: CalculatorRunningStateProps) {
  const { running, fastMode } = state;
  const { calculationProgress, calculationStage, calculationProgressText } =
    progress;
  const { onStop: stopCalculation } = commands;
  return (
    <>
      <Modal
        open={running}
        rootClassName="calculator-page-modal"
        footer={null}
        closable={false}
        maskClosable={false}
        keyboard={false}
        centered
        className="calculator-running-modal"
      >
        <div className="calculator-running-content">
          <div className="calculator-running-label">
            {fastMode
              ? "极速计算只返回一套最优御魂组合，速度更快"
              : "正在计算最优御魂组合"}
          </div>
          <div className="calculator-running-detail">
            <span>
              {
                {
                  preparing: "正在整理御魂数据",
                  matching: "正在匹配御魂组合",
                  validating: "正在校验面板约束",
                  ranking: "正在整理最优结果",
                }[calculationStage]
              }
            </span>
          </div>
          <section className="calculator-running-progress">
            <div className="calculator-running-progress-meta">
              <span>{calculationProgressText}</span>
              <strong>{`${calculationProgress}%`}</strong>
            </div>
            <Progress
              percent={calculationProgress}
              showInfo={false}
              status="active"
              size="small"
            />
          </section>
          <p className="calculator-running-tip">
            {fastMode
              ? "极速模式只返回评分最高的一套组合，完成后自动展示结果。"
              : "完成后将自动展示最优组合结果。"}
          </p>
          <div className="calculator-running-actions">
            <Button
              type="text"
              size="small"
              onClick={stopCalculation}
              className="calculator-running-stop"
              aria-label="终止计算"
              title="终止计算"
            >
              终止计算
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
