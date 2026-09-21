import { MoonOutlined, SunOutlined } from "@ant-design/icons";
import type { ThemeMode } from "@/lib/theme";
import styles from "./index.module.scss";

type ThemeToggleProps = {
  themeMode: ThemeMode;
  onToggle: () => void;
};

export function ThemeToggle({ themeMode, onToggle }: ThemeToggleProps) {
  const isDark = themeMode === "dark";
  const label = isDark ? "切换到浅色主题" : "切换到深色主题";

  return (
    <button
      className={styles.themeToggle}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      onClick={onToggle}
    >
      {isDark ? <SunOutlined /> : <MoonOutlined />}
      <span className={styles.themeToggleLabel}>主题</span>
    </button>
  );
}
