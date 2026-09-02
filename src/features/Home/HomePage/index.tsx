"use client";

import { useAppSelector } from "@/store";
import { HomeContent } from "../HomeContent";
import { HomeSummary } from "../HomeSummary";
import styles from "./index.module.scss";

export function HomePage() {
  const dataset = useAppSelector((state) => state.app.dataset);
  const account = dataset.account || {};
  const relicsByPosition = dataset.relicsByPosition;
  const relicCount = Object.values(relicsByPosition || {}).reduce(
    (total, relics) => total + relics.length,
    0,
  );
  const hasLoadedProduct = Boolean(account.sourceUrl) || relicCount > 0;

  if (!hasLoadedProduct) return null;

  return (
    <div className={`width ${styles.homePage}`}>
      <HomeSummary />
      <HomeContent />
    </div>
  );
}
