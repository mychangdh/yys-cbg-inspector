import type { HeroBaseStats } from "@/lib/calculator/types";

/** 藏宝阁账号内实际拥有的一名式神及其技能等级。 */
export type HeroView = {
  instanceId: string;
  heroId: number;
  name: string;
  rarity: number;
  level: number;
  skillLevels: number[];
};

/** 式神静态资料中会被计算器、技能页共同使用的记录。 */
export type HeroRecord = {
  id: number;
  name: string;
  rarityCode?: number;
  lowestRank?: number;
  isCollaboration?: boolean;
  baseStats: HeroBaseStats;
};

export type HeroStaticPayload = {
  heroesById?: Record<string, HeroRecord>;
};
