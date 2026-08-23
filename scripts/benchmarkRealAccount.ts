import heroes from "../src/data/heroes.json";
import relicSuits from "../src/data/relic-suits.json";
import { convertCbgPayloadToDataset } from "../src/lib/relics";
import {
  calculateRelicCombinations,
  calculateRelicPanel,
  type CalculatorFilters,
  type HeroBaseStats,
} from "../src/lib/relicCalculator";
import { calculateFastGeneralSearch } from "../src/lib/fastRelicCalculator";
import { calculateFastFixedSuitSearch } from "../src/lib/fastRelicCalculator";
import type { GameConfig } from "../src/types";

const accountUrl =
  "https://yys.cbg.163.com/cgi/api/get_equip_detail?serverid=4&ordersn=202608200901616-4-BJVXRQPC7CLJM0";

type RelicSuitConfig = {
  yuhun_list?: Array<[number, string, string, string?, string?]>;
  two_suit_yuhun?: Record<string, string>;
};

function createSuitAttributes(config: RelicSuitConfig): Map<string, string> {
  const omaIds = new Set(
    Object.keys(config.two_suit_yuhun || {}).map((id) => Number(id)),
  );
  return new Map(
    (config.yuhun_list || [])
      .filter(([id, name, , attribute]) =>
        Boolean(name) && Boolean(attribute) && !omaIds.has(id),
      )
      .map(([, name, , attribute]) => [name, attribute || ""]),
  );
}

async function loadAccountPayload(): Promise<unknown> {
  const response = await fetch(accountUrl, {
    headers: {
      "user-agent": "YYS-CBG-Inspector/1.0",
      referer: "https://yys.cbg.163.com/",
    },
  });
  if (!response.ok) throw new Error(`账号数据请求失败：${response.status}`);
  return response.json();
}

function heianKyoBaseStats(): HeroBaseStats {
  const hero = heroes.heroesById["592"];
  if (!hero) throw new Error("静态资料中没有雪御前");
  return hero.baseStats;
}

function createFilters(fastMode: boolean): CalculatorFilters {
  return {
    quality: 6,
    level: 15,
    mainAttributes: {
      2: ["攻击加成", "防御加成"],
      4: ["攻击加成", "防御加成"],
      6: ["暴击", "暴击伤害"],
    },
    requiredFourPiece: process.env.BENCHMARK_NO_FIXED_SUIT
      ? undefined
      : "网切",
    panelConstraints: {
      attack: { max: 7700 },
      health: { min: 10254 },
      defense: { min: 1050 },
      speed: { min: 116 },
      critRate: { min: 100 },
      critDamage: { min: 160 },
    },
    fastMode,
  };
}

function runMode(
  name: string,
  dataset: ReturnType<typeof convertCbgPayloadToDataset>,
  suitTwoPieceAttributes: Map<string, string>,
  fastMode: boolean,
  fixedSuitPhase?: "unrestricted" | "explicit",
): void {
  const startedAt = performance.now();
  let firstResultReported = false;
  const results = calculateRelicCombinations(
    dataset.relicsByPosition,
    heianKyoBaseStats(),
    "damage",
    { ...createFilters(fastMode), suitTwoPieceAttributes },
    fastMode ? 1 : 5,
    (progress) => {
      if (firstResultReported || !progress.results?.length) return;
      firstResultReported = true;
      console.log(
        JSON.stringify({
          mode: name,
          firstResultMs: Math.round(performance.now() - startedAt),
          firstScore: progress.results[0]?.score,
        }),
      );
    },
    fixedSuitPhase,
  );
  const elapsed = performance.now() - startedAt;
  const top = results[0];
  console.log(
    JSON.stringify({
      mode: name,
      elapsedMs: Math.round(elapsed),
      resultCount: results.length,
      score: top?.score,
      panel: top?.panel,
      suits: top?.suits,
    }),
  );
}

