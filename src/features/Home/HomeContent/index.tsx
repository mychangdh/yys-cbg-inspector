import {
  AppstoreOutlined,
  ArrowRightOutlined,
  CalculatorOutlined,
  DashboardOutlined,
  FundProjectionScreenOutlined,
  StarOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { Card } from "antd";
import type { ReactNode } from "react";
import { useMemo } from "react";
import type { AccountOverview } from "@/types";
import type { AppPagePath } from "@/config/menu";
import { getPveSuitScoreRanking } from "../../Pve/pveScoring";
import { useAppSelector } from "@/store";
import { AccountDataItem } from "../AccountDataItem";
import { PositionCountTable } from "../PositionCountTable";
import { PvpSummary } from "../PvpSummary";
import { ShikigamiDex } from "../ShikigamiDex";
import { displayGold, displayNumber } from "../homeFormatters";
import styles from "./index.module.scss";

type OverviewShortcut = {
  href: AppPagePath;
  label: string;
  icon: ReactNode;
};

const overviewShortcuts: readonly OverviewShortcut[] = [
  { href: "/speed", label: "速度盘点", icon: <DashboardOutlined /> },
  { href: "/pve", label: "PVE 预览", icon: <FundProjectionScreenOutlined /> },
  { href: "/hero-skills", label: "式神技能", icon: <StarOutlined /> },
  { href: "/calculator", label: "御魂计算器", icon: <CalculatorOutlined /> },
  { href: "/relics", label: "御魂库存", icon: <AppstoreOutlined /> },
];

export function HomeContent() {
  const dataset = useAppSelector((state) => state.app.dataset);
  const account: AccountOverview = dataset.account || {};
  const relicsByPosition = dataset.relicsByPosition;
  const relicCount = Object.values(relicsByPosition || {}).reduce(
    (total, relics) => total + relics.length,
    0,
  );
  const maxLevelRelicCount = Object.values(relicsByPosition || {}).reduce(
    (total, relics) =>
      total +
      relics.filter((relic) => relic.quality === 6 && relic.level === 15)
        .length,
    0,
  );
  const relicCountsByPosition = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6].map((position) => ({
        position,
        count: (relicsByPosition[String(position)] || []).length,
      })),
    [relicsByPosition],
  );
  const pveSuitScoreRanking = useMemo(
    () => getPveSuitScoreRanking(dataset),
    [dataset],
  );

  return (
    <>
      <section className={styles.content}>
        <Card title="账号数据" className={styles.profile}>
          <div className={styles.accountData}>
            <div className={styles.accountMobileSummary}>
              <AccountDataItem label="体力">
                {displayGold(account.stamina)}
              </AccountDataItem>
              <AccountDataItem label="金币">
                {displayGold(account.money)}
              </AccountDataItem>
              <AccountDataItem label="风姿度">
                {account.fengzidu ?? "-"}
              </AccountDataItem>
              <AccountDataItem label="斗技">
                <PvpSummary score={account.pvpScore} stage={account.pvpStage} />
              </AccountDataItem>
            </div>
            <div className={styles.accountCore}>
              <AccountDataItem label="等级">
                {displayNumber(account.level)}
              </AccountDataItem>
              <AccountDataItem label="勾玉">
                <span className={styles.inlineResource}>
                  {displayNumber(account.soulJade)}
                </span>
              </AccountDataItem>
              <AccountDataItem label="神秘符咒">
                {displayNumber(account.mysteryTalisman)}
              </AccountDataItem>
              <AccountDataItem label="典藏皮肤">
                {displayNumber(account.collectionSkinCount)}
              </AccountDataItem>
              <AccountDataItem label="现世符咒">
                {displayNumber(account.realityTalisman)}
              </AccountDataItem>
              <AccountDataItem label="抽卡能力">
                <span className={styles.summonPower}>
                  {displayNumber(account.summonPower)} 抽
                </span>
              </AccountDataItem>
            </div>
          </div>
        </Card>

        <ShikigamiDex />

        <div className={styles.relicPve}>
          <Card title="御魂库存" className={styles.relicSummary}>
            <div className={styles.relicTotal}>
              <div className={styles.relicMetrics}>
                <div>
                  <span>全部御魂数量</span>
                  <strong>
                    {displayNumber(account.relicSummary ?? relicCount)}
                  </strong>
                </div>
                <div>
                  <span>6星满级御魂数量</span>
                  <strong>
                    {displayNumber(
                      account.maxLevelRelicCount ?? maxLevelRelicCount,
                    )}
                  </strong>
                </div>
              </div>
              <Link className={styles.openRelics} href="/relics" scroll={false}>
                <span>查看全部御魂</span>
                <ArrowRightOutlined />
              </Link>
            </div>
            <PositionCountTable
              counts={relicCountsByPosition}
              title="各号位御魂数量"
              description="按号位统计全部御魂"
            />
          </Card>

          <Card title="常用 PVE 御魂评分" className={styles.pveSummary}>
            <div className={styles.pveScoreList}>
              {pveSuitScoreRanking.length ? (
                pveSuitScoreRanking.map((item) => (
                  <div className={styles.pveScoreItem} key={item.suitName}>
                    <span>{item.suitName}</span>
                    <small>{item.relicCount} 件</small>
                    <strong>{item.totalScore}</strong>
                  </div>
                ))
              ) : (
                <span className={styles.pveScoreEmpty}>暂无符合条件的御魂</span>
              )}
            </div>
          </Card>
        </div>
      </section>

      <section className={styles.shortcuts} aria-label="功能快捷入口">
        <h2>快捷入口</h2>
        <div>
          {overviewShortcuts.map((shortcut) => (
            <Link
              key={shortcut.href}
              className={styles.shortcutLink}
              href={shortcut.href}
              scroll={false}
              prefetch={false}
            >
              {shortcut.icon}
              <span>{shortcut.label}</span>
              <ArrowRightOutlined className={styles.shortcutArrow} />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
