import {
  AppstoreOutlined,
  CalculatorOutlined,
  DashboardOutlined,
  FundProjectionScreenOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  StarOutlined,
} from "@ant-design/icons";
import type { ComponentType, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/Layout";
import { AboutPage } from "@/pages/About";
import { CalculatorWorkspace } from "@/pages/Calculator";
import { HeroSkillsPage } from "@/pages/HeroSkills";
import { HomePage } from "@/pages/Home";
import { MaintenancePage } from "@/pages/Maintenance";
import { PvePage } from "@/pages/Pve";
import { RelicsPage } from "@/pages/Relics";
import { SpeedPage } from "@/pages/Speed";
import type { AppRoute } from "./index.types";

export type AppNavigationItem = {
  route: AppRoute;
  label: string;
  icon: ComponentType<{ spin?: boolean }>;
};

export type AppRouteTableEntry = {
  route?: AppRoute;
  path?: string;
  menu?: Omit<AppNavigationItem, "route">;
  requiresProduct?: boolean;
  element: ReactNode;
  children?: readonly AppRouteTableEntry[];
};

const pageRoutes: readonly AppRouteTableEntry[] = [
  { path: "/", element: <Navigate to="/home" replace /> },
  {
    path: "/overview",
    element: <Navigate to="/home" replace />,
  },
  {
    route: "home",
    path: "/home",
    menu: { label: "账号查询", icon: HomeOutlined },
    element: <HomePage />,
  },
  {
    route: "speed",
    path: "/speed",
    requiresProduct: true,
    menu: { label: "速度盘点", icon: DashboardOutlined },
    element: <SpeedPage />,
  },
  {
    route: "pve",
    path: "/pve",
    requiresProduct: true,
    menu: { label: "PVE 预览", icon: FundProjectionScreenOutlined },
    element: <PvePage />,
  },
  {
    route: "hero-skills",
    path: "/hero-skills",
    requiresProduct: true,
    menu: { label: "式神技能", icon: StarOutlined },
    element: <HeroSkillsPage />,
  },
  {
    route: "calculator",
    path: "/calculator",
    requiresProduct: true,
    menu: { label: "御魂计算器", icon: CalculatorOutlined },
    element: <CalculatorWorkspace />,
  },
  {
    route: "relics",
    path: "/relics",
    requiresProduct: true,
    menu: { label: "御魂库存", icon: AppstoreOutlined },
    element: <RelicsPage />,
  },
  {
    route: "maintenance",
    path: "/maintenance",
    menu: { label: "维护", icon: SettingOutlined },
    element: <MaintenancePage />,
  },
  {
    route: "about",
    path: "/about",
    menu: { label: "关于", icon: InfoCircleOutlined },
    element: <AboutPage />,
  },
  { path: "*", element: <Navigate to="/home" replace /> },
];

export const routes: readonly AppRouteTableEntry[] = [
  {
    element: <AppLayout />,
    children: pageRoutes,
  },
];

const pageRouteEntries = routes.flatMap((route) => route.children || []);

export const APP_ROUTE_PATHS = pageRouteEntries.reduce<Record<AppRoute, string>>(
  (paths, route) => {
    if (route.route && route.path) paths[route.route] = route.path;
    return paths;
  },
  {} as Record<AppRoute, string>,
);

export const navigationItems: AppNavigationItem[] = pageRouteEntries.flatMap((route) =>
  route.route && route.menu
    ? [{ route: route.route, ...route.menu }]
    : [],
);

export const desktopNavigationItems = navigationItems.filter(
  (item) => item.route !== "about" && item.route !== "maintenance",
);

export const aboutNavigationItem = navigationItems.find(
  (item) => item.route === "about",
)!;

export const maintenanceNavigationItem = navigationItems.find(
  (item) => item.route === "maintenance",
)!;

export function getRouteFromPath(pathname: string): AppRoute {
  if (pathname === "/overview") return "home";
  const entry = pageRouteEntries.find(
    (route) => route.route && route.path === pathname,
  );
  return entry?.route || "home";
}
