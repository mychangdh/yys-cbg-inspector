import type { HeroView, RelicDataset } from "./index";

export type HeroSkillsPageProps = {
  dataset: RelicDataset;
};

export type HeroSkillsPortraitProps = {
  heroId: number;
  grayscale?: boolean;
};

export type HeroSkillCardProps = {
  hero: HeroView;
  showAccountLevel?: boolean;
};
