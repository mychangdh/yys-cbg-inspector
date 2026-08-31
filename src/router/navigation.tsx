import {
  AppstoreOutlined,
  CalculatorOutlined,
  DashboardOutlined,
  FundProjectionScreenOutlined,
  HomeOutlined,
  StarOutlined,
} from "@ant-design/icons";
import type { ComponentType } from "react";
import { APP_PUBLIC_PATH } from "@/config/paths";
import type { AppRoute, AppRoutePath } from "./index.types";

export type AppNavigationItem = {
  route: AppRoute;
  href: AppRoutePath;
  label: string;
  icon: ComponentType<{ spin?: boolean }>;
  requiresProduct: boolean;
};

/**
 * 导航元数据只描述菜单展示和页面链接。
 * 页面路由由根目录 app/ 下的文件系统目录负责注册，不在这里重复维护路由表。
 */
export const navigationItems: readonly AppNavigationItem[] = [
  {
    route: "home",
    href: "/home",
    label: "账号查询",
    icon: HomeOutlined,
    requiresProduct: false,
  },
  {
    route: "speed",
    href: "/speed",
    label: "速度盘点",
    icon: DashboardOutlined,
    requiresProduct: true,
  },
  {
    route: "pve",
    href: "/pve",
    label: "PVE 预览",
    icon: FundProjectionScreenOutlined,
    requiresProduct: true,
  },
  {
    route: "hero-skills",
    href: "/hero-skills",
    label: "式神技能",
    icon: StarOutlined,
    requiresProduct: true,
  },
  {
    route: "calculator",
    href: "/calculator",
    label: "御魂计算器",
    icon: CalculatorOutlined,
    requiresProduct: true,
  },
  {
    route: "relics",
    href: "/relics",
    label: "御魂库存",
    icon: AppstoreOutlined,
    requiresProduct: true,
  },
];

function normalizeAppPathname(pathname: string) {
  if (pathname === APP_PUBLIC_PATH) return "/";
  if (pathname.startsWith(`${APP_PUBLIC_PATH}/`)) {
    return pathname.slice(APP_PUBLIC_PATH.length) || "/";
  }

  return pathname;
}

/**
 * 仅用于根据当前 pathname 查找导航状态，不承担路由注册或跳转职责。
 * 路由注册由 app/ 下的页面目录负责，避免维护第二套路由表。
 */
export function getNavigationItem(pathname: string) {
  const normalizedPathname = normalizeAppPathname(pathname);

  return (
    navigationItems.find(
      (item) =>
        normalizedPathname === item.href ||
        normalizedPathname.startsWith(`${item.href}/`),
    ) || navigationItems[0]
  );
}
