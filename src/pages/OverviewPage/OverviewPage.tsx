import "./OverviewPage.scss";
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  CalculatorOutlined,
  DashboardOutlined,
  FundProjectionScreenOutlined,
  LinkOutlined,
  PictureOutlined,
  StarOutlined,
  ThunderboltFilled,
  TrophyOutlined,
} from "@ant-design/icons";
import { Button, Card, Descriptions, Statistic } from "antd";
import { useMemo } from "react";
import { assetUrl } from "../../lib/assetUrl";
import { getFullSpeedRelics } from "../../lib/accountAnalysis";
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
          <img src={assetUrl("ui/pvp-star.png")} alt="" />
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
      <Descriptions column={{ xs: 1, sm: 2 }} size="small">
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
  const positionCounts = [1, 2, 3, 4, 5, 6].map((position) => ({
    position,
    count: dataset.relicsByPosition?.[String(position)]?.length || 0,
  }));
  const fullSpeedRelics = useMemo(() => getFullSpeedRelics(dataset), [dataset]);

  return (
    <div className="width overview-page">
      <section className="overview-title">
        <div>
          <span className="page-kicker">藏宝阁账号</span>
          <h1>{account.title || "账号概览"}</h1>
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
        <Card>
          <Statistic
            title="体力"
            value={displayGold(account.stamina)}
            prefix={
              <img
                className="overview-resource-icon"
                src={assetUrl("ui/icon-stamina.png")}
                alt=""
              />
            }
          />
        </Card>
        <Card>
          <Statistic
            title="金币"
            value={displayGold(account.money)}
            prefix={
              <img
                className="overview-resource-icon overview-money-icon"
                src={assetUrl("ui/icon-money.png")}
                alt=""
              />
            }
          />
        </Card>
        <Card>
          <Statistic
            title="风姿度"
            value={account.fengzidu ?? "-"}
            prefix={<PictureOutlined />}
          />
        </Card>
        <Card className="overview-pvp-card">
          <div className="overview-pvp-statistic">
            <div className="overview-pvp-title">
              <TrophyOutlined />
              <span>斗技</span>
            </div>
            <PvpSummary score={account.pvpScore} stage={account.pvpStage} />
          </div>
        </Card>
      </section>

      <section className="overview-speed-showcase" aria-label="御魂速度卖点">
        <Card>
          <div className="overview-speed-heading">
            <span className="overview-speed-heading-icon">
              <ThunderboltFilled />
            </span>
            <div>
              <h2>御魂速度概括</h2>
            </div>
          </div>
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
              <span>满速</span>
              <strong>{fullSpeedRelics.length}</strong>
            </div>
          </div>
        </Card>
      </section>

      <section className="overview-content-grid">
        <Card title="账号数据" className="overview-profile">
          <Descriptions column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="服务器" span={2}>
              {account.serverName || "-"}
            </Descriptions.Item>
            <Descriptions.Item
              className="overview-mobile-account-item"
              label="体力"
            >
              {displayGold(account.stamina)}
            </Descriptions.Item>
            <Descriptions.Item
              className="overview-mobile-account-item"
              label="金币"
            >
              {displayGold(account.money)}
            </Descriptions.Item>
            <Descriptions.Item
              className="overview-mobile-account-item"
              label="风姿度"
            >
              {account.fengzidu ?? "-"}
            </Descriptions.Item>
            <Descriptions.Item
              className="overview-mobile-account-item"
              label="斗技"
            >
              <PvpSummary score={account.pvpScore} stage={account.pvpStage} />
            </Descriptions.Item>
            <Descriptions.Item label="等级">
              {displayNumber(account.level)}
            </Descriptions.Item>
            <Descriptions.Item label="勾玉">
              <span className="overview-inline-resource">
                {displayNumber(account.soulJade)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="神秘符咒">
              {displayNumber(account.mysteryTalisman)}
            </Descriptions.Item>
            <Descriptions.Item label="现世符咒">
              {displayNumber(account.realityTalisman)}
            </Descriptions.Item>
            <Descriptions.Item label="抽卡能力" span={2}>
              <strong className="overview-summon-power">
                {displayNumber(account.summonPower)} 抽
              </strong>
            </Descriptions.Item>
            <Descriptions.Item label="典藏皮肤">
              {displayNumber(account.collectionSkinCount)}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <ShikigamiDex account={account} />

        <Card title="御魂库存" className="overview-relic-summary">
          <div className="overview-relic-total">
            <div className="overview-relic-metrics">
              <div>
                <span>全部御魂</span>
                <strong>
                  {displayNumber(account.relicSummary ?? relicCount)}
                </strong>
              </div>
              <div>
                <span>6星+15御魂</span>
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
          <div className="overview-position-grid">
            {positionCounts.map(({ position, count }) => (
              <div key={position}>
                <span>{position}号位</span>
                <strong>{count.toLocaleString("zh-CN")}</strong>
              </div>
            ))}
          </div>
        </Card>
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
