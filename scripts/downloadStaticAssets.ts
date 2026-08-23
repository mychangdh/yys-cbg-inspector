import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import heroes from "../src/data/heroes.json";
import relicSuits from "../src/data/relic-suits.json";

type AssetKind = "heroes" | "suits";

type DownloadResult = {
  downloaded: number;
  failed: number;
};

function getAssetUrl(kind: AssetKind, id: number): string {
  if (kind === "heroes") {
    return `https://cbg-yys.res.netease.com/game_res/hero/${id}/${id}.png`;
  }
  return `https://cbg-yys.res.netease.com/game_res/suit/${id}.png`;
}

async function downloadAssets(kind: AssetKind, ids: number[]): Promise<DownloadResult> {
  let index = 0;
  let downloaded = 0;
  let failed = 0;
  const directory = path.resolve("public", "static-data", "assets", kind);
  await mkdir(directory, { recursive: true });

  const worker = async (): Promise<void> => {
    while (index < ids.length) {
      const id = ids[index++];
      try {
        const response = await fetch(getAssetUrl(kind, id));
        if (!response.ok) throw new Error(String(response.status));
        const content = new Uint8Array(await response.arrayBuffer());
        if (content.byteLength === 0) throw new Error("empty");
        await writeFile(path.join(directory, `${id}.png`), content);
        downloaded += 1;
      } catch {
        failed += 1;
      }
    }
  };

  await Promise.all(Array.from({ length: 8 }, worker));
  return { downloaded, failed };
}

async function main(): Promise<void> {
  const heroIds = Object.values(heroes.heroesById)
    .map((hero) => hero.id)
    .filter((id): id is number => Number.isInteger(id) && id > 0);
  const suitIds = relicSuits.yuhun_list
    .map(([id]) => id)
    .filter((id): id is number => Number.isInteger(id) && id > 0);
  const [heroResult, suitResult] = await Promise.all([
    downloadAssets("heroes", heroIds),
    downloadAssets("suits", suitIds),
  ]);
  console.log(`式神图标：${heroResult.downloaded} 成功，${heroResult.failed} 失败`);
  console.log(`御魂图标：${suitResult.downloaded} 成功，${suitResult.failed} 失败`);
}

void main();
