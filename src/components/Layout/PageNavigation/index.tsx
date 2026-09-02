import {
  HistoryOutlined,
  MenuOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Drawer } from "antd";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store";
import { setHistoryOpen, setMobileMenuOpen } from "@/store";
import { menuItems, type AppPage } from "@/config/menu";
import styles from "./index.module.scss";

type PageNavigationProps = {
  guardedPage: AppPage;
  showNavigation: boolean;
  onRefreshStaticData: () => void | Promise<void>;
  onNavigationStart: () => void;
};

export function PageNavigation({
  guardedPage,
  showNavigation,
  onRefreshStaticData,
  onNavigationStart,
}: PageNavigationProps) {
  const dispatch = useAppDispatch();
  const { updating, history, mobileMenuOpen, staticDataLoading } =
    useAppSelector((state) => state.app);
  const currentMenuItem =
    menuItems.find((item) => item.page === guardedPage) || menuItems[0];
  const startNavigation = (page: PageNavigationProps["guardedPage"]) => {
    if (page !== guardedPage) onNavigationStart();
  };

  if (!showNavigation || !currentMenuItem) return null;

  return (
    <>
      <div className="width page-menu-wrap">
        <nav className={styles.pageMenu} aria-label="页面切换">
          <div className={styles.pageMenuMobileCurrent} aria-live="polite">
            <currentMenuItem.icon />
            <span>{currentMenuItem.label}</span>
          </div>
          <div className={styles.pageMenuDesktopItems}>
            {menuItems.map((item) => (
              <Link
                key={item.page}
                className={
                  guardedPage === item.page ? styles.isActive : undefined
                }
                aria-current={guardedPage === item.page ? "page" : undefined}
                href={item.href}
                scroll={false}
                prefetch={false}
                onNavigate={() => startNavigation(item.page)}
              >
                <item.icon />
                <span>{item.label}</span>
              </Link>
            ))}
            <button
              className={styles.pageMenuHistory}
              type="button"
              aria-label="History"
              title="History"
              disabled={updating || history.length === 0}
              onClick={() => dispatch(setHistoryOpen(true))}
            >
              <HistoryOutlined />
            </button>
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
        </nav>
      </div>
      <Drawer
        placement="right"
        rootClassName={styles.mobileNavigationDrawer}
        title="功能菜单"
        open={mobileMenuOpen}
        onClose={() => dispatch(setMobileMenuOpen(false))}
      >
        <nav className={styles.mobileNavigationList} aria-label="功能菜单">
          <section
            className={styles.mobileNavigationPages}
            aria-label="页面导航"
          >
            {menuItems.map((item) => (
              <Link
                key={item.page}
                className={
                  guardedPage === item.page ? styles.isActive : undefined
                }
                aria-current={guardedPage === item.page ? "page" : undefined}
                href={item.href}
                scroll={false}
                prefetch={false}
                onNavigate={() => {
                  dispatch(setMobileMenuOpen(false));
                  startNavigation(item.page);
                }}
              >
                <item.icon />
                <span>{item.label}</span>
              </Link>
            ))}
          </section>
          <section
            className={styles.mobileNavigationActions}
            aria-label="数据操作"
          >
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
            <div className={styles.staticRefreshMenuItem}>
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
