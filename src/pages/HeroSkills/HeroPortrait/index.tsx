import { PictureOutlined } from "@ant-design/icons";
import { useState } from "react";
import { assetUrl } from "@/lib/assetUrl";
import type { HeroSkillsPortraitProps } from "@/types/heroSkills";
import "./index.scss";

export function HeroPortrait({
  heroId,
  grayscale = false,
}: HeroSkillsPortraitProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`hero-skills-page__portrait${grayscale ? " hero-skills-page__portrait--grayscale" : ""}`}
      aria-hidden="true"
    >
      {!failed ? (
        <img
          src={assetUrl(`heroes/${heroId}.png`)}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        <PictureOutlined />
      )}
    </div>
  );
}
