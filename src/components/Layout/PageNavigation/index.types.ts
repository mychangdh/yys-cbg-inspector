import type { AppNavigationItem, AppRoute } from "@/router";

export type PageNavigationProps = {
  guardedPage: AppRoute;
  showNavigation: boolean;
  navigationItems: readonly AppNavigationItem[];
  showHistoryLabel?: boolean;
  onRefreshStaticData: () => void | Promise<void>;
};
