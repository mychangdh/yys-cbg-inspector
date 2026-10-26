import {
  DownloadOutlined,
  HistoryOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Drawer } from "antd";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { setHistoryOpen, setMobileMenuOpen } from "@/store";
import { menuItems, type AppPage } from "@/config/menu";
import { toPublicPath } from "@/config/paths";
import type { ThemeMode } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "./index.module.scss";

type PageNavigationProps = {
  guardedPage: AppPage;
  showNavigation: boolean;
  hasLoadedProduct: boolean;
  onRefreshStaticData: () => void | Promise<void>;
  onNavigationStart: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
};

export function PageNavigation({
  guardedPage,
  showNavigation,
  hasLoadedProduct,
  onRefreshStaticData,
  onNavigationStart,
  themeMode,
  onToggleTheme,
  sidebarCollapsed,
  onToggleSidebar,
}: PageNavigationProps) {
  const dispatch = useAppDispatch();
  const { updating, history, mobileMenuOpen, staticDataLoading } =
    useAppSelector((state) => state.app);
  const visibleMenuItems = hasLoadedProduct
    ? menuItems
    : menuItems.filter((item) => item.page === "home");
  const currentMenuItem =
    visibleMenuItems.find((item) => item.page === guardedPage) ||
    visibleMenuItems[0];
  const [isWindowsPc, setIsWindowsPc] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    const isMobileDevice =
      /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(userAgent);

    setIsWindowsPc(/Windows NT/i.test(userAgent) && !isMobileDevice);
  }, []);

  if (!showNavigation || !currentMenuItem) return null;

  const renderLinks = (mobile = false) =>
    visibleMenuItems.map((item) => (
      <Link
        key={item.page}
        className={guardedPage === item.page ? styles.isActive : undefined}
        title={item.label}
        aria-label={item.label}
        aria-current={guardedPage === item.page ? "page" : undefined}
        href={item.href}
        scroll={false}
        onNavigate={(event) => {
          if (mobile) dispatch(setMobileMenuOpen(false));
          if (item.page === guardedPage) {
            event.preventDefault();
            return;
          }
          onNavigationStart();
        }}
      >
        <item.icon />
        <span className={styles.sidebarLabel}>{item.label}</span>
      </Link>
    ));

  const openHistory = () => dispatch(setHistoryOpen(true));
  const closeMobileMenu = () => dispatch(setMobileMenuOpen(false));
  const utilityActions: ReactNode = (
    <>
      <button
        type="button"
        aria-label="历史记录"
        disabled={updating || history.length === 0}
        onClick={() => {
          closeMobileMenu();
          openHistory();
        }}
      >
        <HistoryOutlined />
        <span className={styles.sidebarLabel}>历史记录</span>
      </button>
      <div className={styles.themeItem}>
        <ThemeToggle themeMode={themeMode} onToggle={onToggleTheme} />
      </div>
      <div className={styles.staticRefreshItem}>
        <button
          type="button"
          aria-label="更新静态资源"
          title="更新静态资源"
          disabled={staticDataLoading}
          onClick={() => {
            closeMobileMenu();
            void onRefreshStaticData();
          }}
        >
          <ReloadOutlined />
          <span className={styles.sidebarLabel}>更新静态资源</span>
        </button>
        <small>同步式神面板与御魂套装资料，不会更新当前账号数据</small>
      </div>
      {isWindowsPc && (
        <a
          className={styles.appDownload}
          href="https://share.feijipan.com/s/4b7LXxbh"
          target="_blank"
          rel="noreferrer"
          aria-label="下载 Windows 客户端"
        >
          <DownloadOutlined />
          <span className={styles.sidebarLabel}>下载 Windows 版安装包</span>
        </a>
      )}
    </>
  );

  return (
    <>
      <aside
        className={`${styles.sidebar}${sidebarCollapsed ? ` ${styles.sidebarCollapsed}` : ""}`}
        aria-label="主导航"
      >
        <div className={styles.brand}>
          <Image
            className={styles.brandMark}
            src={toPublicPath("/yys-header.png")}
            alt=""
            width={24}
            height={24}
            aria-hidden="true"
          />
          <div className={styles.brandCopy}>
            <strong>阴阳师藏宝阁看号工具</strong>
            <span>账号分析工作区</span>
          </div>
          <button
            className={styles.sidebarCollapse}
            type="button"
            aria-label={sidebarCollapsed ? "展开菜单" : "折叠菜单"}
            title={sidebarCollapsed ? "展开菜单" : "折叠菜单"}
            aria-expanded={!sidebarCollapsed}
            onClick={onToggleSidebar}
          >
            {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        </div>
        <div className={styles.navGroupLabel}>工作区</div>
        <nav className={styles.pageMenuDesktopItems} aria-label="页面导航">
          {renderLinks()}
        </nav>
        <div className={styles.sidebarActions}>{utilityActions}</div>
      </aside>

      <header className={styles.mobileHeader}>
        <div className={styles.pageMenuMobileCurrent} aria-live="polite">
          <currentMenuItem.icon />
          <span>{currentMenuItem.label}</span>
        </div>
        <button
          className={styles.pageMenuMobileTrigger}
          type="button"
          aria-label="打开功能菜单"
          title="功能菜单"
          aria-expanded={mobileMenuOpen}
          onClick={() => dispatch(setMobileMenuOpen(true))}
        >
          <MenuOutlined />
          <span>菜单</span>
        </button>
      </header>

      <Drawer
        width="min(88vw, 320px)"
        placement="right"
        rootClassName={styles.mobileNavigationDrawer}
        title="功能菜单"
        open={mobileMenuOpen}
        onClose={closeMobileMenu}
      >
        <nav className={styles.mobileNavigationList} aria-label="功能菜单">
          <section
            className={styles.mobileNavigationPages}
            aria-label="页面导航"
          >
            <div className={styles.navGroupLabel}>工作区</div>
            {renderLinks(true)}
          </section>
          <section
            className={styles.mobileNavigationActions}
            aria-label="数据操作"
          >
            {utilityActions}
          </section>
        </nav>
      </Drawer>
    </>
  );
}
