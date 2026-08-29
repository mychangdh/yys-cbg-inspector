import "./RelicIcon.scss";
import { assetUrl } from "../../lib/assetUrl";
import type { RelicView } from "../../types";

type RelicIconProps = {
  item: RelicView;
  compact?: boolean;
  displayLevel?: number;
  showLevelBadge?: boolean;
};

/**
 * 御魂图标的统一入口。
 * 号位外框使用本地保存的 PNG，通过旋转表达 1 至 6 号位的朝向。
 */
export function RelicIcon({
  item,
  compact = false,
  displayLevel,
  showLevelBadge = false,
}: RelicIconProps) {
  const source = assetUrl(`suits/${item.suit?.id || 0}.png`);
  const quality = Math.max(0, Math.min(6, item.quality || 6));
  const position = item.position || 0;

  return (
    <div
      className={`relic-icon-root relic-image-wrap${compact ? " relic-image-compact" : ""}`}
      title={`${position || "-"}号位`}
    >
      <img
        src={source}
        alt={`${item.suit?.name || "御魂"} ${position || ""}号位`}
        onError={(event) => {
          const image = event.currentTarget;
          if (!image.dataset.retryAttempted) {
            image.dataset.retryAttempted = "true";
            image.src = `${source}${source.includes("?") ? "&" : "?"}retry=${Date.now()}`;
            return;
          }
          image.style.visibility = "hidden";
        }}
      />
      <span
        className={`slot-pointer slot-${position}`}
        aria-label={`${position || "未知"}号位`}
      >
        <img src={assetUrl("relic-slot-pointer.png")} alt="" />
      </span>
      {showLevelBadge && (
        <span className="relic-level">+{displayLevel ?? item.level ?? 0}</span>
      )}
      <span className="relic-quality" aria-label={`${quality}星御魂`}>
        {Array.from({ length: quality }, (_, index) => (
          <i
            key={index}
            aria-hidden="true"
            style={{
              backgroundImage: `url(${assetUrl("relic-quality-gem.png")})`,
            }}
          />
        ))}
      </span>
    </div>
  );
}
