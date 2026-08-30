import { CaretDownOutlined, CaretRightOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import type { CollapseControlProps } from "../index.types";
import "./index.scss";

export function CollapseControl({ collapsed, onToggle }: CollapseControlProps) {
  return (
    <Tooltip title={collapsed ? "展开" : "收起"}>
      <Button
        aria-label={collapsed ? "展开" : "收起"}
        className="speed-collapse-control"
        icon={collapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
        size="small"
        type="text"
        onClick={onToggle}
      />
    </Tooltip>
  );
}
