import type { ComponentType, ReactNode } from "react";

export type AppRoute =
  | "home"
  | "relics"
  | "calculator"
  | "speed"
  | "pve"
  | "hero-skills"
  | "maintenance"
  | "about";

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
