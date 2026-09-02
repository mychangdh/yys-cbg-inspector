import "./index.scss";
import { HistoryOutlined } from "@ant-design/icons";
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
  const desktopItemsRef = useRef<HTMLDivElement>(null);
  const activeButtonRef = useRef<HTMLButtonElement>(null);
  const [highlight, setHighlight] = useState({ offset: 0, width: 0 });

  useLayoutEffect(() => {
    const updateHighlight = () => {
      const container = desktopItemsRef.current;
      const button = activeButtonRef.current;
      if (!container || !button) return;

      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const nextHighlight = {
        offset: buttonRect.left - containerRect.left,
        width: buttonRect.width,
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
    if (activeButtonRef.current) observer?.observe(activeButtonRef.current);

    return () => {
      window.removeEventListener("resize", updateHighlight);
      observer?.disconnect();
    };
  }, [guardedPage, desktopNavigationItems]);

  if (!showNavigation || !currentNavigation) return null;

  const highlightStyle = {
    "--menu-highlight-offset": `${highlight.offset}px`,
    "--menu-highlight-width": `${highlight.width}px`,
  } as CSSProperties;

  return (
    <div className="width page-menu-wrap page-navigation">
      <nav className="page-menu" aria-label="页面切换">
        <div className="page-menu-desktop-items" ref={desktopItemsRef}>
          <div
            className="page-menu-active-indicator"
            style={highlightStyle}
            aria-hidden="true"
          />
          {desktopNavigationItems.map((item) => (
            <button
              key={item.route}
              ref={guardedPage === item.route ? activeButtonRef : undefined}
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
