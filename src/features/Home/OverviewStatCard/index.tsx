import { Card } from "antd";
import type { OverviewStatCardProps } from "./index.types";
import "./index.scss";

export function OverviewStatCard({
  variant,
  label,
  icon,
  value,
}: OverviewStatCardProps) {
  return (
    <Card className={`overview-stat-card overview-stat-card--${variant}`}>
      <span className="overview-stat-card__icon">{icon}</span>
      <span className="overview-stat-card__copy">
        <span className="overview-stat-card__label">{label}</span>
        {variant === "pvp" ? (
          <span className="overview-stat-card__pvp-value">{value}</span>
        ) : (
          <strong>{value}</strong>
        )}
      </span>
    </Card>
  );
}
