import { HeroPortrait } from "../HeroPortrait";
import type { HeroView } from "@/types";
import styles from "./index.module.scss";

type HeroSkillCardProps = {
  hero: HeroView;
  showAccountLevel?: boolean;
};

export function HeroSkillCard({
  hero,
  showAccountLevel = true,
}: HeroSkillCardProps) {
  return (
    <article className={styles.card}>
      <HeroPortrait hero={hero} />
      <div className={styles.heroName}>{hero.name}</div>
      <div className={styles.skillLevels} aria-label={`${hero.name} 技能等级`}>
        <b>{hero.skillLevels.slice(0, 3).join("")}</b>
      </div>
      {showAccountLevel && (
        <div className={styles.level}>等级 {hero.level}</div>
      )}
    </article>
  );
}
