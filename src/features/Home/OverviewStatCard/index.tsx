import { Card } from "antd";
import type { ReactNode } from "react";
import styles from "./index.module.scss";

type OverviewStatCardProps = {
  variant: "stamina" | "money" | "fengzidu" | "pvp";
  label: string;
  icon: ReactNode;
  value: ReactNode;
};

export function OverviewStatCard({
  variant,
  label,
  icon,
  value,
}: OverviewStatCardProps) {
  return (
    <Card className={styles.statCard} data-variant={variant}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.copy}>
        <span className={styles.label}>{label}</span>
        {variant === "pvp" ? (
          <span className={styles.pvpValue}>{value}</span>
        ) : (
          <strong>{value}</strong>
        )}
      </span>
    </Card>
  );
}
