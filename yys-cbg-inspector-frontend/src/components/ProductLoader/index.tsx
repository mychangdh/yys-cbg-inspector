import "./index.scss";
import {
  HistoryOutlined,
  LinkOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Input } from "antd";
import type { ProductLoaderProps } from "./index.types";

export function ProductLoader({
  value,
  loading,
  history,
  showHistoryTrigger,
  onChange,
  onLoad,
  onOpenHistory,
}: ProductLoaderProps) {
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
