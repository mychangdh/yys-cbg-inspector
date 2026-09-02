import { APP_PUBLIC_PATH } from "@/config/paths";

// 图片属于随应用发布的本地资源，不跟随 API 地址，也不读取外部环境变量。
// 这样生产环境换端口、换域名或接口跨域时，图片仍然只从当前站点加载。
const localAssetBaseUrl = `${APP_PUBLIC_PATH}/assets`;

export function assetUrl(path: string) {
  return `${localAssetBaseUrl}/${path.replace(/^\/+/, "")}`;
}
