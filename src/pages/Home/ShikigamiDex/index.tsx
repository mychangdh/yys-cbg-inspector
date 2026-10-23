import { Card } from "antd";
import type { ShikigamiDexProps } from "@/types/home";
import "./index.scss";

function displayNumber(value: number | undefined) {
  return value === undefined ? "-" : value.toLocaleString("zh-CN");
}

function displayUsageStatus(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return value > 0 ? "未使用" : "已使用";
}

export function ShikigamiDex({ account }: ShikigamiDexProps) {
  const dex = account.shikigamiDex;
  return (
    <Card title="式神" className="overview-profile overview-dex">
      <dl className="overview-dex-fields">
        <div>
          <dt>SSR图鉴</dt>
          <dd>{dex ? `${dex.ssr.owned}/${dex.ssr.total}` : "-"}</dd>
        </div>
        <div>
          <dt>SP图鉴</dt>
          <dd>{dex ? `${dex.sp.owned}/${dex.sp.total}` : "-"}</dd>
        </div>
        <div>
          <dt>UR图鉴</dt>
          <dd>{dex ? `${dex.ur.owned}/${dex.ur.total}` : "-"}</dd>
        </div>
        <div>
          <dt>500天未收录</dt>
          <dd>{displayUsageStatus(dex?.uncollected500Days)}</dd>
        </div>
        <div>
          <dt>999天未收录</dt>
          <dd>{displayUsageStatus(dex?.uncollected999Days)}</dd>
        </div>
        <div>
          <dt>SSR/SP未收录券</dt>
          <dd>{displayNumber(dex?.uncollectedCoupon)}</dd>
        </div>
      </dl>
    </Card>
  );
}
