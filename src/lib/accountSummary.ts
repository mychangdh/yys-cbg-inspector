import type {
  PveWorkerJob,
  PveWorkerPayloadJob,
  PveWorkerResponse,
  RelicDataset,
} from "@/types";
import { getBestSpeedCombinationForSuit } from "./accountAnalysis";
import { loadHeroPanels, loadRelicSuits } from "./staticApi";
import {
  defaultFourPieceSuitNames,
  fixedOmaSuitNames,
  getPveSuitScoreRanking,
} from "@/pages/Pve";
import type {
  HeroBaseStats,
  RelicCalculationRequest,
} from "./calculator/types";
import { parseTwoPieceAttribute } from "./calculator/setRules";

type HeroStaticPayload = {
  heroesById?: Record<string, { name?: string; baseStats?: HeroBaseStats }>;
};

type RelicSuitStaticPayload = {
  yuhun_list?: Array<[number, string, string, string?, string?]>;
};

function displayCount(value: number | undefined) {
  return value === undefined ? undefined : value.toLocaleString("zh-CN");
}

export async function buildAccountSummary(dataset: RelicDataset) {
  const suitTwoPieceAttributes = await loadSuitTwoPieceAttributes().catch(
    () => new Map<string, string>(),
  );
  const pveDamageSummary = await calculatePveDamageSummary(
    dataset,
    suitTwoPieceAttributes,
  );
  const account = dataset.account || {};
  const relicCount = Object.values(dataset.relicsByPosition || {}).reduce(
    (total, relics) => total + relics.length,
    0,
  );
  const relicTotal = account.relicSummary ?? relicCount;
  const status = account.listingStatus;
  const terminalStatus = status === "已售出" || status === "已取回";
  const dex = account.shikigamiDex;
  const usageStatus = (value: number | null) =>
    value === null ? "未知" : value > 0 ? "未使用" : "已使用";
  const suiteSpeeds = [
    ...new Set(
      Object.values(dataset.relicsByPosition || {})
        .flat()
        .filter(
          (relic) =>
            relic.suit && !relic.suit.isTwoPieceSet && !relic.setBonusAttribute,
        )
        .map((relic) => relic.suit!.name),
    ),
  ]
    .flatMap((suitName) => {
      const combination = getBestSpeedCombinationForSuit(dataset, suitName);
      return combination ? [{ suitName, speed: combination.value + 57 }] : [];
    })
    .sort((left, right) => right.speed - left.speed);
  const pveDamageTwoPieceSuitNames = new Set(
    [...suitTwoPieceAttributes].flatMap(([suitName, attribute]) =>
      ["攻击加成", "暴击", "暴击伤害"].includes(
        parseTwoPieceAttribute(attribute)?.label || "",
      )
        ? [suitName]
        : [],
    ),
  );
  const pveScores = getPveSuitScoreRanking(dataset).filter(({ suitName }) =>
    pveDamageTwoPieceSuitNames.has(suitName),
  );
  const fields = [
    status
      ? terminalStatus
        ? `商品状态：${status}`
        : `商品状态快照：${status}（不可信；仅代表读取账号时的状态，喂入 AI 时可能已变化，不得据此判断当前状态或交易结果）`
      : "商品状态：未知",
    account.title && `商品名称：${account.title}`,
    account.name && `游戏昵称：${account.name}`,
    account.price !== undefined &&
      `售价：¥${account.price.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`,
    account.serverName && `区服：${account.serverName}`,
    account.level !== undefined && `等级：${account.level}`,
    account.fengzidu !== undefined &&
      `风姿度：${displayCount(account.fengzidu)}`,
    account.pvpStage !== undefined && `斗技段位：${account.pvpStage}`,
    account.pvpScore !== undefined && `PVP斗技评分：${account.pvpScore} 分`,
    account.stamina !== undefined && `体力：${displayCount(account.stamina)}`,
    account.money !== undefined && `金币：${displayCount(account.money)}`,
    account.soulJade !== undefined && `勾玉：${displayCount(account.soulJade)}`,
    account.summonPower !== undefined &&
      `抽卡能力：${displayCount(account.summonPower)} 抽`,
    account.mysteryTalisman !== undefined &&
      `神秘符咒：${displayCount(account.mysteryTalisman)} 张`,
    account.realityTalisman !== undefined &&
      `现世符咒：${displayCount(account.realityTalisman)} 张`,
    account.yuxingDama !== undefined &&
      `御行达摩：${displayCount(account.yuxingDama)} 个`,
    `御魂：${displayCount(relicTotal)} 件`,
    account.maxLevelRelicCount !== undefined &&
      `6星满级御魂：${displayCount(account.maxLevelRelicCount)} 件`,
    account.heroSummary !== undefined &&
      `式神数量：${displayCount(account.heroSummary)}`,
    (account.speedHeadCount !== undefined ||
      account.speedTailCount !== undefined) &&
      `满速御魂头/尾：${account.speedHeadCount ?? "未知"} 头/${account.speedTailCount ?? "未知"} 尾`,
    dex &&
      `式神图鉴：SSR ${dex.ssr.owned}/${dex.ssr.total}，SP ${dex.sp.owned}/${dex.sp.total}，UR ${dex.ur.owned}/${dex.ur.total}；500天未收录券${usageStatus(dex.uncollected500Days)}，999天未收录券${usageStatus(dex.uncollected999Days)}，SSR/SP未收录券 ${displayCount(dex.uncollectedCoupon)} 张`,
    account.scatteredFirstSpeed !== undefined &&
      `散件一速：${account.scatteredFirstSpeed.toFixed(2)}`,
    account.luckyFirstSpeed !== undefined &&
      `招财一速：${account.luckyFirstSpeed.toFixed(2)}`,
    suiteSpeeds.length > 0 &&
      `御魂四件套速度（含二号位速度主属性，不含式神基础速度）：${suiteSpeeds
        .map(({ suitName, speed }) => `${suitName} ${speed.toFixed(2)}`)
        .join("、")}`,
    pveScores.length > 0 &&
      `PVE套装评分：${pveScores
        .map(
          ({ suitName, totalScore, relicCount }) =>
            `${suitName} ${totalScore}分/${relicCount}件`,
        )
        .join("、")}`,
    pveDamageSummary &&
      `PVE伤害预览（满级须佐之男、满暴；只记录伤害结果，不含面板明细）：${pveDamageSummary}`,
  ].filter((field): field is string => Boolean(field));

  return fields.join("；");
}

