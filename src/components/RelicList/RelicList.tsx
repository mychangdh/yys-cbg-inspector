import "./RelicList.scss";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowLeftOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { Button, Card, List, Modal, Tag, Typography } from "antd";
import { RelicIcon } from "../RelicIcon/RelicIcon";
import {
  buildEnhancementStages,
  formatAttribute,
  formatDetailedNumber,
  getAttributeHitCount,
  getDetailedSubAttributes,
  getStageAttributeHitCount,
  sortAttributes,
} from "../../lib/relics";
import type { EnhancementStage, RelicView } from "../../types";

function getSubAttributeHighlightClasses(
  item: RelicView,
  attribute: { label: string; value: number },
  highlightedAttributes: ReadonlySet<string>,
) {
  const classes: string[] = [];
  const isSpeed = attribute.label === "速度";
  const isSecondPositionSpeed =
    item.position === 2 && item.mainAttribute?.label === "速度";

  if (highlightedAttributes.has(attribute.label)) {
    classes.push("is-filter-match");
  }

  // 2 号位非主速度时，副速度不作为一速卖点展示。
  if (
    isSpeed &&
    attribute.value > 17 &&
    (item.position !== 2 || isSecondPositionSpeed)
  ) {
    classes.push("is-speed-seller-point");
    if (isSecondPositionSpeed)
      classes.push("is-second-position-speed-seller-point");
  }

  return classes.join(" ");
}

function EnhancementStageCard({
  item,
  stage,
  highlightedAttributes,
}: {
  item: RelicView;
  stage: EnhancementStage;
  highlightedAttributes: ReadonlySet<string>;
}) {
  return (
    <div className={`enhance-stage${stage.available ? "" : " is-unavailable"}`}>
      <RelicIcon
        item={item}
        compact
        displayLevel={stage.level}
        showLevelBadge
      />
      {stage.available ? (
        <div className="enhance-stage-attributes">
          {stage.mainAttribute && (
            <div className="enhance-main-attribute">
              <span>
                <i className="attribute-hit-count is-empty" />
                {stage.mainAttribute.label}
              </span>
              <strong>+{formatAttribute(stage.mainAttribute)}</strong>
            </div>
          )}
          {sortAttributes(stage.attributes).map((attribute) => {
            const isUpgraded = stage.upgrade?.key === attribute.key;
            const hitCount = getStageAttributeHitCount(item, attribute);
            return (
              <div
                className={`enhance-stage-attribute${isUpgraded ? " is-upgraded" : ""} ${getSubAttributeHighlightClasses(item, attribute, highlightedAttributes)}`}
                key={attribute.key}
                title={attribute.values
                  .map((value) => value.toFixed(15))
                  .join(" + ")}
              >
                <span>
                  <i
                    className={`attribute-hit-count${hitCount > 0 ? "" : " is-empty"}`}
                  >
                    {hitCount > 0 ? hitCount : ""}
                  </i>
                  <em>{attribute.label}</em>
                  {isUpgraded && stage.upgrade?.isNew && (
                    <Tag color="red">NEW</Tag>
                  )}
                </span>
                <strong>+{attribute.value.toFixed(2)}</strong>
              </div>
            );
          })}
        </div>
      ) : (
        <Typography.Text type="secondary" className="enhance-not-yet">
          未强化
        </Typography.Text>
      )}
    </div>
  );
}

