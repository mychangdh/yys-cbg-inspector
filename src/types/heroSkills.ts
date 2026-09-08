import type { HeroView, RelicDataset } from "./index";

export type HeroSkillsPageProps = {
  dataset: RelicDataset;
};

export type HeroSkillsPortraitProps = {
  hero: HeroView;
};

export type HeroSkillCardProps = {
  hero: HeroView;
  showAccountLevel?: boolean;
};
