import {
  HistoryOutlined,
  MenuOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Drawer } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
  const router = useRouter();
  const { updating, history, mobileMenuOpen, staticDataLoading } =
    useAppSelector((state) => state.app);
  const currentMenuItem =
    menuItems.find((item) => item.page === guardedPage) || menuItems[0];
  const desktopItemsRef = useRef<HTMLDivElement>(null);
  const activeLinkRef = useRef<HTMLAnchorElement>(null);
  const navigationFrame = useRef<number | null>(null);
  const [highlight, setHighlight] = useState({ offset: 0, width: 0 });

  useLayoutEffect(() => {
    const updateHighlight = () => {
      const container = desktopItemsRef.current;
      const link = activeLinkRef.current;
      if (!container || !link) return;

      const containerRect = container.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      const nextHighlight = {
        offset: linkRect.left - containerRect.left,
        width: linkRect.width,
      };
      setHighlight((current) =>
        current.offset === nextHighlight.offset &&
        current.width === nextHighlight.width
          ? current
          : nextHighlight,
      );
    };

    updateHighlight();
    window.addEventListener("resize", updateHighlight);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(updateHighlight);
    if (desktopItemsRef.current) observer?.observe(desktopItemsRef.current);
    if (activeLinkRef.current) observer?.observe(activeLinkRef.current);

    return () => {
      window.removeEventListener("resize", updateHighlight);
      observer?.disconnect();
    };
  }, [guardedPage]);

  useEffect(() => {
    return () => {
      if (navigationFrame.current !== null) {
        window.cancelAnimationFrame(navigationFrame.current);
      }
    };
  }, []);

  const startNavigation = (item: (typeof menuItems)[number]) => {
    if (item.page === guardedPage) return;
    if (navigationFrame.current !== null) {
      window.cancelAnimationFrame(navigationFrame.current);
    }
    onNavigationStart();
    navigationFrame.current = window.requestAnimationFrame(() => {
      navigationFrame.current = null;
      startTransition(() => {
        router.push(item.href, { scroll: false });
      });
    });
  };

  if (!showNavigation || !currentMenuItem) return null;

  const highlightStyle = {
    "--menu-highlight-offset": `${highlight.offset}px`,
    "--menu-highlight-width": `${highlight.width}px`,
  } as CSSProperties;

  return (
    <>
      <div className={styles.pageMenuWrap}>
        <nav className={styles.pageMenu} aria-label="页面切换">
          <div className={styles.pageMenuMobileCurrent} aria-live="polite">
            <currentMenuItem.icon />
            <span>{currentMenuItem.label}</span>
          </div>
          <div
            className={styles.pageMenuDesktopItems}
            ref={desktopItemsRef}
            style={highlightStyle}
          >
            <span
              className={styles.pageMenuActiveIndicator}
              aria-hidden="true"
            />
            {menuItems.map((item) => (
              <Link
                key={item.page}
                ref={guardedPage === item.page ? activeLinkRef : undefined}
                className={
                  guardedPage === item.page ? styles.isActive : undefined
                }
                aria-current={guardedPage === item.page ? "page" : undefined}
                href={item.href}
                scroll={false}
                prefetch={false}
                onNavigate={(event) => {
                  event.preventDefault();
                  startNavigation(item);
                }}
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
                onNavigate={(event) => {
                  event.preventDefault();
                  dispatch(setMobileMenuOpen(false));
                  startNavigation(item);
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
