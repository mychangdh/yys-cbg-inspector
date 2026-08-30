import type { AppNavigationItem } from "@/router/routes";
import type { AppRoute } from "@/router/index.types";

export type PageNavigationProps = {
  guardedPage: AppRoute;
  showNavigation: boolean;
  navigationItems: readonly AppNavigationItem[];
  desktopNavigationItems: readonly AppNavigationItem[];
  showHistoryLabel?: boolean;
  onNavigate: (route: AppRoute) => void;
  onRefreshStaticData: () => void | Promise<void>;
};
