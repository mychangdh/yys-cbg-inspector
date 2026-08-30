import { HeroPortrait } from "../HeroPortrait";
import type { HeroSkillCardProps } from "./index.types";
import "./index.scss";

export function HeroSkillCard({
  hero,
  showAccountLevel = true,
}: HeroSkillCardProps) {
  return (
    <article className="hero-skills-page__card">
      <HeroPortrait hero={hero} />
      <div className="hero-skills-page__hero-name">{hero.name}</div>
      <div
        className="hero-skills-page__skill-levels"
        aria-label={`${hero.name} 技能等级`}
      >
        <b>{hero.skillLevels.slice(0, 3).join("")}</b>
      </div>
      {showAccountLevel && (
        <div className="hero-skills-page__level">等级 {hero.level}</div>
      )}
    </article>
  );
}
