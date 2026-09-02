import { Empty, Tabs } from "antd";
import { RelicList } from "@/components/RelicList";
import type { HighScoreRelicListProps } from "@/types";
import styles from "./index.module.scss";

export function HighScoreRelicList({
  title,
  groups,
  activePosition,
  onPositionChange,
}: HighScoreRelicListProps) {
  const groupByPosition = new Map(
    groups.map((group) => [String(group.position), group]),
  );
  const positionStats = [1, 2, 3, 4, 5, 6].map((position) => ({
    position,
    count: groupByPosition.get(String(position))?.relics.length || 0,
  }));

  return (
    <div className={styles.scope}>
      <section className="pve-high-score-relics__category">
        <h3>{title}</h3>
        {groups.length ? (
          <Tabs
            className="pve-high-score-relics__tabs"
            activeKey={activePosition}
            items={positionStats.map(({ position, count }) => {
              const group = groupByPosition.get(String(position));
              const scoreByRelicId = new Map(
                (group?.relics || []).map((item) => [item.relic.id, item]),
              );
              return {
                key: String(position),
                label: (
                  <span className="pve-high-score-relics__tab-label">
                    <b>{position} 号位</b>
                    <small>({count})</small>
                  </span>
                ),
                children: group ? (
                  <RelicList
                    desktopColumns={5}
                    desktopRows={3}
                    highlightedSubAttributes={["攻击加成", "暴击", "暴击伤害"]}
                    items={group.relics.map((item) => item.relic)}
                    mobilePageSize={12}
                    itemBadge={(relic) => {
                      const score = scoreByRelicId.get(relic.id);
                      return score
                        ? `有效 ${score.effectiveCount}/${score.maximumEffectiveCount}`
                        : null;
                    }}
                  />
                ) : (
                  <Empty description="暂无符合条件的高评分御魂" />
                ),
              };
            })}
            onChange={onPositionChange}
          />
        ) : (
          <Empty description={`暂无符合条件的${title}`} />
        )}
      </section>
    </div>
  );
}
