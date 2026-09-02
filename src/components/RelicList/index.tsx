import styles from "./index.module.scss";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
  type ReactNode,
} from "react";
import { Button, Card, List, Modal, Typography } from "antd";
import { RelicIcon } from "../RelicIcon";
import { EnhancementDetails } from "./EnhancementDetails";
import { EnhancementTimeline } from "./EnhancementTimeline";
import {
  formatAttribute,
  formatDetailedNumber,
  getAttributeHitCount,
  getDetailedSubAttributes,
  sortAttributes,
} from "@/lib/relics";
import type { AttributeView, RelicView } from "@/types";
import { getSubAttributeHighlightClasses } from "./enhancementUtils";

type RelicListProps = {
  items: RelicView[];
  highlightedSubAttributes: string[];
  highlightedSuitNames?: string[];
  desktopColumns?: number;
  desktopRows?: number;
  mobileSwipePagination?: boolean;
  mobilePageSize?: number;
  disablePagination?: boolean;
  itemBadge?: (item: RelicView) => ReactNode;
  hiddenMainAttributePositions?: number[];
};

export function RelicList({
  items,
  highlightedSubAttributes,
  highlightedSuitNames = [],
  desktopColumns,
  desktopRows,
  mobileSwipePagination = true,
  mobilePageSize = 6,
  disablePagination = false,
  itemBadge,
  hiddenMainAttributePositions = [],
}: RelicListProps) {
  const [selected, setSelected] = useState<RelicView | null>(null);
  /** 逢魔御魂的一件套效果只展示整数，避免较长小数挤压卡片内容。 */
  const formatOmaOnePieceAttribute = (attribute: AttributeView) =>
    `${Math.round(attribute.value)}${attribute.isPercent ? "%" : ""}`;
  const [pageSize, setPageSize] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= 760
      ? mobilePageSize
      : 8,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const listViewportRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const highlightedSubAttributeSet = useMemo(
    () => new Set(highlightedSubAttributes),
    [highlightedSubAttributes],
  );
  const highlightedSuitNameSet = useMemo(
    () => new Set(highlightedSuitNames),
    [highlightedSuitNames],
  );
  const hiddenMainAttributePositionSet = useMemo(
    () => new Set(hiddenMainAttributePositions),
    [hiddenMainAttributePositions],
  );

  useLayoutEffect(() => {
    const updatePageSize = () => {
      const viewport = listViewportRef.current;
      if (!viewport || !items.length) return;

      // 移动端始终为两列三行，首帧已按 6 条渲染，无需等待测量后再调整。
      if (window.innerWidth <= 760) {
        setPageSize((current) =>
          current === mobilePageSize ? current : mobilePageSize,
        );
        return;
      }

      const firstCard = viewport.querySelector<HTMLElement>(".relic-card");
      const viewportTop = viewport.getBoundingClientRect().top;
      const cardTop = firstCard
        ? firstCard.getBoundingClientRect().top
        : viewportTop;
      const cardHeight = firstCard?.getBoundingClientRect().height || 150;
      const viewportWidth = window.innerWidth;
      const defaultColumns =
        viewportWidth <= 760
          ? 2
          : viewportWidth <= 1120
            ? 3
            : viewportWidth >= 1320
              ? 5
              : 4;
      const columns =
        viewportWidth <= 760
          ? defaultColumns
          : desktopColumns || defaultColumns;
      // 为底部分页和卡片间隙预留空间，保证本页无需再滚动。
      const availableHeight = Math.max(
        cardHeight,
        window.innerHeight - cardTop - 62,
      );
      const visibleRows = Math.max(1, Math.floor(availableHeight / cardHeight));
      // 移动端固定三行；内容超过当前视口时交给页面自然滚动查看。
      const rows = desktopRows || visibleRows;
      const nextPageSize = Math.min(items.length, columns * rows);

      setPageSize((current) =>
        current === nextPageSize ? current : nextPageSize,
      );
    };

    const frame = window.requestAnimationFrame(updatePageSize);
    const observer = new ResizeObserver(updatePageSize);
    if (listViewportRef.current) observer.observe(listViewportRef.current);
    window.addEventListener("resize", updatePageSize);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", updatePageSize);
    };
  }, [desktopColumns, desktopRows, items.length, mobilePageSize]);

  const totalPages = disablePagination
    ? 1
    : Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (disablePagination || !mobileSwipePagination || window.innerWidth > 760)
      return;
    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (
      !start ||
      disablePagination ||
      !mobileSwipePagination ||
      window.innerWidth > 760
    )
      return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    setCurrentPage((page) =>
      Math.max(1, Math.min(totalPages, page + (deltaX < 0 ? 1 : -1))),
    );
  };

  return (
    <div className={styles.scope}>
      <div
        className={
          "relic-list-root" +
          (desktopColumns
            ? " relic-list-root-fixed-" + desktopColumns + "-columns"
            : "")
        }
      >
        <div
          className="relic-list-viewport"
          ref={listViewportRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            swipeStartRef.current = null;
          }}
        >
          <List
            className="relic-list"
            pagination={
              disablePagination
                ? false
                : {
                    current: currentPage,
                    pageSize,
                    onChange: setCurrentPage,
                    showSizeChanger: false,
                    showLessItems: true,
                    responsive: false,
                    hideOnSinglePage: false,
                    position: "bottom",
                    align: "center",
                  }
            }
            dataSource={items}
            renderItem={(item) => {
              const hideMainAttribute =
                item.position !== undefined &&
                hiddenMainAttributePositionSet.has(item.position);
              const attributes = [
                ...(item.mainAttribute && !hideMainAttribute
                  ? [item.mainAttribute]
                  : []),
                ...sortAttributes(item.subAttributes || []),
              ];

              return (
                <List.Item>
                  <Card
                    className={
                      "relic-card" +
                      (highlightedSuitNameSet.has(item.suit?.name || "")
                        ? " is-highlighted-suit"
                        : "")
                    }
                    hoverable
                    onClick={() => setSelected(item)}
                  >
                    <div className="relic-card-head">
                      <Typography.Text strong>
                        {item.suit?.name || "未知御魂"}
                        <em className="relic-name-level">+{item.level || 0}</em>
                      </Typography.Text>
                      {itemBadge && (
                        <span className="relic-card-extra">
                          {itemBadge(item)}
                        </span>
                      )}
                    </div>
                    <div className="relic-card-body">
                      <div className="relic-card-visual">
                        <RelicIcon item={item} />
                        {item.setBonusAttribute && (
                          <div className="relic-one-piece-effect">
                            <span>
                              <i className="relic-one-piece-mobile">
                                {item.setBonusAttribute.label}：
                              </i>
                            </span>
                            <strong>
                              <i className="relic-one-piece-desktop">
                                {item.setBonusAttribute.label} +
                              </i>
                              {formatOmaOnePieceAttribute(
                                item.setBonusAttribute,
                              )}
                            </strong>
                          </div>
                        )}
                      </div>
                      <div>
                        {attributes.map((attribute, index) => {
                          const hitCount =
                            !hideMainAttribute && index > 0
                              ? getAttributeHitCount(item, attribute.label)
                              : 0;
                          const isMainAttribute =
                            index === 0 &&
                            !hideMainAttribute &&
                            item.mainAttribute;
                          return (
                            <div
                              className={`relic-attr${isMainAttribute ? " is-main-attribute" : ""}${isMainAttribute ? "" : ` ${getSubAttributeHighlightClasses(item, attribute, highlightedSubAttributeSet)}`}`}
                              key={`${attribute.label}-${index}`}
                            >
                              <span>
                                <i
                                  className={`attribute-hit-count${hitCount > 0 ? "" : " is-empty"}`}
                                >
                                  {hitCount > 0 ? hitCount : ""}
                                </i>
                                <em>{attribute.label}</em>
                              </span>
                              <b>+{formatAttribute(attribute)}</b>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                </List.Item>
              );
            }}
          />
        </div>
      </div>
      <Modal
        title={`${selected?.suit?.name || "御魂"} 强化详情`}
        open={Boolean(selected)}
        onCancel={() => setSelected(null)}
        footer={
          <Button type="primary" onClick={() => setSelected(null)}>
            关闭
          </Button>
        }
        width={1060}
        className="enhancement-modal"
        rootClassName={styles.scope}
      >
        {selected && (
          <div className={styles.scope}>
            <div className="relic-list-modal">
              <div className="roll-modal">
                <EnhancementTimeline
                  item={selected}
                  highlightedAttributes={highlightedSubAttributeSet}
                />
                <EnhancementDetails
                  item={selected}
                  highlightedAttributes={highlightedSubAttributeSet}
                />
                <section className="relic-detail-modal-content">
                  <h3>精确副属性</h3>
                  {getDetailedSubAttributes(selected).map((attribute) => (
                    <div
                      className={`relic-detail-modal-row ${getSubAttributeHighlightClasses(selected, { label: attribute.label, value: attribute.total }, highlightedSubAttributeSet)}`}
                      key={attribute.key}
                    >
                      <div className="relic-detail-modal-total">
                        <span>{attribute.label}</span>
                        <strong>
                          +{formatDetailedNumber(attribute.total)}
                        </strong>
                      </div>
                      <code>
                        {attribute.values
                          .map((value) => formatDetailedNumber(value))
                          .join(" + ")}
                      </code>
                    </div>
                  ))}
                </section>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
