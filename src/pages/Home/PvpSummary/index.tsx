import { assetUrl } from "@/lib/assetUrl";
import type { PvpSummaryProps } from "@/types/home";
import "./index.scss";

function displayNumber(value: number | undefined) {
  return value === undefined ? "-" : value.toLocaleString("zh-CN");
}

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
          <img src={assetUrl("pvp-star.png")} alt="" />
          {stars}星
        </span>
      )}
    </span>
  );
}
