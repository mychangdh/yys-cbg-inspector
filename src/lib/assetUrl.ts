/** 静态图标由 Tauri 自定义协议映射到用户数据目录或安装包内资源。 */
export function assetUrl(path: string): string {
  const normalized = path.replace(/^\/+/, "");
  const iconMatch = normalized.match(/^(heroes|suits)\/(\d+)\.png$/);
  const uiMatch = normalized.match(/^ui\/([a-z0-9-]+\.(?:png|svg))$/);
  const inTauri =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  // Windows WebView2 会把 Tauri 自定义协议映射为 http://<scheme>.localhost；
  // 其他桌面端继续使用标准的 <scheme>://localhost 形式。
  const tauriAssetBaseUrl =
    typeof navigator !== "undefined" && navigator.userAgent.includes("Windows")
      ? "http://yys-cbg-assets.localhost"
      : "yys-cbg-assets://localhost";

  if (inTauri) {
    if (iconMatch) {
      return `${tauriAssetBaseUrl}/${iconMatch[1]}/${iconMatch[2]}.png`;
    }
    if (uiMatch) return `${tauriAssetBaseUrl}/ui/${uiMatch[1]}`;
    return `${tauriAssetBaseUrl}/ui/${normalized}`;
  }

  if (iconMatch)
    return `/static-data/assets/${iconMatch[1]}/${iconMatch[2]}.png`;
  if (uiMatch) return `/static-data/assets/ui/${uiMatch[1]}`;
  return `/static-data/assets/ui/${normalized}`;
}
