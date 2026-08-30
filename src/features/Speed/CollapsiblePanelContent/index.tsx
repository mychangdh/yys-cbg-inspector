import type { CollapsiblePanelContentProps } from "../index.types";
import "./index.scss";

export function CollapsiblePanelContent({
  collapsed,
  children,
}: CollapsiblePanelContentProps) {
  return (
    <div
      className={
        "speed-collapsible-content" + (collapsed ? " is-collapsed" : "")
      }
    >
      <div>{children}</div>
    </div>
  );
}
