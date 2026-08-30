/**
 * 应用对外部署的固定子路径。
 *
 * 该值同时用于 Next.js basePath、浏览器静态资源地址和同源 API 地址，
 * 避免部署到子目录后出现页面能打开但资源或接口仍请求根路径的问题。
 */
export const APP_BASE_PATH = "/yys-cbg-inspector";
