import "./index.scss";
import { HistoryOutlined } from "@ant-design/icons";
import { setHistoryOpen, useAppDispatch, useAppSelector } from "@/store";
import type { PageNavigationProps } from "./index.types";

/** Electron 只保留桌面导航，移除最右侧的移动端“菜单”入口。 */
export function PageNavigation({
  guardedPage,
  showNavigation,
  navigationItems,
  desktopNavigationItems,
  onNavigate,
}: PageNavigationProps) {
  const dispatch = useAppDispatch();
  const { updating, history } = useAppSelector((state) => state.app);
  const currentNavigation =
    navigationItems.find((item) => item.route === guardedPage) ||
    navigationItems[0];

  if (!showNavigation || !currentNavigation) return null;

  return (
    <div className="width page-menu-wrap page-navigation">
      <nav className="page-menu" aria-label="页面切换">
        <div className="page-menu-desktop-items">
          {desktopNavigationItems.map((item) => (
            <button
              key={item.route}
              className={guardedPage === item.route ? "is-active" : ""}
              type="button"
              aria-current={guardedPage === item.route ? "page" : undefined}
              onClick={() => onNavigate(item.route)}
            >
              <item.icon />
              <span>{item.label}</span>
            </button>
          ))}
          <button
            className="page-menu-history"
            type="button"
            aria-label="历史记录"
            title="历史记录"
            disabled={updating || history.length === 0}
            onClick={() => dispatch(setHistoryOpen(true))}
          >
            <HistoryOutlined />
          </button>
        </div>
      </nav>
    </div>
  );
}
