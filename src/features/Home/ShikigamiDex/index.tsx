import { Card, Descriptions } from "antd";
import { displayNumber, displayUsageStatus } from "../homeFormatters";
import type { ShikigamiDexProps } from "./index.types";
import "./index.scss";

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
