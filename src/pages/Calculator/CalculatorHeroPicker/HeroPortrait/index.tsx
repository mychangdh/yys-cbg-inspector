import { PictureOutlined } from "@ant-design/icons";
import { useState } from "react";
import { assetUrl } from "@/lib/assetUrl";
import type { CalculatorHeroPortraitProps } from "@/types/calculator";
import "./index.scss";

export function HeroPortrait({ hero }: CalculatorHeroPortraitProps) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="calculator-hero-portrait" aria-hidden="true">
      {!failed && (
        <img
          src={assetUrl(`heroes/${hero.id}.png`)}
          alt=""
          onError={() => setFailed(true)}
        />
      )}
      {failed && <PictureOutlined />}
    </span>
  );
}
