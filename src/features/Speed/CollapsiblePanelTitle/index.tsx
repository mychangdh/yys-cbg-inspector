import type { CollapsiblePanelTitleProps } from "@/types";
import styles from "./index.module.scss";

export function CollapsiblePanelTitle({
  title,
  collapsed,
  onToggle,
  onPointerDown,
}: CollapsiblePanelTitleProps) {
  return (
    <span className={styles.scope}>
      <button
        aria-expanded={!collapsed}
        className="speed-panel-title-trigger"
        type="button"
        onPointerDown={onPointerDown}
        onClick={onToggle}
      >
        <span>{title}</span>
      </button>
    </span>
  );
}
