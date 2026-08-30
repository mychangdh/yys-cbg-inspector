import { APP_BASE_PATH } from "@/config/paths";

const configuredAssetBaseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL?.trim();
const assetBaseUrl = (
  configuredAssetBaseUrl || `${APP_BASE_PATH}/assets`
).replace(/\/$/, "");

export function assetUrl(path: string) {
  return `${assetBaseUrl.replace(/\/$/, "")}/${path.replace(/^\/+/, "")}`;
}
