import type { ReactNode } from "react";
import styles from "./index.module.scss";

type AccountDataItemProps = {
  label: string;
  className?: string;
  children: ReactNode;
};

export function AccountDataItem({
  label,
  className = "",
  children,
}: AccountDataItemProps) {
  return (
    <div className={`${styles.accountDataItem} ${className}`.trim()}>
      <span>{label}：</span>
      <strong>{children}</strong>
    </div>
  );
}
