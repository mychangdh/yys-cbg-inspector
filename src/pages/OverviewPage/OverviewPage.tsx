import "./OverviewPage.scss";
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  CalculatorOutlined,
  DashboardOutlined,
  FundProjectionScreenOutlined,
  LinkOutlined,
  SkinOutlined,
  StarOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { Button, Card, Descriptions } from "antd";
import { useMemo, type ReactNode } from "react";
import { assetUrl } from "../../lib/assetUrl";
import { getFullSpeedRelics } from "../../lib/accountAnalysis";
import { getPveSuitScoreRanking } from "../PvePage/PvePage";
import type { AccountOverview, RelicDataset } from "../../types";

function displayNumber(value: number | undefined) {
  return value === undefined ? "-" : value.toLocaleString("zh-CN");
}

function displayUsageStatus(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return value > 0 ? "未使用" : "已使用";
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

function PvpSummary({
  score,
  stage,
}: {
  score?: number;
  stage?: string | number;
}) {
  const isMaster = typeof score === "number" && score >= 3000;
  const rank = isMaster ? "名士" : stage === undefined ? "-" : `${stage}段`;
  const stars =
    isMaster && typeof score === "number"
      ? Math.floor((score - 3000) / 30)
      : null;

  return (
    <span className="pvp-summary">
      <strong>{rank}</strong>
      {!isMaster && <span>{displayNumber(score)}分</span>}
      {stars !== null && (
        <span className="pvp-summary-stars">
          <img src={assetUrl("pvp-star.png")} alt="" />
          {stars}星
        </span>
      )}
    </span>
  );
}

const overviewShortcuts = [
  { route: "speed", label: "速度盘点", icon: <DashboardOutlined /> },
  { route: "pve", label: "PVE 预览", icon: <FundProjectionScreenOutlined /> },
  { route: "hero-skills", label: "式神技能", icon: <StarOutlined /> },
  { route: "calculator", label: "御魂计算器", icon: <CalculatorOutlined /> },
  { route: "relics", label: "御魂库存", icon: <AppstoreOutlined /> },
] as const;
function ShikigamiDex({ account }: { account: AccountOverview }) {
  const dex = account.shikigamiDex;
  return (
    <Card title="式神" className="overview-profile overview-dex">
      <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
        <Descriptions.Item label="SSR图鉴">
          {dex ? `${dex.ssr.owned}/${dex.ssr.total}` : "-"}
        </Descriptions.Item>
        <Descriptions.Item label="SP图鉴">
          {dex ? `${dex.sp.owned}/${dex.sp.total}` : "-"}
        </Descriptions.Item>
        <Descriptions.Item label="UR图鉴">
          {dex ? `${dex.ur.owned}/${dex.ur.total}` : "-"}
        </Descriptions.Item>
        <Descriptions.Item label="500天未收录">
          {displayUsageStatus(dex?.uncollected500Days)}
        </Descriptions.Item>
        <Descriptions.Item label="999天未收录">
          {displayUsageStatus(dex?.uncollected999Days)}
        </Descriptions.Item>
        <Descriptions.Item label="SSR/SP未收录券">
          {displayNumber(dex?.uncollectedCoupon)}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}

function AccountDataItem({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`overview-account-data-item ${className}`.trim()}>
          <span>{label}：</span>
      <strong>{children}</strong>
    </div>
  );
}

function PositionCountTable({
  counts,
  title = "各号位满速数量",
  description = "6 星满级且副属性满速",
}: {
  counts: Array<{ position: number; count: number }>;
  title?: string;
  description?: string;
}) {
  return (
    <div className="overview-full-speed-table-wrap">
      <div className="overview-full-speed-table-heading">
        <span>{title}</span>
        <small>{description}</small>
      </div>
      <table className="overview-full-speed-table">
        <thead>
          <tr>
            {counts.map(({ position }) => (
              <th key={position} scope="col">
                {position}号位
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {counts.map(({ position, count }) => (
              <td key={position}>{displayNumber(count)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function OverviewPage({
  dataset,
  onOpenRelics,
  onNavigate,
}: {
  dataset: RelicDataset;
  onOpenRelics: () => void;
  onNavigate: (route: (typeof overviewShortcuts)[number]["route"]) => void;
}) {
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
              <span className="overview-speed-heading-eyebrow">御魂速度概括</span>
            </div>
          </div>
          <div className="overview-speed-data">
            <div className="overview-speed-metrics">
              <div className="overview-speed-metric overview-speed-metric--primary">
                <span>散件一速</span>
                <strong>{displayRelicSpeed(account.scatteredFirstSpeed)}</strong>
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
              <AccountDataItem label="典藏皮肤">
                {displayNumber(account.collectionSkinCount)}
              </AccountDataItem>
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
                onClick={onOpenRelics}
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

          <Card title="常用 PVE 御魂评分" className="overview-pve-summary">
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
                <span className="overview-pve-score-empty">暂无符合条件的御魂</span>
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
              key={shortcut.route}
              type="button"
              onClick={() => onNavigate(shortcut.route)}
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
