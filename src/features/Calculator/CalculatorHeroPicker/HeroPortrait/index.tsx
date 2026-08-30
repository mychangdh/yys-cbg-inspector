import Image from "next/image";
import { PictureOutlined } from "@ant-design/icons";
import { useState } from "react";
import { assetUrl } from "@/lib/assetUrl";
import type { CalculatorHeroPortraitProps } from "./index.types";
import "./index.scss";

export function CalculatorHeroPortrait({ hero }: CalculatorHeroPortraitProps) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="calculator-hero-portrait" aria-hidden="true">
      {!failed ? (
        <Image
          src={assetUrl(`heroes/${hero.id}.png`)}
          alt=""
          width={48}
          height={48}
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <PictureOutlined />
      )}
    </span>
  );
}
