import type { AppRoute } from "@/router";
import type { AppNavigationItem } from "@/router/routes";

export type PageNavigationProps = {
  guardedPage: AppRoute;
  showNavigation: boolean;
  navigationItems: readonly AppNavigationItem[];
  desktopNavigationItems: readonly AppNavigationItem[];
  onNavigate: (route: AppRoute) => void;
};