async function calculatePveDamageSummary(
  dataset: RelicDataset,
  suitTwoPieceAttributes: Map<string, string>,
) {
  try {
    const heroPayload = await loadHeroPanels<HeroStaticPayload>();
    const baseStats = Object.values(heroPayload.heroesById || {}).find(
      (hero) => hero.name === "须佐之男",
    )?.baseStats;
    if (!baseStats) return "";
    const fourPieceSuitNames = [
      ...new Set(
        Object.values(dataset.relicsByPosition)
          .flat()
          .filter(
            (relic) =>
              relic.suit &&
              !relic.suit.isTwoPieceSet &&
              !relic.setBonusAttribute,
          )
          .map((relic) => relic.suit!.name),
      ),
    ];
    const preferredNames = defaultFourPieceSuitNames.filter((name) =>
      fourPieceSuitNames.includes(name),
    );
    const selectedNames = (
      preferredNames.length
        ? preferredNames
        : [...fourPieceSuitNames]
            .sort((left, right) => left.localeCompare(right, "zh-CN"))
            .slice(0, 7)
    ).filter((name) =>
      ["攻击加成", "暴击", "暴击伤害"].includes(
        parseTwoPieceAttribute(suitTwoPieceAttributes.get(name))?.label || "",
      ),
    );
    if (!selectedNames.length) return "";

    const relicsByPosition = Object.fromEntries(
      Object.entries(dataset.relicsByPosition).map(([position, relics]) => [
        position,
        relics.map(({ detail: _detail, ...relic }) => relic),
      ]),
    ) as RelicDataset["relicsByPosition"];
    const jobs: PveWorkerJob[] = selectedNames.flatMap((fourPieceSuitName) =>
      fixedOmaSuitNames.map((omaSuitName) => ({
        id: `${fourPieceSuitName}:${omaSuitName}`,
        fourPieceSuitName,
        omaSuitName,
        request: {
          relicsByPosition,
          baseStats,
          metric: "damage",
          filters: {
            quality: 6,
            level: 15,
            mainAttributes: {},
            suitTwoPieceAttributes,
            requiredFourPiece: fourPieceSuitName,
            requiredTwoPieceNames: new Set([omaSuitName]),
            panelConstraints: { critRate: { min: 100 } },
            fastMode: true,
          },
          resultLimit: 1,
        } satisfies RelicCalculationRequest,
      })),
    );
    const workerJobs: PveWorkerPayloadJob[] = jobs.map(
      ({ request, ...job }) => {
        const { relicsByPosition: _relicsByPosition, ...workerRequest } =
          request;
        return { ...job, request: workerRequest };
      },
    );
    const results = await new Promise<Map<string, number>>((resolve) => {
      const worker = new Worker(
        new URL("./pveCalculator.worker.ts", import.meta.url),
        { type: "module" },
      );
      const damages = new Map<string, number>();
      const finish = () => {
        worker.terminate();
        resolve(damages);
      };
      worker.onmessage = (event: MessageEvent<PveWorkerResponse>) => {
        const data = event.data;
        if (data.type === "result" && data.result?.metric) {
          damages.set(data.result.id, data.result.metric.damage);
        } else if (data.type === "done" || data.type === "error") {
          finish();
        }
      };
      worker.onerror = finish;
      worker.onmessageerror = finish;
      worker.postMessage({
        type: "calculate",
        requestId: Date.now(),
        relicsByPosition,
        jobs: workerJobs,
      });
    });

    return selectedNames
      .map((fourPieceSuitName) => {
        const damages = fixedOmaSuitNames
          .map((omaSuitName) =>
            results.get(`${fourPieceSuitName}:${omaSuitName}`),
          )
          .filter((damage): damage is number => damage !== undefined);
        const average = damages.length
          ? Math.round(
              damages.reduce((total, damage) => total + damage, 0) /
                damages.length,
            )
          : undefined;
        const values = fixedOmaSuitNames.map((omaSuitName) => {
          const damage = results.get(`${fourPieceSuitName}:${omaSuitName}`);
          return `${omaSuitName} ${damage?.toLocaleString("zh-CN") || "无可用组合"}`;
        });
        return `${fourPieceSuitName}（${values.join("、")}；平均 ${average?.toLocaleString("zh-CN") || "无可用组合"}）`;
      })
      .join("；");
  } catch {
    return "";
  }
}

async function loadSuitTwoPieceAttributes() {
  const payload = await loadRelicSuits<RelicSuitStaticPayload>();
  return new Map(
    (payload.yuhun_list || [])
      .filter(([, , , twoPieceText]) => Boolean(twoPieceText))
      .map(([, name, , twoPieceText]) => [name, twoPieceText || ""]),
  );
}
