import type { AccountOverview } from "./index";
import type { ReactNode } from "react";

export type HomePageProps = Record<string, never>;

export type PvpSummaryProps = {
  score?: number;
  stage?: string | number;
};

export type ShikigamiDexProps = {
  account: AccountOverview;
};

export type AccountDataItemProps = {
  label: string;
  className?: string;
  children: ReactNode;
};

export type PositionCountTableProps = {
  counts: Array<{ position: number; count: number }>;
  title?: string;
  description?: string;
};
