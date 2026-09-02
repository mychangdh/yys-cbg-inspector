import Image from "next/image";
import { assetUrl } from "@/lib/assetUrl";
import { displayNumber } from "../homeFormatters";
import styles from "./index.module.scss";

type PvpSummaryProps = {
  score?: number;
  stage?: string | number;
};

export function PvpSummary({ score, stage }: PvpSummaryProps) {
  const isMaster = typeof score === "number" && score >= 3000;
  const rank = isMaster ? "名士" : stage === undefined ? "-" : `${stage}段`;
  const stars =
    isMaster && typeof score === "number"
      ? Math.floor((score - 3000) / 30)
      : null;

  return (
    <span className={`${styles.summary} pvp-summary`}>
      <strong>{rank}</strong>
      {!isMaster && <span>{displayNumber(score)}分</span>}
      {stars !== null && (
        <span className={`${styles.stars} pvp-summary-stars`}>
          <Image
            src={assetUrl("pvp-star.png")}
            alt=""
            width={17}
            height={17}
            unoptimized
          />
          {stars}星
        </span>
      )}
    </span>
  );
}
