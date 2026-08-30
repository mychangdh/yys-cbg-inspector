const assetBaseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL || "/assets/";

export function assetUrl(path: string) {
  return `${assetBaseUrl.replace(/\/$/, "")}/${path.replace(/^\/+/, "")}`;
}
