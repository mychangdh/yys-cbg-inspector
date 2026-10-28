import type { DatasetHistoryRecord, StaticAssetPreview } from "@/store";
import type { ThemeMode } from "@/lib/theme";
import type { CbgChannel } from "@/types";
import type { AppNavigationItem, AppRoute } from "./router";

export type AppLayoutProps = Record<string, never>;

export type CbgPanelBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PageNavigationProps = {
  guardedPage: AppRoute;
  showNavigation: boolean;
  navigationItems: readonly AppNavigationItem[];
  desktopNavigationItems: readonly AppNavigationItem[];
  onNavigate: (route: AppRoute) => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  loginChannel: CbgChannel;
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
  onOpenCbgWindow?: () => void;
  onToggleCbgFullscreen?: () => void;
  cbgWindowFullscreen?: boolean;
  cbgSyncEnabled?: boolean;
  onToggleCbgSync?: (enabled: boolean) => void;
};

export type MaintenanceModalProps = {
  open: boolean;
  loading: boolean;
  assetPreview: StaticAssetPreview | null;
  onClose: () => void;
  onUpdate: () => Promise<void>;
};
