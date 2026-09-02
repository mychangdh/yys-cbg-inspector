import Image from "next/image";
import { PictureOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { HeroView } from "@/types";
import { assetUrl } from "@/lib/assetUrl";
import styles from "./index.module.scss";

type HeroPortraitProps = {
  hero: HeroView;
};

export function HeroPortrait({ hero }: HeroPortraitProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={styles.portrait} aria-hidden="true">
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