function runCompactGeneralMode(
  dataset: ReturnType<typeof convertCbgPayloadToDataset>,
  suitTwoPieceAttributes: Map<string, string>,
): void {
  const startedAt = performance.now();
  const filters = {
    ...createFilters(true),
    suitTwoPieceAttributes,
  };
  const results = calculateFastGeneralSearch({
    relicsByPosition: dataset.relicsByPosition,
    baseStats: heianKyoBaseStats(),
    metric: "damage",
    filters,
    resultLimit: 1,
  });
  const elapsed = performance.now() - startedAt;
  const top = results[0];
  const panel = top
    ? calculateRelicPanel({
        baseStats: heianKyoBaseStats(),
        relics: top.relics,
        suitTwoPieceAttributes,
      })
    : undefined;
  console.log(
    JSON.stringify({
      mode: "紧凑通用搜索",
      elapsedMs: Math.round(elapsed),
      resultCount: results.length,
      score: top?.score,
      panel,
      suits: top?.relics.map((relic) => relic.suit?.name),
    }),
  );
}

function runCompactFixedMode(
  dataset: ReturnType<typeof convertCbgPayloadToDataset>,
  suitTwoPieceAttributes: Map<string, string>,
): void {
  const startedAt = performance.now();
  const filters = {
    ...createFilters(true),
    suitTwoPieceAttributes,
  };
  const results = calculateFastFixedSuitSearch({
    relicsByPosition: dataset.relicsByPosition,
    baseStats: heianKyoBaseStats(),
    metric: "damage",
    filters,
    resultLimit: 1,
  });
  const elapsed = performance.now() - startedAt;
  const top = results[0];
  const panel = top
    ? calculateRelicPanel({
        baseStats: heianKyoBaseStats(),
        relics: top.relics,
        suitTwoPieceAttributes,
      })
    : undefined;
  console.log(
    JSON.stringify({
      mode: "数组固定套搜索",
      elapsedMs: Math.round(elapsed),
      resultCount: results.length,
      score: top?.score,
      panel,
      suits: top?.relics.map((relic) => relic.suit?.name),
    }),
  );
}

async function run(): Promise<void> {
  const payload = await loadAccountPayload();
  const dataset = convertCbgPayloadToDataset(payload, relicSuits as GameConfig);
  const suitTwoPieceAttributes = createSuitAttributes(relicSuits);
  const relicCount = Object.values(dataset.relicsByPosition).reduce(
    (total, relics) => total + relics.length,
    0,
  );
  console.log(JSON.stringify({ relicCount }));
  const mode = process.env.BENCHMARK_MODE || "all";
  if (mode === "summary") {
    const positions = Object.fromEntries(
      Object.entries(dataset.relicsByPosition).map(([position, relics]) => [
        position,
        relics.length,
      ]),
    );
    const suits = Object.values(dataset.relicsByPosition)
      .flat()
      .reduce<Record<string, number>>((counts, relic) => {
        const name = relic.suit?.name || "未分类";
        counts[name] = (counts[name] || 0) + 1;
        return counts;
      }, {});
    console.log(
      JSON.stringify({
        positions,
        suitCount: Object.keys(suits).length,
        suits: Object.entries(suits).sort((left, right) => right[1] - left[1]),
      }),
    );
    return;
  }
  if (mode === "compact") {
    runCompactGeneralMode(dataset, suitTwoPieceAttributes);
    return;
  }
  if (mode === "fixed") {
    runCompactFixedMode(dataset, suitTwoPieceAttributes);
    return;
  }
  if (mode === "fast") {
    runMode("极速", dataset, suitTwoPieceAttributes, true);
    return;
  }
  if (mode === "normal") {
    runMode("普通", dataset, suitTwoPieceAttributes, false);
    return;
  }
  if (mode === "explicit") {
    runMode("具体两件套", dataset, suitTwoPieceAttributes, false, "explicit");
    return;
  }
  if (mode === "unrestricted") {
    runMode("任意两件套", dataset, suitTwoPieceAttributes, false, "unrestricted");
    return;
  }
  runMode("普通", dataset, suitTwoPieceAttributes, false);
  runMode("极速", dataset, suitTwoPieceAttributes, true);
}

void run();
