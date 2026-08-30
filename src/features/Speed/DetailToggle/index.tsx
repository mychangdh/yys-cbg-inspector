import { Switch } from "antd";
import type { DetailToggleProps } from "../index.types";
import "./index.scss";

export function DetailToggle({
  checked,
  className,
  onChange,
}: DetailToggleProps) {
  const toggle = () => onChange(!checked);

  return (
    <div
      aria-checked={checked}
      className={`${className} speed-detail-toggle-trigger`}
      role="switch"
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggle();
      }}
    >
      <Switch
        checked={checked}
        size="small"
        onClick={(_, event) => event.stopPropagation()}
        onChange={onChange}
      />
      <span className="speed-detail-toggle-label">详细信息</span>
    </div>
  );
}
