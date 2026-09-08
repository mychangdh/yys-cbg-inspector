import "./index.scss";
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  CalculatorOutlined,
  DashboardOutlined,
  FundProjectionScreenOutlined,
  LinkOutlined,
  QuestionCircleOutlined,
  SkinOutlined,
  StarOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { Button, Card, Tooltip } from "antd";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { assetUrl } from "@/lib/assetUrl";
import { getFullSpeedRelics } from "@/lib/accountAnalysis";
import { getPveSuitScoreRanking } from "../Pve";
import { useAppSelector } from "@/store";
import { AccountDataItem } from "./AccountDataItem";
import { PositionCountTable } from "./PositionCountTable";
import { PvpSummary } from "./PvpSummary";
import { ShikigamiDex } from "./ShikigamiDex";
import type { HomePageProps } from "@/types/home";

function displayNumber(value: number | undefined) {
  return value === undefined ? "-" : value.toLocaleString("zh-CN");
}

function displayGold(value: number | undefined) {
  if (value === undefined) return "-";
  const units = ["", "万", "亿", "兆"];
  let amount = Math.abs(value);
  let unitIndex = 0;
  while (amount >= 10000 && unitIndex < units.length - 1) {
    amount /= 10000;
    unitIndex += 1;
  }
  const truncated = Math.floor(amount * 10) / 10;
  const formatted =
    unitIndex === 0
      ? String(amount)
      : unitIndex === 1 && Number.isInteger(truncated)
        ? String(truncated)
        : truncated.toFixed(1);
  return `${value < 0 ? "-" : ""}${formatted}${units[unitIndex]}`;
}

function displayRelicSpeed(value: number | undefined) {
  return value === undefined ? "-" : `+${value.toFixed(2)}`;
}

function displayHeadAndTail(
  head: number | undefined,
  tail: number | undefined,
) {
  if (head === undefined && tail === undefined) return "-";
  return `${head ?? "-"}头 ${tail ?? "-"}尾`;
}

