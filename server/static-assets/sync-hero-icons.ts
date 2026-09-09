import { mkdir, access, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DatabaseService } from "../database/database.service";

const HERO_ICON_BASE_URL = "https://cbg-yys.res.netease.com/game_res/hero";
const PNG_SIGNATURE = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function isPng(bytes: Uint8Array) {
  return PNG_SIGNATURE.every((value, index) => bytes[index] === value);
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadHeroIcon(id: number, directory: string) {
  const target = path.join(directory, `${id}.png`);
  if (await fileExists(target)) return "skipped" as const;

  const response = await fetch(`${HERO_ICON_BASE_URL}/${id}/${id}.png`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!isPng(bytes)) {
    throw new Error("响应不是 PNG");
  }

  const temporary = path.join(directory, `.${id}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
  return "downloaded" as const;
}

export async function syncHeroIcons(databaseService: DatabaseService) {
  const directory = path.resolve(process.cwd(), "public/assets/heroes");
  await mkdir(directory, { recursive: true });
  const heroes = await databaseService.hero.findMany({
    select: { id: true },
    orderBy: { id: "asc" },
  });

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  for (const hero of heroes) {
    try {
      if ((await downloadHeroIcon(hero.id, directory)) === "downloaded") {
        downloaded += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      failed += 1;
      console.warn(`[式神图标] ${hero.id} 下载失败：${String(error)}`);
    }
  }

  console.log(
    `[式神图标] 同步完成：新增 ${downloaded}，已有 ${skipped}，失败 ${failed}`,
  );
}
