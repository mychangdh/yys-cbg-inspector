import "./index.scss";
import {
  CheckCircleFilled,
  FullscreenExitOutlined,
  FullscreenOutlined,
  GlobalOutlined,
  HistoryOutlined,
  LinkOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Input, Switch, Tooltip } from "antd";
import type { ProductLoaderProps } from "@/types/layout";

export function ProductLoader({
  value,
  loading,
  history,
  showHistoryTrigger,
  restoreNotice,
  onChange,
  onLoad,
  onOpenHistory,
  onOpenCbgWindow,
  onToggleCbgFullscreen,
  cbgWindowFullscreen = false,
  cbgSyncEnabled = true,
  onToggleCbgSync,
}: ProductLoaderProps) {
  const hasHistory = showHistoryTrigger && history.length > 0;
  const hasFullscreenAction = Boolean(onToggleCbgFullscreen);

  return (
    <div className="product-loader-root">
      {showHistoryTrigger && (
        <div className="product-loader-intro">
          <span>阴阳师藏宝阁</span>
          <h1>账号查询</h1>
        </div>
      )}
      <div
        className={`product-loader${hasHistory ? "" : " product-loader--without-history"}${hasFullscreenAction ? " has-fullscreen-action" : ""}`}
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
          className="product-loader-read"
          type="primary"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={onLoad}
        >
          读取链接
        </Button>
        {onToggleCbgFullscreen && (
          <Button
            className="product-loader-fullscreen"
            icon={
              cbgWindowFullscreen ? (
                <FullscreenExitOutlined />
              ) : (
                <FullscreenOutlined />
              )
            }
            onClick={onToggleCbgFullscreen}
          >
            {cbgWindowFullscreen ? "退出全屏" : "全屏"}
          </Button>
        )}
      </div>
      {(onOpenCbgWindow || onToggleCbgSync) && (
        <div
          className={`product-loader-utility-panel${onOpenCbgWindow ? " has-cbg-button" : ""}`}
        >
          {onOpenCbgWindow && (
            <Button
              className="product-loader-cbg"
              icon={<GlobalOutlined />}
              onClick={onOpenCbgWindow}
              title="打开或收起独立藏宝阁窗口"
            >
              藏宝阁
            </Button>
          )}
          {onToggleCbgSync && (
            <div
              className="product-loader-sync-toggle"
              role="group"
              aria-label="藏宝阁数据同步设置"
            >
              <div className="product-loader-sync-copy">
                <div className="product-loader-sync-heading">
                  <span className="product-loader-sync-title">同步数据</span>
                  <span className="product-loader-sync-recommended">推荐</span>
                  <Tooltip title="推荐开启：在独立藏宝阁窗口打开商品详情后，工具会自动读取并同步账号数据。关闭后仍可粘贴链接并手动读取。">
                    <Button
                      className="product-loader-sync-help"
                      type="text"
                      size="small"
                      icon={<QuestionCircleOutlined />}
                      aria-label="同步数据说明"
                    />
                  </Tooltip>
                </div>
                <span className="product-loader-sync-description">
                  浏览商品详情时自动载入
                </span>
              </div>
              <Switch
                checked={cbgSyncEnabled}
                size="small"
                aria-label="自动同步藏宝阁数据"
                onChange={onToggleCbgSync}
              />
            </div>
          )}
        </div>
      )}
      {restoreNotice && (
        <div className="product-restore-notice" role="status">
          <CheckCircleFilled aria-hidden="true" />
          <span>{restoreNotice}</span>
        </div>
      )}
    </div>
  );
}
