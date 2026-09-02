import {
  DownloadOutlined,
  HistoryOutlined,
  MenuOutlined,
  ReloadOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { Drawer } from "antd";
import Link from "next/link";
import {
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
  const { updating, history, mobileMenuOpen, staticDataLoading } =
    useAppSelector((state) => state.app);
  const currentMenuItem =
    menuItems.find((item) => item.page === guardedPage) || menuItems[0];
  const desktopItemsRef = useRef<HTMLDivElement>(null);
  const activeLinkRef = useRef<HTMLAnchorElement>(null);
  const highlightFrame = useRef<number | null>(null);
  const [highlight, setHighlight] = useState({ offset: 0, width: 0 });
  const [menuHidden, setMenuHidden] = useState(false);
  const [isWindowsPc, setIsWindowsPc] = useState(false);

  useEffect(() => {
    setIsWindowsPc(/Windows NT/i.test(window.navigator.userAgent));
  }, []);

  useEffect(() => {
    const scrollContainer = document.querySelector<HTMLElement>(
      ".page-route-transition",
    );
    const updateMenuVisibility = () => {
      const windowScrollTop = Math.max(window.scrollY, 0);
      const containerScrollTop = Math.max(scrollContainer?.scrollTop || 0, 0);
      setMenuHidden(Math.max(windowScrollTop, containerScrollTop) > 8);
    };

    updateMenuVisibility();
    window.addEventListener("scroll", updateMenuVisibility, { passive: true });
    scrollContainer?.addEventListener("scroll", updateMenuVisibility, {
      passive: true,
    });
    return () => {
      window.removeEventListener("scroll", updateMenuVisibility);
      scrollContainer?.removeEventListener("scroll", updateMenuVisibility);
    };
  }, []);

  useLayoutEffect(() => {
    const updateHighlight = () => {
      if (highlightFrame.current !== null) return;

      highlightFrame.current = window.requestAnimationFrame(() => {
        highlightFrame.current = null;
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
      });
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
      if (highlightFrame.current !== null) {
        window.cancelAnimationFrame(highlightFrame.current);
        highlightFrame.current = null;
      }
    };
  }, [guardedPage]);

  if (!showNavigation || !currentMenuItem) return null;

  const highlightStyle = {
    "--menu-highlight-offset": `${highlight.offset}px`,
    "--menu-highlight-width": `${highlight.width}px`,
  } as CSSProperties;

  return (
    <>
      <div className={styles.pageMenuWrap}>
        <nav
          className={`${styles.pageMenu}${menuHidden ? ` ${styles.isHidden}` : ""}`}
          aria-label="页面切换"
        >
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
                onNavigate={(event) => {
                  if (item.page === guardedPage) {
                    event.preventDefault();
                    return;
                  }
                  onNavigationStart();
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
        {isWindowsPc && (
          <a
            className={`${styles.pageMenuAppDownload}${menuHidden ? ` ${styles.isHidden}` : ""}`}
            href="https://share.feijipan.com/s/4b7LXxbh"
            target="_blank"
            rel="noreferrer"
            aria-label="下载 Windows 客户端"
          >
            <DownloadOutlined />
            <span>下载 Windows 版安装包</span>
          </a>
        )}
        {menuHidden && (
          <button
            className={styles.pageMenuReveal}
            type="button"
            aria-label="回到顶部并显示页面菜单"
            title="回到顶部并显示页面菜单"
            onClick={() => {
              window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
              document
                .querySelector<HTMLElement>(".page-route-transition")
                ?.scrollTo({
                  top: 0,
                  left: 0,
                  behavior: "smooth",
                });
            }}
          >
            <UpOutlined />
          </button>
        )}
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
                onNavigate={(event) => {
                  dispatch(setMobileMenuOpen(false));
                  if (item.page === guardedPage) {
                    event.preventDefault();
                    return;
                  }
                  onNavigationStart();
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
