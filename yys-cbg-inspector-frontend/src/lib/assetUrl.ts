const assetBaseUrl = import.meta.env.VITE_ASSET_BASE_URL || "/assets/";
export function assetUrl(path: string) {
  return `${assetBaseUrl}${path.replace(/^\/+/, "")}`;
}
