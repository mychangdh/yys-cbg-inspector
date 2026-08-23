/** 静态图标由 Electron 自定义协议映射到用户数据目录或内置资源。 */
export function assetUrl(path: string): string {
  const normalized = path.replace(/^\/+/, "");
  const iconMatch = normalized.match(/^(heroes|suits)\/(\d+)\.png$/);
  const uiMatch = normalized.match(/^ui\/([a-z0-9-]+\.(?:png|svg))$/);
  if (iconMatch) return `yys-cbg-assets://${iconMatch[1]}/${iconMatch[2]}.png`;
  if (uiMatch) return `yys-cbg-assets://ui/${uiMatch[1]}`;
  return `yys-cbg-assets://ui/${normalized}`;
}
