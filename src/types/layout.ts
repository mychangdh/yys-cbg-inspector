import type { DatasetHistoryRecord, StaticAssetPreview } from "@/store";
import type { AppNavigationItem, AppRoute } from "./router";

export type AppLayoutProps = Record<string, never>;

export type PageNavigationProps = {
  guardedPage: AppRoute;
  showNavigation: boolean;
  navigationItems: readonly AppNavigationItem[];
  desktopNavigationItems: readonly AppNavigationItem[];
  onNavigate: (route: AppRoute) => void;
};

export type DatasetHistoryModalProps = {
  open: boolean;
  history: DatasetHistoryRecord[];
  onOpenChange: (open: boolean) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
};

export type ProductLoaderProps = {
  value: string;
  loading: boolean;
  history: DatasetHistoryRecord[];
  showHistoryTrigger: boolean;
  restoreNotice?: string | null;
  onChange: (value: string) => void;
  onLoad: () => void;
  onOpenHistory: () => void;
};

export type MaintenanceModalProps = {
  open: boolean;
  loading: boolean;
  assetPreview: StaticAssetPreview | null;
  onClose: () => void;
  onUpdate: () => Promise<void>;
};
