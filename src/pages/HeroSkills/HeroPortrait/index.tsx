import { PictureOutlined } from "@ant-design/icons";
import { useState } from "react";
import { assetUrl } from "@/lib/assetUrl";
import type { HeroSkillsPortraitProps } from "@/types/heroSkills";
import "./index.scss";

export function HeroPortrait({ hero }: HeroSkillsPortraitProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="hero-skills-page__portrait" aria-hidden="true">
      {!failed ? (
        <img
          src={assetUrl(`heroes/${hero.heroId}.png`)}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        <PictureOutlined />
      )}
    </div>
  );
}
