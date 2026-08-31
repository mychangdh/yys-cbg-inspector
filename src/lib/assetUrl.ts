import { APP_PUBLIC_PATH } from "@/config/paths";

const configuredAssetBaseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL?.trim();
const defaultAssetBaseUrl = `${APP_PUBLIC_PATH}/assets`;
const assetBaseUrl = (
  configuredAssetBaseUrl || defaultAssetBaseUrl
).replace(/\/$/, "");

export function assetUrl(path: string) {
  return `${assetBaseUrl.replace(/\/$/, "")}/${path.replace(/^\/+/, "")}`;
}