const overviewShortcuts = [
  { path: "/speed", label: "速度盘点", icon: <DashboardOutlined /> },
  { path: "/pve", label: "PVE 预览", icon: <FundProjectionScreenOutlined /> },
  { path: "/hero-skills", label: "式神技能", icon: <StarOutlined /> },
  { path: "/calculator", label: "御魂计算器", icon: <CalculatorOutlined /> },
  { path: "/relics", label: "御魂库存", icon: <AppstoreOutlined /> },
] as const;
export function HomePage({}: HomePageProps) {
  const dataset = useAppSelector((state) => state.app.dataset);
  const navigate = useNavigate();
  const account = dataset.account || {};
  const relicCount = Object.values(dataset.relicsByPosition || {}).reduce(
    (total, relics) => total + relics.length,
    0,
  );
  const maxLevelRelicCount = Object.values(
    dataset.relicsByPosition || {},
  ).reduce(
    (total, relics) =>
      total +
      relics.filter((relic) => relic.quality === 6 && relic.level === 15)
        .length,
    0,
  );
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
  const relicCountsByPosition = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6].map((position) => ({
        position,
        count: (dataset.relicsByPosition[String(position)] || []).length,
      })),
    [dataset.relicsByPosition],
  );
  const pveSuitScoreRanking = useMemo(
    () => getPveSuitScoreRanking(dataset),
    [dataset],
  );
  const hasLoadedProduct = Boolean(account.sourceUrl) || relicCount > 0;

  if (!hasLoadedProduct) return null;

  return (
    <div className="width overview-page">
      <section className="overview-title">
        <div>
          <div className="overview-title-main">
            <h1>{account.title || "账号概览"}</h1>
            <span className="overview-title-server">
              {account.serverName || "-"}
            </span>
          </div>
        </div>
        <div className="overview-title-actions">
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

      <section className="overview-stat-grid" aria-label="账号概览数据">
        <Card className="overview-stat-card overview-stat-card--stamina">
          <span className="overview-stat-card__icon">
            <img src={assetUrl("icon-stamina.png")} alt="" />
          </span>
          <span className="overview-stat-card__copy">
            <span className="overview-stat-card__label">体力</span>
            <strong>{displayGold(account.stamina)}</strong>
          </span>
        </Card>
        <Card className="overview-stat-card overview-stat-card--money">
          <span className="overview-stat-card__icon">
            <img src={assetUrl("icon-money.png")} alt="" />
          </span>
          <span className="overview-stat-card__copy">
            <span className="overview-stat-card__label">金币</span>
            <strong>{displayGold(account.money)}</strong>
          </span>
        </Card>
        <Card className="overview-stat-card overview-stat-card--fengzidu">
          <span className="overview-stat-card__icon">
            <SkinOutlined />
          </span>
          <span className="overview-stat-card__copy">
            <span className="overview-stat-card__label">风姿度</span>
            <strong>{account.fengzidu ?? "-"}</strong>
          </span>
        </Card>
        <Card className="overview-stat-card overview-stat-card--pvp">
          <span className="overview-stat-card__icon">
            <TrophyOutlined />
          </span>
          <span className="overview-stat-card__copy">
            <span className="overview-stat-card__label">斗技</span>
            <span className="overview-stat-card__pvp-value">
              <PvpSummary score={account.pvpScore} stage={account.pvpStage} />
            </span>
          </span>
        </Card>
      </section>

      <section className="overview-speed-showcase" aria-label="御魂速度卖点">
        <Card>
          <div className="overview-speed-heading">
            <div className="overview-speed-heading-copy">
              <h2>速度亮点</h2>
              <span className="overview-speed-heading-eyebrow">
                御魂速度概括
              </span>
            </div>
          </div>
          <div className="overview-speed-data">
            <div className="overview-speed-metrics">
              <div className="overview-speed-metric overview-speed-metric--primary">
                <span>散件一速</span>
                <strong>
                  {displayRelicSpeed(account.scatteredFirstSpeed)}
                </strong>
              </div>
              <div className="overview-speed-metric overview-speed-metric--primary">
                <span>招财一速</span>
                <strong>{displayRelicSpeed(account.luckyFirstSpeed)}</strong>
              </div>
              <div className="overview-speed-metric overview-speed-metric--count">
                <span>头 / 尾</span>
                <strong>
                  {displayHeadAndTail(
                    account.speedHeadCount,
                    account.speedTailCount,
                  )}
                </strong>
              </div>
              <div className="overview-speed-metric overview-speed-metric--count overview-speed-metric--full">
                <span>满速御魂数量</span>
                <strong>{fullSpeedRelics.length}</strong>
              </div>
            </div>
            <PositionCountTable counts={fullSpeedCountsByPosition} />
          </div>
        </Card>
      </section>

      <section className="overview-content-grid">
        <Card title="账号数据" className="overview-profile">
          <div className="overview-account-data-grid">
            <div className="overview-account-mobile-summary">
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
            <div className="overview-account-core-grid">
              <AccountDataItem label="等级">
                {displayNumber(account.level)}
              </AccountDataItem>
              <AccountDataItem label="勾玉">
                <span className="overview-inline-resource">
                  {displayNumber(account.soulJade)}
                </span>
              </AccountDataItem>
              <AccountDataItem label="神秘符咒">
                {displayNumber(account.mysteryTalisman)}
              </AccountDataItem>
              {/* <AccountDataItem label="典藏皮肤">
                {displayNumber(account.collectionSkinCount)}
              </AccountDataItem> */}
              <AccountDataItem label="现世符咒">
                {displayNumber(account.realityTalisman)}
              </AccountDataItem>
              <AccountDataItem label="抽卡能力">
                <span className="overview-summon-power">
                  {displayNumber(account.summonPower)} 抽
                </span>
              </AccountDataItem>
            </div>
          </div>
        </Card>

        <ShikigamiDex account={account} />

        <div className="overview-relic-pve-grid">
          <Card title="御魂库存" className="overview-relic-summary">
            <div className="overview-relic-total">
              <div className="overview-relic-metrics overview-relic-metrics--two">
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
              <Button
                className="overview-open-relics"
                type="default"
                icon={<ArrowRightOutlined />}
                iconPosition="end"
                onClick={() => navigate("/relics")}
              >
                查看全部御魂
              </Button>
            </div>
            <PositionCountTable
              counts={relicCountsByPosition}
              title="各号位御魂数量"
              description="按号位统计全部御魂"
            />
          </Card>

          <Card
            title={
              <span className="overview-pve-score-card-title">
                <span>常用 PVE 御魂评分</span>
                <Tooltip
                  title="件数是达到 PVE 评分门槛的该套装御魂数量；红色数字是这些御魂累计的有效属性条数。"
                  trigger={["hover", "focus", "click"]}
                >
                  <QuestionCircleOutlined
                    aria-label="PVE 御魂评分统计说明"
                    role="img"
                  />
                </Tooltip>
              </span>
            }
            className="overview-pve-summary"
          >
            <div className="overview-pve-score-list">
              {pveSuitScoreRanking.length ? (
                pveSuitScoreRanking.map((item) => (
                  <div className="overview-pve-score-item" key={item.suitName}>
                    <div className="overview-pve-score-title">
                      <span>{item.suitName}</span>
                      <small>{item.relicCount} 件</small>
                    </div>
                    <strong>{item.totalScore}</strong>
                  </div>
                ))
              ) : (
                <span className="overview-pve-score-empty">
                  暂无符合条件的御魂
                </span>
              )}
            </div>
          </Card>
        </div>
      </section>

      <section className="overview-shortcuts" aria-label="功能快捷入口">
        <h2>快捷入口</h2>
        <div>
          {overviewShortcuts.map((shortcut) => (
            <button
              key={shortcut.path}
              type="button"
              onClick={() => navigate(shortcut.path)}
            >
              {shortcut.icon}
              <span>{shortcut.label}</span>
              <ArrowRightOutlined className="overview-shortcut-arrow" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
