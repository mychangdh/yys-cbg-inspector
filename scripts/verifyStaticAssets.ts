import { access } from "node:fs/promises";
import path from "node:path";

const requiredAssets = [
  "icon-money.png",
  "icon-soul-jade.png",
  "icon-stamina.png",
  "pvp-star.png",
  "relic-quality-gem.png",
  "relic-slot-pointer.png",
  "../hao-lai-icon.ico",
];

async function main(): Promise<void> {
  const directory = path.resolve("public", "static-data", "assets", "ui");
  const missing: string[] = [];
  for (const asset of requiredAssets) {
    try {
      await access(path.resolve(directory, asset));
    } catch {
      missing.push(asset);
    }
  }
  if (missing.length) {
    throw new Error(`缺少静态 UI 资源：${missing.join("、")}`);
  }
  console.log("静态 UI 资源完整");
}

void main();
