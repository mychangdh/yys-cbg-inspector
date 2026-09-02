import { CaretDownOutlined, CaretRightOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import type { CollapseControlProps } from "@/types";
import styles from "./index.module.scss";

export function CollapseControl({ collapsed, onToggle }: CollapseControlProps) {
  return (
    <Tooltip title={collapsed ? "展开" : "收起"}>
      <span className={styles.scope}>
        <Button
          aria-label={collapsed ? "展开" : "收起"}
          className="speed-collapse-control"
          icon={collapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
          size="small"
          type="text"
          onClick={onToggle}
        />
      </span>
    </Tooltip>
  );
}
