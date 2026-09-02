import { LinkOutlined, SkinOutlined, TrophyOutlined } from "@ant-design/icons";
import Image from "next/image";
import { Button, Card } from "antd";
import { useMemo } from "react";
import type { AccountOverview } from "@/types";
import { assetUrl } from "@/lib/assetUrl";
import { getFullSpeedRelics } from "@/lib/accountAnalysis";
import { useAppSelector } from "@/store";
import {
  displayGold,
  displayHeadAndTail,
  displayRelicSpeed,
} from "../homeFormatters";
import { OverviewStatCard } from "../OverviewStatCard";
import { PositionCountTable } from "../PositionCountTable";
import { PvpSummary } from "../PvpSummary";
import styles from "./index.module.scss";

export function HomeSummary() {
  const dataset = useAppSelector((state) => state.app.dataset);
  const account: AccountOverview = dataset.account || {};
  const fullSpeedRelics = useMemo(() => getFullSpeedRelics(dataset), [dataset]);
  const fullSpeedCountsByPosition = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6].map((position) => ({
        position,
        count: fullSpeedRelics.filter((relic) => relic.position === position)
          .length,
      })),
    [fullSpeedRelics],
  );

  return (
    <>
      <section className={styles.title}>
        <div className={styles.titleCopy}>
          <div className={styles.titleMain}>
            <h1>{account.title || "账号概览"}</h1>
            <span className={styles.titleServer}>
              {account.serverName || "-"}
            </span>
          </div>
        </div>
        <div className={styles.titleActions}>
          <Button
            type="default"
            icon={<LinkOutlined />}
            href={account.sourceUrl}
            target="_blank"
            rel="noreferrer"
            disabled={!account.sourceUrl}
          >
            账号链接
          </Button>
        </div>
      </section>

      <section className={styles.stats} aria-label="账号概览数据">
        <OverviewStatCard
          variant="stamina"
          label="体力"
          icon={
            <Image
              src={assetUrl("icon-stamina.png")}
              alt=""
              width={32}
              height={32}
              unoptimized
            />
          }
          value={displayGold(account.stamina)}
        />
        <OverviewStatCard
          variant="money"
          label="金币"
          icon={
            <Image
              src={assetUrl("icon-money.png")}
              alt=""
              width={32}
              height={32}
              unoptimized
            />
          }
          value={displayGold(account.money)}
        />
        <OverviewStatCard
          variant="fengzidu"
          label="风姿度"
          icon={<SkinOutlined />}
          value={account.fengzidu ?? "-"}
        />
        <OverviewStatCard
          variant="pvp"
          label="斗技"
          icon={<TrophyOutlined />}
          value={
            <PvpSummary score={account.pvpScore} stage={account.pvpStage} />
          }
        />
      </section>

      <section className={styles.speed} aria-label="御魂速度卖点">
        <Card className={styles.speedCard}>
          <div className={styles.speedHeading}>
            <div className={styles.speedHeadingCopy}>
              <h2>速度亮点</h2>
              <span className={styles.speedHeadingEyebrow}>御魂速度概括</span>
            </div>
          </div>
          <div className={styles.speedData}>
            <div className={styles.speedMetrics}>
              <div className={`${styles.speedMetric} ${styles.primary}`}>
                <span>散件一速</span>
                <strong>
                  {displayRelicSpeed(account.scatteredFirstSpeed)}
                </strong>
              </div>
              <div className={`${styles.speedMetric} ${styles.primary}`}>
                <span>招财一速</span>
                <strong>{displayRelicSpeed(account.luckyFirstSpeed)}</strong>
              </div>
              <div className={`${styles.speedMetric} ${styles.count}`}>
                <span>头 / 尾</span>
                <strong>
                  {displayHeadAndTail(
                    account.speedHeadCount,
                    account.speedTailCount,
                  )}
                </strong>
              </div>
              <div
                className={`${styles.speedMetric} ${styles.count} ${styles.full}`}
              >
                <span>满速御魂数量</span>
                <strong>{fullSpeedRelics.length}</strong>
              </div>
            </div>
            <PositionCountTable counts={fullSpeedCountsByPosition} />
          </div>
        </Card>
      </section>
    </>
  );
}
