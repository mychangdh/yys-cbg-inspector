import { DeleteOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { Button, Empty, Modal, Select } from "antd";
import type { DatasetHistoryModalProps } from "./index.types";

function formatSavedAt(value: number) {
  if (!value) return "较早保存";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function DatasetHistoryModal({
  open,
  history,
  onOpenChange,
  onRestore,
  onDelete,
}: DatasetHistoryModalProps) {
  const [sortBy, setSortBy] = useState<
    "savedAt" | "accountName" | "relicCount"
  >("savedAt");
  const sortedHistory = useMemo(
    () =>
      [...history].sort((left, right) => {
        if (sortBy === "accountName")
          return left.accountName.localeCompare(right.accountName, "zh-CN");
        if (sortBy === "relicCount")
          return (
            right.relicCount - left.relicCount || right.savedAt - left.savedAt
          );
        return right.savedAt - left.savedAt;
      }),
    [history, sortBy],
  );

  return (
    <Modal
      className="product-history-modal"
      rootClassName="product-loader-modal"
      open={open}
      title="历史记录"
      width={620}
      onCancel={() => onOpenChange(false)}
      footer={
        <Button type="primary" onClick={() => onOpenChange(false)}>
          关闭
        </Button>
      }
    >
      {history.length > 1 && (
        <div className="product-history-tools">
          <span>排序</span>
          <Select
            value={sortBy}
            showSearch={false}
            options={[
              { value: "savedAt", label: "最近保存" },
              { value: "accountName", label: "账号名称" },
              { value: "relicCount", label: "御魂数量" },
            ]}
            onChange={setSortBy}
          />
        </div>
      )}
      {history.length ? (
        <div className="product-history-list">
          {sortedHistory.map((record) => (
            <div className="product-history-item" key={record.id}>
              <button
                className="product-history-entry"
                type="button"
                onClick={() => {
                  onRestore(record.id);
                  onOpenChange(false);
                }}
              >
                <span>
                  <strong>{record.accountName}</strong>
                  <small>{record.serverName}</small>
                </span>
                <span className="product-history-meta">
                  <small>{formatSavedAt(record.savedAt)}</small>
                  <em>{record.relicCount.toLocaleString("zh-CN")} 件御魂</em>
                </span>
              </button>
              <Button
                className="product-history-delete"
                type="text"
                danger
                icon={<DeleteOutlined />}
                aria-label={`删除 ${record.accountName} 的历史记录`}
                title="删除历史记录"
                onClick={() => onDelete(record.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <Empty description="暂无本地历史记录" />
      )}
    </Modal>
  );
}
