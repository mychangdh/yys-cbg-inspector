import { Button, Modal } from "antd";
import { format } from "../calculatorShared";
import type { CalculatorStaticUpdateModalProps } from "./index.types";

/** 展示本地静态数据刷新结果。 */
export function CalculatorStaticUpdateModal({
  report,
  onClose,
}: CalculatorStaticUpdateModalProps) {
  return (
    <Modal
      className="calculator-static-update-modal"
      rootClassName="calculator-page-modal"
      title="静态数据更新完成"
      open={Boolean(report)}
      destroyOnHidden
      footer={
        <Button type="primary" onClick={onClose}>
          确定
        </Button>
      }
      onCancel={onClose}
    >
      <div className="calculator-static-update-report">
        <strong>已刷新本地静态数据</strong>
        <p>
          式神基础面板 {format(report?.heroCount || 0)} 个，御魂套装
          {format(report?.suitCount || 0)} 个。
        </p>
        <small>账号商品数据未重新请求；30 分钟内无需再次更新。</small>
      </div>
    </Modal>
  );
}
