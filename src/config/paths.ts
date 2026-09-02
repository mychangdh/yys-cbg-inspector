/**
 * 应用对外部署的子路径。
 *
 * 本地开发直接使用根路径，生产构建才挂到 Nginx 的公开子目录；两者由
 * Next.js 的 NODE_ENV 在构建/启动时自动决定，避免开发地址也被强制加前缀。
 */
export const APP_PUBLIC_PATH =
  process.env.NODE_ENV === "production" ? "/yys-cbg-inspector" : "";

/**
 * 将应用内部路径转换为浏览器应该访问的公开路径。
 *
 * Next.js 的 Link 会自动应用 basePath；这里只给原生浏览器 URL 补上生产
 * 前缀，避免 window.location 等跳转离开应用子目录。
 */
export function toPublicPath(pathname: string) {
  const normalizedPathname = pathname.startsWith("/")
    ? pathname
    : `/${pathname}`;

  if (
    normalizedPathname === APP_PUBLIC_PATH ||
    normalizedPathname.startsWith(`${APP_PUBLIC_PATH}/`)
  ) {
    return normalizedPathname;
  }

  if (normalizedPathname === "/") return APP_PUBLIC_PATH || "/";

  return `${APP_PUBLIC_PATH}${normalizedPathname}`;
}
