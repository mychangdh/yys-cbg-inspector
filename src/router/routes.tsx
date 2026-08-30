import {
  AppstoreOutlined,
  CalculatorOutlined,
  DashboardOutlined,
  FundProjectionScreenOutlined,
  HomeOutlined,
  StarOutlined,
} from "@ant-design/icons";
import type { ComponentType } from "react";
import type { AppRoute } from "./index.types";

export type AppNavigationItem = {
  route: AppRoute;
  label: string;
  icon: ComponentType<{ spin?: boolean }>;
};

/** Next.js App Router 使用的唯一页面路径映射。 */
export const APP_ROUTE_PATHS: Readonly<Record<AppRoute, string>> = {
  home: "/home",
  speed: "/speed",
  pve: "/pve",
  "hero-skills": "/hero-skills",
  calculator: "/calculator",
  relics: "/relics",
};

export const navigationItems: readonly AppNavigationItem[] = [
  { route: "home", label: "账号查询", icon: HomeOutlined },
  { route: "speed", label: "速度盘点", icon: DashboardOutlined },
  { route: "pve", label: "PVE 预览", icon: FundProjectionScreenOutlined },
  { route: "hero-skills", label: "式神技能", icon: StarOutlined },
  { route: "calculator", label: "御魂计算器", icon: CalculatorOutlined },
  { route: "relics", label: "御魂库存", icon: AppstoreOutlined },
];

const productRoutes = new Set<AppRoute>([
  "speed",
  "pve",
  "hero-skills",
  "calculator",
  "relics",
]);

export function requiresProduct(route: AppRoute) {
  return productRoutes.has(route);
}

export function getRouteFromPath(pathname: string): AppRoute {
  if (pathname === "/" || pathname === "/overview") return "home";

  const entry = Object.entries(APP_ROUTE_PATHS).find(
    ([, path]) => path === pathname,
  );
  return (entry?.[0] as AppRoute | undefined) || "home";
}
