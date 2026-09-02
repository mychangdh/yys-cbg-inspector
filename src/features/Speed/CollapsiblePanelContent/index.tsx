import type { CollapsiblePanelContentProps } from "@/types";
import styles from "./index.module.scss";

export function CollapsiblePanelContent({
  collapsed,
  children,
}: CollapsiblePanelContentProps) {
  return (
    <div className={styles.scope}>
      <div
        className={
          "speed-collapsible-content" + (collapsed ? " is-collapsed" : "")
        }
      >
        <div>{children}</div>
      </div>
    </div>
  );
}
