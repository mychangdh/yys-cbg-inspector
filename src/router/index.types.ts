/**
 * 页面标识只用于导航元数据和界面状态，不负责声明 Next.js 路由。
 * 实际路由由根目录 app/ 下的文件系统目录决定。
 */
export type AppRoute =
  "home" | "relics" | "calculator" | "speed" | "pve" | "hero-skills";

/** 受导航元数据约束的内部页面链接类型。 */
export type AppRoutePath =
  "/home" | "/relics" | "/calculator" | "/speed" | "/pve" | "/hero-skills";
