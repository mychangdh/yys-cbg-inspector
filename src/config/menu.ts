import {
  AppstoreOutlined,
  CalculatorOutlined,
  DashboardOutlined,
  FundProjectionScreenOutlined,
  HomeOutlined,
  StarOutlined,
} from "@ant-design/icons";
import type { ComponentType } from "react";
import { APP_PUBLIC_PATH } from "./paths";

export type AppPage =
  "home" | "relics" | "calculator" | "speed" | "pve" | "hero-skills";

export type AppPagePath =
  "/home" | "/relics" | "/calculator" | "/speed" | "/pve" | "/hero-skills";

export type AppMenuItem = {
  page: AppPage;
  href: AppPagePath;
  label: string;
  icon: ComponentType<{ spin?: boolean }>;
  requiresProduct: boolean;
};

/**
 * 这里只维护菜单展示信息和当前页面高亮状态，不注册页面，也不负责页面跳转。
 * 页面本身由根目录 app/ 下的文件系统目录负责声明，避免重复维护路由表。
 */
export const menuItems: readonly AppMenuItem[] = [
  {
    page: "home",
    href: "/home",
    label: "账号查询",
    icon: HomeOutlined,
    requiresProduct: false,
  },
  {
    page: "speed",
    href: "/speed",
    label: "速度盘点",
    icon: DashboardOutlined,
    requiresProduct: true,
  },
  {
    page: "pve",
    href: "/pve",
    label: "PVE 预览",
    icon: FundProjectionScreenOutlined,
    requiresProduct: true,
  },
  {
    page: "hero-skills",
    href: "/hero-skills",
    label: "式神技能",
    icon: StarOutlined,
    requiresProduct: true,
  },
  {
    page: "calculator",
    href: "/calculator",
    label: "御魂计算器",
    icon: CalculatorOutlined,
    requiresProduct: true,
  },
  {
    page: "relics",
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

/** 根据 Next.js 当前 pathname 找到菜单高亮项，不参与路由注册。 */
export function getMenuItem(pathname: string) {
  const normalizedPathname = normalizeAppPathname(pathname);

  return (
    menuItems.find(
      (item) =>
        normalizedPathname === item.href ||
        normalizedPathname.startsWith(`${item.href}/`),
    ) || menuItems[0]
  );
}
