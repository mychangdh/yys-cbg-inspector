import "./ProductLoader.scss";
import {
  DeleteOutlined,
  HistoryOutlined,
  LinkOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useMemo, useState } from "react";
import { Button, Empty, Input, Modal, Select } from "antd";
import type { DatasetHistoryRecord } from "../../lib/recentDatasetCache";

function formatSavedAt(value: number) {
  if (!value) return "较早保存";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function ProductLoader({
  value,
  loading,
  history,
  showHistoryTrigger,
  onChange,
  onLoad,
  onOpenHistory,
}: {
  value: string;
  loading: boolean;
  history: DatasetHistoryRecord[];
  showHistoryTrigger: boolean;
  onChange: (value: string) => void;
  onLoad: () => void;
  onOpenHistory: () => void;
}) {
  const hasHistory = showHistoryTrigger && history.length > 0;

  return (
    <div className="product-loader-root">
      {showHistoryTrigger && (
        <div className="product-loader-intro">
          <span>阴阳师御魂账号</span>
          <h1>账号查询</h1>
        </div>
      )}
      <div
        className={`product-loader${hasHistory ? "" : " product-loader--without-history"}`}
      >
        <Input
          value={value}
          allowClear
          prefix={<LinkOutlined />}
          placeholder="粘贴藏宝阁商品链接"
          disabled={loading}
          onChange={(event) => onChange(event.target.value)}
          onPressEnter={onLoad}
        />
        {hasHistory && (
          <Button
            className="product-history-trigger"
            icon={<HistoryOutlined />}
            aria-label="历史记录"
            title="历史记录"
            disabled={loading || history.length === 0}
            onClick={onOpenHistory}
          />
        )}
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={onLoad}
        >
          读取链接
        </Button>
      </div>
    </div>
  );
}

export function DatasetHistoryModal({
  open,
  history,
  onOpenChange,
  onRestore,
  onDelete,
}: {
  open: boolean;
  history: DatasetHistoryRecord[];
  onOpenChange: (open: boolean) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
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
