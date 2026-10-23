import { Card } from "antd";
import { useAppSelector } from "@/store";
import { displayNumber, displayUsageStatus } from "../homeFormatters";
import styles from "./index.module.scss";

export function ShikigamiDex() {
  const account = useAppSelector((state) => state.app.dataset.account || {});
  const dex = account.shikigamiDex;
  return (
    <Card
      title="式神"
      className={`${styles.dex} overview-profile overview-dex`}
    >
      <dl className={styles.fields}>
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
