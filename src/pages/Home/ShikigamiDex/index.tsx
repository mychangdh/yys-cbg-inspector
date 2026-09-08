import { Card, Descriptions } from "antd";
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
