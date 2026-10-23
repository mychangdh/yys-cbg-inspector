import "./index.scss";
import {
  AppstoreOutlined,
  HistoryOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { Drawer } from "antd";
import { useState } from "react";
import { setHistoryOpen, useAppDispatch, useAppSelector } from "@/store";
import type { PageNavigationProps } from "@/types/layout";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useMobileLayout } from "../mobileLayout";

export function PageNavigation({
  guardedPage,
  showNavigation,
  navigationItems,
  onNavigate,
  themeMode,
  onToggleTheme,
}: PageNavigationProps) {
  const dispatch = useAppDispatch();
  const isMobile = useMobileLayout();
  const { updating, history } = useAppSelector((state) => state.app);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const currentItem = navigationItems.find(
    (item) => item.route === guardedPage,
  );
  const bottomNavigationItems = navigationItems.filter(
    (item) => item.route === "maintenance" || item.route === "about",
  );
  const mainNavigationItems = navigationItems.filter(
    (item) => item.route !== "maintenance" && item.route !== "about",
  );

  if (!showNavigation || !currentItem) return null;

  const renderLinks = (items = navigationItems, mobile = false) =>
    items.map((item) => (
      <button
        key={item.route}
        className={guardedPage === item.route ? "is-active" : undefined}
        type="button"
        title={item.label}
        aria-label={item.label}
        aria-current={guardedPage === item.route ? "page" : undefined}
        onClick={() => {
          if (mobile) setMobileMenuOpen(false);
          onNavigate(item.route);
        }}
      >
        <item.icon />
        <span className="page-sidebar-link-label">{item.label}</span>
      </button>
    ));

  const utilityActions = (
    <>
      <button
        className="page-menu-action"
        type="button"
        aria-label="历史记录"
        disabled={updating || history.length === 0}
        onClick={() => {
          setMobileMenuOpen(false);
          dispatch(setHistoryOpen(true));
        }}
      >
        <HistoryOutlined />
        <span className="page-sidebar-action-label">历史记录</span>
      </button>
      <ThemeToggle themeMode={themeMode} onToggle={onToggleTheme} />
    </>
  );

  return (
    <>
      <aside
        className={`page-sidebar${sidebarCollapsed ? " is-collapsed" : ""}`}
        aria-label="主导航"
      >
        <div className="page-sidebar-brand">
          <span className="page-sidebar-mark" aria-hidden="true">
            <AppstoreOutlined />
          </span>
          <div className="page-sidebar-brand-copy">
            <strong>阴阳师藏宝阁看号工具</strong>
            <span>账号分析工作区</span>
          </div>
          <button
            className="page-sidebar-collapse"
            type="button"
            aria-label={sidebarCollapsed ? "展开菜单" : "折叠菜单"}
            title={sidebarCollapsed ? "展开菜单" : "折叠菜单"}
            aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        </div>
        <span className="page-sidebar-group-label">工作区</span>
        <nav className="page-sidebar-links" aria-label="页面导航">
          {renderLinks(mainNavigationItems)}
        </nav>
        <div className="page-sidebar-footer">
          <nav className="page-sidebar-links" aria-label="维护与关于">
            {renderLinks(bottomNavigationItems)}
          </nav>
          <div className="page-sidebar-actions">{utilityActions}</div>
        </div>
      </aside>

      {isMobile && (
        <header className="page-mobile-header">
          <div className="page-mobile-current" aria-live="polite">
            <currentItem.icon />
            <span>{currentItem.label}</span>
          </div>
          <button
            className="page-mobile-trigger"
            type="button"
            aria-label="打开功能菜单"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >
            <MenuOutlined />
            <span>菜单</span>
          </button>
          <Drawer
            width="min(88vw, 320px)"
            placement="right"
            title="功能菜单"
            open={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
          >
            <div className="page-mobile-links">
              {renderLinks(mainNavigationItems, true)}
            </div>
            <div className="page-mobile-links page-mobile-bottom-links">
              {renderLinks(bottomNavigationItems, true)}
            </div>
            <div className="page-mobile-actions">{utilityActions}</div>
          </Drawer>
        </header>
      )}
    </>
  );
}
