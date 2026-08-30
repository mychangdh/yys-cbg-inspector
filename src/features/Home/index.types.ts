import type { ReactNode } from "react";
import type { AppRoutePath } from "@/router";

export type OverviewShortcut = {
  href: AppRoutePath;
  label: string;
  icon: ReactNode;
};

export type OverviewPositionCount = {
  position: number;
  count: number;
};