function EnhancementDetails({
  item,
  highlightedAttributes,
}: {
  item: RelicView;
  highlightedAttributes: ReadonlySet<string>;
}) {
  const stages =
    item.detail?.enhancementStages ||
    buildEnhancementStages(
      item.detail?.growthRolls,
      item.level,
      item.mainAttribute,
      item.quality,
    ).enhancementStages;

  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeStage = stages[activeIndex] || stages[0];

  const switchStage = (nextIndex: number) => {
    const safeIndex = Math.max(0, Math.min(stages.length - 1, nextIndex));
    setActiveIndex(safeIndex);
    trackRef.current?.children[safeIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  };

  return (
    <section className="enhance-mobile-switcher" aria-label="强化过程">
      <div className="enhance-mobile-switcher-controls">
        <button
          type="button"
          aria-label="上一强化阶段"
          disabled={activeIndex === 0}
          onClick={() => switchStage(activeIndex - 1)}
        >
          <ArrowLeftOutlined />
        </button>
        <strong>+{activeStage?.level ?? 0}</strong>
        <button
          type="button"
          aria-label="下一强化阶段"
          disabled={activeIndex >= stages.length - 1}
          onClick={() => switchStage(activeIndex + 1)}
        >
          <ArrowRightOutlined />
        </button>
      </div>
      <div
        className="enhance-mobile-stage-track"
        ref={trackRef}
        onScroll={(event) => {
          const width = event.currentTarget.clientWidth;
          if (!width) return;
          setActiveIndex(
            Math.max(
              0,
              Math.min(
                stages.length - 1,
                Math.round(event.currentTarget.scrollLeft / width),
              ),
            ),
          );
        }}
      >
        {stages.map((stage) => (
          <div className="enhance-mobile-stage-slide" key={stage.level}>
            <EnhancementStageCard
              item={item}
              stage={stage}
              highlightedAttributes={highlightedAttributes}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export function RelicList({
  items,
  highlightedSubAttributes,
  highlightedSuitNames = [],
  desktopColumns,
  desktopRows,
  disablePagination = false,
  itemBadge,
  hiddenMainAttributePositions = [],
}: {
  items: RelicView[];
  highlightedSubAttributes: string[];
  highlightedSuitNames?: string[];
  desktopColumns?: number;
  desktopRows?: number;
  /** 移动端每页展示数量，默认两列三行。 */
  /** 用于需要连续展示全部御魂的页面，例如 PVE 高评分列表。 */
  disablePagination?: boolean;
  itemBadge?: (item: RelicView) => ReactNode;
  /** 在特定上下文隐藏指定号位的主属性，例如满速二号位列表。 */
  hiddenMainAttributePositions?: number[];
}) {
  const [selected, setSelected] = useState<RelicView | null>(null);
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const listViewportRef = useRef<HTMLDivElement>(null);
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
      const firstCard = viewport.querySelector<HTMLElement>(".relic-card");
      const viewportTop = viewport.getBoundingClientRect().top;
      const cardTop = firstCard
        ? firstCard.getBoundingClientRect().top
        : viewportTop;
      const cardHeight = firstCard?.getBoundingClientRect().height || 150;
      const columns = desktopColumns || 4;
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
  }, [desktopColumns, desktopRows, items.length]);

  const totalPages = disablePagination
    ? 1
    : Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  return (
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
            const hideMainAttribute = hiddenMainAttributePositionSet.has(
              item.position,
            );
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
                    <span className="relic-card-extra">{itemBadge(item)}</span>
                  )}
                </div>
                <div className="relic-card-body">
                  <div className="relic-card-visual">
                    <RelicIcon item={item} />
                    {item.setBonusAttribute && (
                      <div className="relic-one-piece-effect">
                        <span>
                          <i className="relic-one-piece-desktop">一件套</i>
                          <i className="relic-one-piece-mobile">
                            {item.setBonusAttribute.label}：
                          </i>
                        </span>
                        <strong>
                          <i className="relic-one-piece-desktop">
                            {item.setBonusAttribute.label} +
                          </i>
                          {formatAttribute(item.setBonusAttribute)}
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
                        index === 0 && !hideMainAttribute && item.mainAttribute;
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
        rootClassName="relic-list-modal"
      >
        {selected && (
          <div className="roll-modal">
            <div className="enhance-timeline">
              {(
                selected.detail?.enhancementStages ||
                buildEnhancementStages(
                  selected.detail?.growthRolls,
                  selected.level,
                  selected.mainAttribute,
                  selected.quality,
                ).enhancementStages
              ).map((stage, index, stages) => (
                <div className="enhance-stage-flow" key={stage.level}>
                  <div
                    className={`enhance-stage${stage.available ? "" : " is-unavailable"}`}
                  >
                    <RelicIcon
                      item={selected}
                      compact
                      displayLevel={stage.level}
                      showLevelBadge
                    />
                    {stage.available ? (
                      <div className="enhance-stage-attributes">
                        {stage.mainAttribute && (
                          <div className="enhance-main-attribute">
                            <span>
                              <i className="attribute-hit-count is-empty" />
                              {stage.mainAttribute.label}
                            </span>
                            <strong>
                              +{formatAttribute(stage.mainAttribute)}
                            </strong>
                          </div>
                        )}
                        {sortAttributes(stage.attributes).map((attribute) => {
                          const isUpgraded =
                            stage.upgrade?.key === attribute.key;
                          const hitCount = getStageAttributeHitCount(
                            selected,
                            attribute,
                          );
                          return (
                            <div
                              className={`enhance-stage-attribute${isUpgraded ? " is-upgraded" : ""} ${getSubAttributeHighlightClasses(selected, attribute, highlightedSubAttributeSet)}`}
                              key={attribute.key}
                              title={attribute.values
                                .map((value) => value.toFixed(15))
                                .join(" + ")}
                            >
                              <span>
                                <i
                                  className={`attribute-hit-count${hitCount > 0 ? "" : " is-empty"}`}
                                >
                                  {hitCount > 0 ? hitCount : ""}
                                </i>
                                <em>{attribute.label}</em>
                                {isUpgraded && stage.upgrade?.isNew && (
                                  <Tag color="red">NEW</Tag>
                                )}
                              </span>
                              <strong>+{attribute.value.toFixed(2)}</strong>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Typography.Text
                        type="secondary"
                        className="enhance-not-yet"
                      >
                        未强化
                      </Typography.Text>
                    )}
                  </div>
                  {index < stages.length - 1 && (
                    <ArrowRightOutlined className="enhance-stage-arrow" />
                  )}
                </div>
              ))}
            </div>
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
                    <strong>+{formatDetailedNumber(attribute.total)}</strong>
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
        )}
      </Modal>
    </div>
  );
}
