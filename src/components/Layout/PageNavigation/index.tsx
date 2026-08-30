import {
  HistoryOutlined,
  MenuOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Drawer } from "antd";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store";
import { setHistoryOpen, setMobileMenuOpen } from "@/store";
import type { PageNavigationProps } from "./index.types";
import "./index.scss";

export function PageNavigation({
  guardedPage,
  showNavigation,
  navigationItems,
  showHistoryLabel = false,
  onRefreshStaticData,
  onNavigationStart,
}: PageNavigationProps) {
  const dispatch = useAppDispatch();
  const { updating, history, mobileMenuOpen, staticDataLoading } =
    useAppSelector((state) => state.app);
  const currentNavigation =
    navigationItems.find((item) => item.route === guardedPage) ||
    navigationItems[0];
  const startNavigation = (route: PageNavigationProps["guardedPage"]) => {
    if (route !== guardedPage) onNavigationStart();
  };

  if (!showNavigation || !currentNavigation) return null;

  return (
    <>
      <div className="width page-menu-wrap">
        <nav className="page-menu" aria-label="页面切换">
          <div className="page-menu-mobile-current" aria-live="polite">
            <currentNavigation.icon />
            <span>{currentNavigation.label}</span>
          </div>
          <div className="page-menu-desktop-items">
            {navigationItems.map((item) => (
              <Link
                key={item.route}
                className={guardedPage === item.route ? "is-active" : ""}
                aria-current={guardedPage === item.route ? "page" : undefined}
                href={item.href}
                scroll={false}
                onNavigate={() => startNavigation(item.route)}
              >
                <item.icon />
                <span>{item.label}</span>
              </Link>
            ))}
            <button
              className="page-menu-history"
              type="button"
              aria-label="History"
              title="History"
              disabled={updating || history.length === 0}
              onClick={() => dispatch(setHistoryOpen(true))}
            >
              <HistoryOutlined />
              {showHistoryLabel && <span>历史记录</span>}
            </button>
          </div>
          <button
            className="page-menu-mobile-trigger"
            type="button"
            aria-label="打开功能菜单"
            title="功能菜单"
            aria-expanded={mobileMenuOpen}
            onClick={() => dispatch(setMobileMenuOpen(true))}
          >
            <MenuOutlined />
            <span>菜单</span>
          </button>
        </nav>
      </div>
      <Drawer
        className="mobile-navigation-drawer-panel"
        placement="right"
        rootClassName="mobile-navigation-drawer"
        title="功能菜单"
        open={mobileMenuOpen}
        onClose={() => dispatch(setMobileMenuOpen(false))}
      >
        <nav className="mobile-navigation-list" aria-label="功能菜单">
          <section className="mobile-navigation-pages" aria-label="页面导航">
            {navigationItems.map((item) => (
              <Link
                key={item.route}
                className={guardedPage === item.route ? "is-active" : ""}
                aria-current={guardedPage === item.route ? "page" : undefined}
                href={item.href}
                scroll={false}
                onNavigate={() => {
                  dispatch(setMobileMenuOpen(false));
                  startNavigation(item.route);
                }}
              >
                <item.icon />
                <span>{item.label}</span>
              </Link>
            ))}
          </section>
          <section className="mobile-navigation-actions" aria-label="数据操作">
            <button
              type="button"
              disabled={updating || history.length === 0}
              onClick={() => {
                dispatch(setMobileMenuOpen(false));
                dispatch(setHistoryOpen(true));
              }}
            >
              <HistoryOutlined />
              <span>历史记录</span>
            </button>
            <div className="static-refresh-menu-item">
              <button
                type="button"
                disabled={staticDataLoading}
                onClick={() => void onRefreshStaticData()}
              >
                <ReloadOutlined />
                <span>更新静态资料</span>
              </button>
              <small>同步式神面板与御魂套装资料，不会更新当前账号数据</small>
            </div>
          </section>
        </nav>
      </Drawer>
    </>
  );
}
