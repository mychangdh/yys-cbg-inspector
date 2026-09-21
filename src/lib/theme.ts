export type ThemeMode = "light" | "dark";

const themeStorageKey = "yys-cbg-inspector.theme";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";

  try {
    return window.localStorage.getItem(themeStorageKey) === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function persistTheme(theme: ThemeMode) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // 浏览器禁用本地存储时仍保留本次运行的主题切换。
  }
}
