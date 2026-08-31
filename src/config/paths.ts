/**
 * 应用对外部署的固定子路径。
 *
 * Next.js 通过 next.config.ts 的 basePath 使用该路径；它也用于原生浏览器
 * 跳转、公共资源和同源 API 地址等不会由 next/link 自动处理的 URL。
 */
export const APP_PUBLIC_PATH = "/yys-cbg-inspector";

/**
 * 将应用内部路径转换为浏览器应该访问的公开路径。
 *
 * Next.js 的 Link 会自动应用 basePath；这里只给原生浏览器 URL 补上固定
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

  if (normalizedPathname === "/") return APP_PUBLIC_PATH;

  return `${APP_PUBLIC_PATH}${normalizedPathname}`;
}
