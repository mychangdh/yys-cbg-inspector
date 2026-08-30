import type { CollapsiblePanelTitleProps } from "../index.types";
import "./index.scss";

export function CollapsiblePanelTitle({
  title,
  collapsed,
  onToggle,
  onPointerDown,
}: CollapsiblePanelTitleProps) {
  return (
    <button
      aria-expanded={!collapsed}
      className="speed-panel-title-trigger"
      type="button"
      onPointerDown={onPointerDown}
      onClick={onToggle}
    >
      <span>{title}</span>
    </button>
  );
}
