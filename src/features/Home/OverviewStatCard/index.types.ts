import type { ReactNode } from "react";

export type OverviewStatCardProps = {
  variant: "stamina" | "money" | "fengzidu" | "pvp";
  label: string;
  icon: ReactNode;
  value: ReactNode;
};
