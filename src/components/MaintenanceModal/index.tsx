import { Button, Modal, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import {
  getStaticRefreshState,
  staticRefreshCooldownMs,
} from "@/lib/staticRefresh";
import { assetUrl } from "@/lib/assetUrl";
import "./index.scss";
import type { MaintenanceModalProps } from "./index.types";

function formatRemainingTime(remainingMs: number): string {
  if (remainingMs <= 0) return "现在可以更新";
  const minutes = Math.ceil(remainingMs / 60_000);
  return `还需等待 ${minutes} 分钟`;
}

function formatUpdatedAt(lastRefreshAt: number | null): string {
  if (!lastRefreshAt) return "尚未更新";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(lastRefreshAt);
}

/** 仅由 Electron 顶部菜单打开的远程数据维护面板。 */
export function MaintenanceModal({
  open,
  loading,
  assetPreview,
  onClose,
  onUpdate,
}: MaintenanceModalProps) {
  const [refreshState, setRefreshState] = useState(getStaticRefreshState);

  useEffect(() => {
    if (!open) return undefined;
    const syncState = () => setRefreshState(getStaticRefreshState());
    syncState();
    const timer = window.setInterval(syncState, 1_000);
    return () => window.clearInterval(timer);
  }, [open]);

  const isCoolingDown = refreshState.remainingMs > 0;

  return (
    <Modal
      className="maintenance-modal"
      title="数据维护"
      open={open}
      width={520}
      footer={
        <>
          <Button onClick={onClose}>关闭</Button>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={loading}
            disabled={isCoolingDown}
            onClick={() => void onUpdate()}
          >
            更新远程数据
          </Button>
        </>
      }
      onCancel={onClose}
    >
      <section className="maintenance-modal__content">
        <Typography.Paragraph>
          更新会同步式神基础面板与御魂套装数据，不会读取或覆盖当前账号数据。
        </Typography.Paragraph>
        <dl className="maintenance-modal__status">
          <div>
            <dt>上次更新</dt>
            <dd>{formatUpdatedAt(refreshState.lastRefreshAt)}</dd>
          </div>
          <div>
            <dt>更新限制</dt>
            <dd>{formatRemainingTime(refreshState.remainingMs)}</dd>
          </div>
        </dl>
        <small>
          每次成功更新后需要等待 {staticRefreshCooldownMs / 60_000} 分钟，避免频繁请求远程数据。
        </small>
        {assetPreview && (
          <section className="maintenance-modal__asset-preview">
            <div>
              <strong>本次已更新图标</strong>
              <span>
                式神 {assetPreview.heroIcons} 个，御魂 {assetPreview.suitIcons} 个
                {assetPreview.failed > 0 ? `，失败 ${assetPreview.failed} 个` : ""}
              </span>
            </div>
            <div className="maintenance-modal__asset-images">
              {assetPreview.heroIds.map((id) => (
                <img key={`hero-${id}`} src={assetUrl(`heroes/${id}.png`)} alt="式神图标" />
              ))}
              {assetPreview.suitIds.map((id) => (
                <img key={`suit-${id}`} src={assetUrl(`suits/${id}.png`)} alt="御魂图标" />
              ))}
            </div>
          </section>
        )}
      </section>
    </Modal>
  );
}
