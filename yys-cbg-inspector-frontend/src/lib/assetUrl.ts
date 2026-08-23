const assetBaseUrl = import.meta.env.VITE_ASSET_BASE_URL;
export function assetUrl(path: string) {
  return `${assetBaseUrl}${path.replace(/^\/+/, "")}`;
}
