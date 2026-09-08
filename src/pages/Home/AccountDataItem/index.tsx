import type { AccountDataItemProps } from "@/types/home";
import "./index.scss";

export function AccountDataItem({
  label,
  className = "",
  children,
}: AccountDataItemProps) {
  return (
    <div className={`overview-account-data-item ${className}`.trim()}>
      <span>{label}：</span>
      <strong>{children}</strong>
    </div>
  );
}
