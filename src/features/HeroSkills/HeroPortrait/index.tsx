import Image from "next/image";
import { PictureOutlined } from "@ant-design/icons";
import { useState } from "react";
import { assetUrl } from "@/lib/assetUrl";
import styles from "./index.module.scss";

type HeroPortraitProps = {
  heroId: number;
  grayscale?: boolean;
};

export function HeroPortrait({ heroId, grayscale = false }: HeroPortraitProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`${styles.portrait} ${grayscale ? styles.grayscale : ""}`}
      aria-hidden="true"
    >
      {!failed ? (
        <Image
          src={assetUrl(`heroes/${heroId}.png`)}
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
