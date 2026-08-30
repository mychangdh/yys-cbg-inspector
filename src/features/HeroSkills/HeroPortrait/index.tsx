import Image from "next/image";
import { PictureOutlined } from "@ant-design/icons";
import { useState } from "react";
import { assetUrl } from "@/lib/assetUrl";
import type { HeroPortraitProps } from "./index.types";
import "./index.scss";

export function HeroPortrait({ hero }: HeroPortraitProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="hero-skills-page__portrait" aria-hidden="true">
      {!failed ? (
        <Image
          src={assetUrl(`heroes/${hero.heroId}.png`)}
          alt=""
          width={56}
          height={56}
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <PictureOutlined />
      )}
    </div>
  );
}
