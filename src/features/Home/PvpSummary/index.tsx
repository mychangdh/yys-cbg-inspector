import Image from "next/image";
import { assetUrl } from "@/lib/assetUrl";
import { displayNumber } from "../homeFormatters";
import type { PvpSummaryProps } from "./index.types";
import "./index.scss";

export function PvpSummary({ score, stage }: PvpSummaryProps) {
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
