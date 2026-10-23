"use client";

import styles from "./index.module.scss";
import { useEffect, useMemo, useRef, useState } from "react";
import { SettingOutlined } from "@ant-design/icons";
import { Button, Empty, Switch, Tooltip } from "antd";
import {
  type HeroBaseStats,
  type RelicCalculationRequest,
} from "@/lib/calculator/types";
import { assetUrl } from "@/lib/assetUrl";
import { loadHeroPanels, loadRelicSuits } from "@/lib/staticApi";
import { useAppSelector } from "@/store";
import { SuitPickerModal } from "../SuitPickerModal";
import { HighScoreRelicList } from "../HighScoreRelicList";
import type {
  HeroStaticPayload,
  HeroRecord,
  HeroView,
  PveHighScoreGroup,
  PveMetric,
  PveTableRow,
  PveWorkerJob,
  PveWorkerPayloadJob,
  PveWorkerResponse,
  RelicDataset,
  RelicSuitStaticPayload,
  SuitOption,
} from "@/types";
import {
  defaultFourPieceSuitNames,
  fixedOmaSuitNames,
  getPveEffectiveGrowthTotal,
  scorePveRelic,
} from "../pveScoring";
import type { PveScoredRelic } from "@/types";

const pveFourPieceSelectionStorageKey =
  "yys-cbg-inspector:pve-four-piece-selection-v1";
const yinYangShiIds = new Set([10, 11, 12, 13, 15, 16]);
const shikigamiRarityLabels: Record<number, string> = {
  6: "UR",
  5: "SP",
  4: "SSR",
  3: "SR",
  2: "R",
  1: "N",
};

function createCalculationRelics(
  relicsByPosition: RelicDataset["relicsByPosition"],
) {
  return Object.fromEntries(
    Object.entries(relicsByPosition).map(([position, relics]) => [
      position,
      relics.map(({ detail: _detail, ...relic }) => relic),
    ]),
  ) as RelicDataset["relicsByPosition"];
}

function createPveCalculationRequest(
  relicsByPosition: RelicDataset["relicsByPosition"],
  baseStats: HeroBaseStats,
  suitTwoPieceAttributes: Map<string, string>,
  fourPieceSuitName: string,
  omaSuitName: string,
): RelicCalculationRequest {
  return {
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
  };
}

function preferredSuitNames(
  options: SuitOption[],
  defaults: string[],
  limit: number,
) {
  const optionNames = new Set(options.map((suit) => suit.name));
  const selected = defaults.filter((name) => optionNames.has(name));
  return selected.length
    ? selected
    : options.slice(0, limit).map((suit) => suit.name);
}

function preloadSuitImages(
  relicsByPosition: RelicDataset["relicsByPosition"],
  suitNames: readonly string[],
) {
  const requestedSuitNames = new Set(suitNames);
  const preloadedIds = new Set<number>();

  Object.values(relicsByPosition)
    .flat()
    .forEach((relic) => {
      const suit = relic.suit;
      if (
        !suit ||
        !requestedSuitNames.has(suit.name) ||
        preloadedIds.has(suit.id)
      )
        return;
      preloadedIds.add(suit.id);
      const image = new Image();
      image.src = assetUrl(`suits/${suit.id}.png`);
    });
}

/**
 * PVE 输出御魂只认攻击加成、暴击和暴击伤害三类副属性。
 * rattr 已保留初始副属性和每次强化，因此 totals.count 就是实际有效词条数。
 */
function updatePrecomputedRow(
  rows: Map<string, PveTableRow>,
  job: PveWorkerJob,
  metric: PveMetric | undefined,
) {
  const metricIndex = fixedOmaSuitNames.indexOf(job.omaSuitName);
  if (metricIndex === -1) return rows;

  const existingRow = rows.get(job.fourPieceSuitName);
  const metrics = existingRow
    ? [...existingRow.metrics]
    : fixedOmaSuitNames.map(() => undefined);
  metrics[metricIndex] = metric;
  const availableMetrics = metrics.filter(
    (item): item is PveMetric => item !== undefined,
  );
  const nextRows = new Map(rows);
  nextRows.set(job.fourPieceSuitName, {
    fourPieceSuitName: job.fourPieceSuitName,
    metrics,
    average: availableMetrics.length
      ? Math.round(
          availableMetrics.reduce((total, item) => total + item.damage, 0) /
            availableMetrics.length,
        )
      : undefined,
  });
  return nextRows;
}

export function PvePage() {
  const dataset = useAppSelector((state) => state.app.dataset);
  const [fourPiecePickerOpen, setFourPiecePickerOpen] = useState(false);
  const [hasCustomFourPieceSelection, setHasCustomFourPieceSelection] =
    useState(false);
  const [selectedFourPieceSuitNames, setSelectedFourPieceSuitNames] = useState<
    string[]
  >([]);
  const [susanooBaseStats, setSusanooBaseStats] = useState<HeroBaseStats>();
  const [staticHeroes, setStaticHeroes] = useState<Record<number, HeroRecord>>(
    {},
  );
  const [isSimplified, setIsSimplified] = useState(false);
  const [suitTwoPieceAttributes, setSuitTwoPieceAttributes] = useState(
    () => new Map<string, string>(),
  );
  const [staticDataReady, setStaticDataReady] = useState(false);
  const [pveCalculating, setPveCalculating] = useState(false);
  const [activePvePosition, setActivePvePosition] = useState("1");
  const [activeOmaPvePosition, setActiveOmaPvePosition] = useState("1");
  const [precomputedRows, setPrecomputedRows] = useState<
    Map<string, PveTableRow>
  >(() => new Map());
  const pveCalculationRunRef = useRef(0);
  const pveWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    try {
      const savedSelection = window.localStorage.getItem(
        pveFourPieceSelectionStorageKey,
      );
      if (savedSelection === null) return;

      const parsedSelection: unknown = JSON.parse(savedSelection);
      if (
        !Array.isArray(parsedSelection) ||
        !parsedSelection.every((name) => typeof name === "string")
      ) {
        return;
      }

      setHasCustomFourPieceSelection(true);
      setSelectedFourPieceSuitNames([...new Set(parsedSelection as string[])]);
    } catch {
      // 本地存储不可用或内容无效时，继续使用默认选择。
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled([
      loadHeroPanels<HeroStaticPayload>(),
      loadRelicSuits<RelicSuitStaticPayload>(),
    ])
      .then(([heroResult, suitResult]) => {
        if (cancelled) return;
        if (heroResult.status === "fulfilled") {
          const heroPayload = heroResult.value;
          const heroesById = heroPayload.heroesById || {};
          const susanoo = Object.values(heroesById).find(
            (hero) => hero.name === "须佐之男",
          );
          setStaticHeroes(
            Object.fromEntries(
              Object.entries(heroesById).map(([id, hero]) => [
                Number(id),
                hero,
              ]),
            ),
          );
          if (suitResult.status === "fulfilled") {
            setSusanooBaseStats(susanoo?.baseStats);
            setSuitTwoPieceAttributes(
              new Map(
                (suitResult.value.yuhun_list || [])
                  .filter(([, , , twoPieceText]) => Boolean(twoPieceText))
                  .map(([, name, , twoPieceText]) => [
                    name,
                    twoPieceText || "",
                  ]),
              ),
            );
          } else {
            setSusanooBaseStats(undefined);
          }
        } else {
          setSusanooBaseStats(undefined);
        }
      })
      .finally(() => {
        if (!cancelled) setStaticDataReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const fourPieceSuitOptions = useMemo(() => {
    const fourPieceSuits = new Map<string, SuitOption>();
    Object.values(dataset.relicsByPosition || {})
      .flat()
      .forEach((relic) => {
        const suit = relic.suit;
        if (!suit) return;
        if (relic.setBonusAttribute || suit.isTwoPieceSet) {
          return;
        }
        fourPieceSuits.set(suit.name, suit);
      });

    const sortSuits = (suits: Map<string, SuitOption>) =>
      [...suits.values()].sort((left, right) =>
        left.name.localeCompare(right.name, "zh-CN"),
      );
    return sortSuits(fourPieceSuits);
  }, [dataset]);

  const activeFourPieceSuitNames = useMemo(() => {
    const availableSelection = selectedFourPieceSuitNames.filter((name) =>
      fourPieceSuitOptions.some((suit) => suit.name === name),
    );
    if (
      hasCustomFourPieceSelection &&
      (!selectedFourPieceSuitNames.length || availableSelection.length)
    ) {
      return availableSelection;
    }
    return preferredSuitNames(
      fourPieceSuitOptions,
      defaultFourPieceSuitNames,
      7,
    );
  }, [
    fourPieceSuitOptions,
    hasCustomFourPieceSelection,
    selectedFourPieceSuitNames,
  ]);
  const activeFourPieceSuitNamesRef = useRef(activeFourPieceSuitNames);
  activeFourPieceSuitNamesRef.current = activeFourPieceSuitNames;
  const allFourPieceSuitNames = useMemo(
    () => fourPieceSuitOptions.map((suit) => suit.name),
    [fourPieceSuitOptions],
  );
  const hasStaticHeroData = Object.keys(staticHeroes).length > 0;
  const heroSummaries = useMemo(() => {
    const groups = new Map<number, HeroView[]>();
    (dataset.heroes || [])
      .filter((hero) => hero.heroId < 900 && !yinYangShiIds.has(hero.heroId))
      .forEach((hero) => {
        const group = groups.get(hero.heroId) || [];
        group.push(hero);
        groups.set(hero.heroId, group);
      });

    const skillDeficient = [...groups.entries()].flatMap(([heroId, heroes]) => {
      const requirement = String(
        Math.max(0, Math.floor(staticHeroes[heroId]?.lowestRank || 155)),
      ).padStart(3, "0");
      const incompleteHeroes = heroes.filter((hero) => {
        const levels = hero.skillLevels
          .slice(0, 3)
          .map((level) => Math.max(0, Math.floor(level)));
        return (
          levels.length !== 3 ||
          !levels.every((level, index) => level >= Number(requirement[index]))
        );
      });
      if (!incompleteHeroes.length) return [];

      const skillLevels = incompleteHeroes
        .map((hero) => hero.skillLevels.slice(0, 3).join("/") || "未知")
        .join("、");
      return [
        `${heroes[0].name}（${incompleteHeroes.length}只技能未满：${skillLevels}）`,
      ];
    });

    const duplicates = [...groups.values()]
      .filter((heroes) => heroes.length > 1)
      .map((heroes) => `${heroes[0].name} ×${heroes.length}`);

    return { skillDeficient, duplicates };
  }, [dataset.heroes, staticHeroes]);
  const unownedShikigami = useMemo(() => {
    if (!dataset.heroes) return null;
    const ownedIds = new Set(dataset.heroes.map((hero) => hero.heroId));
    return Object.values(staticHeroes)
      .filter(
        (hero) =>
          hero.id < 900 &&
          !yinYangShiIds.has(hero.id) &&
          !hero.isCollaboration &&
          !ownedIds.has(hero.id),
      )
      .sort(
        (left, right) =>
          (right.rarityCode || 0) - (left.rarityCode || 0) ||
          left.id - right.id,
      )
      .map(
        (hero) =>
          `${hero.name}（${shikigamiRarityLabels[hero.rarityCode || 0] || "式神"}）`,
      );
  }, [dataset.heroes, staticHeroes]);
  const tableRows = useMemo<PveTableRow[]>(
    () =>
      activeFourPieceSuitNames.map(
        (fourPieceSuitName) =>
          precomputedRows.get(fourPieceSuitName) || {
            fourPieceSuitName,
            metrics: fixedOmaSuitNames.map(() => undefined),
          },
      ),
    [activeFourPieceSuitNames, precomputedRows],
  );
  useEffect(() => {
    preloadSuitImages(dataset.relicsByPosition || {}, [
      ...activeFourPieceSuitNames,
      ...fixedOmaSuitNames,
    ]);
  }, [activeFourPieceSuitNames, dataset]);

  const overallAverage = useMemo(() => {
    const metrics = tableRows.flatMap((row) =>
      row.metrics.filter((metric): metric is PveMetric => metric !== undefined),
    );
    return {
      count: metrics.length,
      value: metrics.length
        ? Math.round(
            metrics.reduce((total, metric) => total + metric.damage, 0) /
              metrics.length,
          )
        : undefined,
    };
  }, [tableRows]);

  const selectedPveSuitNames = useMemo(
    () => new Set([...activeFourPieceSuitNames, ...fixedOmaSuitNames]),
    [activeFourPieceSuitNames],
  );
  // 套件顺序完全沿用选择器：四件套在前，逢魔套在后；同套件内保留账号原始顺序。
  const orderedPveSuitNames = useMemo(
    () => [...activeFourPieceSuitNames, ...fixedOmaSuitNames],
    [activeFourPieceSuitNames],
  );

  const pveHighScoreGroups = useMemo<PveHighScoreGroup[]>(
    () =>
      [1, 2, 3, 4, 5, 6]
        .map((position) => {
          const scoredRelics = (
            dataset.relicsByPosition[String(position)] || []
          )
            .map(scorePveRelic)
            .filter((item): item is PveScoredRelic => Boolean(item))
            .filter((item) =>
              selectedPveSuitNames.has(item.relic.suit?.name || ""),
            )
            .filter((item) => item.effectiveCount >= 5);
          // 不同套件可以混排，先比较有效词条次数，再比较有效词条的总成长值。
          const relics = scoredRelics.sort(
            (left, right) =>
              right.effectiveCount - left.effectiveCount ||
              getPveEffectiveGrowthTotal(right.relic) -
                getPveEffectiveGrowthTotal(left.relic),
          );
          return { position, relics };
        })
        .filter((group) => group.relics.length > 0),
    [dataset.relicsByPosition, selectedPveSuitNames],
  );
  const pveSuitScoreRanking = useMemo(() => {
    const scores = new Map<
      string,
      { suitName: string; totalScore: number; relicCount: number }
    >();
    pveHighScoreGroups
      .flatMap((group) => group.relics)
      .forEach((item) => {
        const suitName = item.relic.suit?.name || "未知御魂";
        const current = scores.get(suitName) || {
          suitName,
          totalScore: 0,
          relicCount: 0,
        };
        current.totalScore += item.effectiveCount;
        current.relicCount += 1;
        scores.set(suitName, current);
      });
    return orderedPveSuitNames.flatMap((suitName) => {
      const score = scores.get(suitName);
      return score ? [score] : [];
    });
  }, [orderedPveSuitNames, pveHighScoreGroups]);
  const pveOutputHighScoreGroups = useMemo(
    () =>
      pveHighScoreGroups
        .map((group) => ({
          ...group,
          relics: group.relics.filter((item) =>
            activeFourPieceSuitNames.includes(item.relic.suit?.name || ""),
          ),
        }))
        .filter((group) => group.relics.length > 0),
    [activeFourPieceSuitNames, pveHighScoreGroups],
  );
  const pveOmaHighScoreGroups = useMemo(
    () =>
      pveHighScoreGroups
        .map((group) => ({
          ...group,
          relics: group.relics.filter((item) =>
            fixedOmaSuitNames.includes(item.relic.suit?.name || ""),
          ),
        }))
        .filter((group) => group.relics.length > 0),
    [pveHighScoreGroups],
  );

  useEffect(() => {
    const baseStats = susanooBaseStats;
    const requestId = pveCalculationRunRef.current + 1;
    pveCalculationRunRef.current = requestId;
    if (!baseStats) {
      setPrecomputedRows(new Map());
      setPveCalculating(false);
      return;
    }

    const calculationRelics = createCalculationRelics(
      dataset.relicsByPosition || {},
    );
    const prioritizedFourPieceSuitNames = [
      ...activeFourPieceSuitNamesRef.current.filter((name) =>
        allFourPieceSuitNames.includes(name),
      ),
      ...allFourPieceSuitNames.filter(
        (name) => !activeFourPieceSuitNamesRef.current.includes(name),
      ),
    ];
    const jobs: PveWorkerJob[] = prioritizedFourPieceSuitNames.flatMap(
      (fourPieceSuitName) =>
        fixedOmaSuitNames.map((omaSuitName) => ({
          id: `${fourPieceSuitName}:${omaSuitName}`,
          fourPieceSuitName,
          omaSuitName,
          request: createPveCalculationRequest(
            calculationRelics,
            baseStats,
            suitTwoPieceAttributes,
            fourPieceSuitName,
            omaSuitName,
          ),
        })),
    );

    if (!jobs.length) {
      setPrecomputedRows(new Map());
      setPveCalculating(false);
      return;
    }

    setPveCalculating(true);
    setPrecomputedRows(new Map());
    const worker = new Worker(
      new URL("../../../lib/pveCalculator.worker.ts", import.meta.url),
      { type: "module" },
    );
    pveWorkerRef.current = worker;
    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    const workerJobs: PveWorkerPayloadJob[] = jobs.map(
      ({ request, ...job }) => {
        const { relicsByPosition: _relicsByPosition, ...workerRequest } =
          request;
        return { ...job, request: workerRequest };
      },
    );
    const finish = () => {
      if (pveCalculationRunRef.current !== requestId) return;
      if (pveWorkerRef.current === worker) pveWorkerRef.current = null;
      setPveCalculating(false);
    };

    worker.onmessage = (event: MessageEvent<PveWorkerResponse>) => {
      const data = event.data;
      if (data.requestId !== requestId) return;
      if (data.type === "result" && data.result) {
        const job = jobsById.get(data.result.id);
        if (job) {
          setPrecomputedRows((rows) =>
            updatePrecomputedRow(rows, job, data.result?.metric),
          );
        }
        return;
      }
      worker.terminate();
      finish();
    };
    worker.onerror = (event) => {
      event.preventDefault();
      worker.terminate();
      finish();
    };
    worker.onmessageerror = () => {
      worker.terminate();
      finish();
    };
    const launchTimer = window.setTimeout(() => {
      try {
        worker.postMessage({
          type: "calculate",
          requestId,
          relicsByPosition: calculationRelics,
          jobs: workerJobs,
        });
      } catch {
        worker.terminate();
        finish();
      }
    }, 0);

    return () => {
      window.clearTimeout(launchTimer);
      worker.terminate();
      if (pveWorkerRef.current === worker) pveWorkerRef.current = null;
    };
  }, [
    allFourPieceSuitNames,
    dataset,
    suitTwoPieceAttributes,
    susanooBaseStats,
  ]);

  useEffect(() => {
    pveWorkerRef.current?.postMessage({
      type: "prioritize",
      requestId: pveCalculationRunRef.current,
      jobIds: activeFourPieceSuitNames.flatMap((fourPieceSuitName) =>
        fixedOmaSuitNames.map(
          (omaSuitName) => `${fourPieceSuitName}:${omaSuitName}`,
        ),
      ),
    });
  }, [activeFourPieceSuitNames]);

  return (
    <div className={`${styles.scope} ${isSimplified ? styles.simplified : ""}`}>
      <div className="width result pve-page">
        <div className="page-heading">
          <div>
            <h1>PVE 数据预览</h1>
          </div>
          <Tooltip title="按满级须佐之男的基础属性，结合御魂主副属性、普通两件套与逢魔一件套计算最终面板。">
            <span>须佐之男面板</span>
          </Tooltip>
        </div>
        <div className="pve-toolbar">
          <div className={styles.darumaCount} aria-label="御行达摩数量">
            <span>御行达摩</span>
            <strong>
              {dataset.account?.yuxingDama === undefined
                ? "—"
                : dataset.account.yuxingDama.toLocaleString("zh-CN")}
            </strong>
            <span>个</span>
          </div>
          <div className="pve-simple-toggle">
            <span id="pve-simple-mode-label">简略模式</span>
            <Switch
              aria-labelledby="pve-simple-mode-label"
              checked={isSimplified}
              onChange={setIsSimplified}
            />
          </div>
          <Button
            icon={<SettingOutlined />}
            onClick={() => setFourPiecePickerOpen(true)}
          >
            四件套：{activeFourPieceSuitNames.length} 个
          </Button>
        </div>

        {isSimplified && (
          <section className={styles.textSummary} aria-live="polite">
            <h2>账号简略摘要</h2>
            <p>
              <strong>技能未满：</strong>
              {dataset.heroes === undefined
                ? "当前账号数据未包含式神技能信息"
                : !hasStaticHeroData
                  ? staticDataReady
                    ? "静态式神资料读取失败，暂无法判断技能是否已满"
                    : "正在读取静态式神资料"
                  : heroSummaries.skillDeficient.length
                    ? heroSummaries.skillDeficient.join("、")
                    : "无"}
            </p>
            <p>
              <strong>有二号机：</strong>
              {dataset.heroes === undefined
                ? "当前账号数据未包含式神信息"
                : heroSummaries.duplicates.length
                  ? heroSummaries.duplicates.join("、")
                  : "无"}
            </p>
            <p>
              <strong>未拥有式神（排除联动）：</strong>
              {unownedShikigami === null
                ? "当前账号数据未包含式神信息"
                : !hasStaticHeroData
                  ? staticDataReady
                    ? "静态式神资料读取失败，暂无法生成列表"
                    : "正在读取静态式神资料"
                  : unownedShikigami.length
                    ? unownedShikigami.join("、")
                    : "无"}
            </p>
          </section>
        )}

        <div className="pve-method-note">
          <strong>计算说明</strong>
          <span>
            固定比较土蜘蛛、荒骷髅、鬼灵歌伎三种逢魔套。仅使用账号内六星 +15
            御魂；以满级须佐之男的最终面板计算，普通两件套和逢魔一件套均计入。结果仅保留满暴方案，伤害指标
            = 最终攻击 × 最终暴击伤害；不含式神技能、四件套伤害效果及副本增益。
          </span>
        </div>
        <div className="pve-overall-average" aria-live="polite">
          <span>总平均值</span>
          <strong>
            {overallAverage.value?.toLocaleString("zh-CN") ||
              (pveCalculating ? "计算中" : "暂无组合")}
          </strong>
          <small>
            {pveCalculating
              ? `已算出 ${overallAverage.count} 组，继续后台计算`
              : `有效组合 ${overallAverage.count} 组`}
          </small>
        </div>
        <section className="pve-summary-columns">
          <div className="pve-suit-overview">
            <h2 className="pve-summary-heading">套件一览</h2>
            {!staticDataReady ? (
              <Empty description="正在读取须佐之男面板数据" />
            ) : !susanooBaseStats ? (
              <Empty description="未能读取须佐之男面板数据，请更新静态数据后重试" />
            ) : tableRows.length ? (
              <>
                <div className="pve-data-scroll">
                  <div
                    className="pve-data-grid"
                    style={{
                      gridTemplateColumns: `minmax(100px, 0.85fr) repeat(${fixedOmaSuitNames.length + 1}, minmax(0, 1fr))`,
                    }}
                  >
                    <div className="pve-grid-corner">四件套</div>
                    {fixedOmaSuitNames.map((suitName) => (
                      <div className="pve-grid-heading" key={suitName}>
                        {suitName}
                      </div>
                    ))}
                    <div className="pve-grid-heading is-average">平均值</div>

                    {tableRows.flatMap((row) => [
                      <div
                        className="pve-suit-name"
                        key={`${row.fourPieceSuitName}-name`}
                      >
                        {row.fourPieceSuitName}
                      </div>,
                      ...row.metrics.map((metric, index) => (
                        <div
                          className="pve-metric-cell"
                          key={`${row.fourPieceSuitName}-${fixedOmaSuitNames[index]}`}
                        >
                          <strong>
                            {metric?.damage.toLocaleString("zh-CN") ||
                              (pveCalculating ? "计算中" : "暂无组合")}
                          </strong>
                          {metric ? (
                            <small>
                              攻{" "}
                              {Math.round(metric.panel.attack).toLocaleString(
                                "zh-CN",
                              )}{" "}
                              · 爆 {metric.panel.critDamage.toFixed(1)}%
                            </small>
                          ) : null}
                        </div>
                      )),
                      <div
                        className="pve-metric-cell is-average"
                        key={`${row.fourPieceSuitName}-average`}
                      >
                        <span>平均指标</span>
                        <strong>
                          {row.average?.toLocaleString("zh-CN") ||
                            (pveCalculating ? "计算中" : "暂无组合")}
                        </strong>
                      </div>,
                    ])}
                  </div>
                </div>
                <div className="pve-mobile-list">
                  {tableRows.map((row) => (
                    <section
                      className="pve-mobile-row"
                      key={row.fourPieceSuitName}
                    >
                      <h2>{row.fourPieceSuitName}</h2>
                      <div className="pve-mobile-metrics">
                        {fixedOmaSuitNames.map((suitName, index) => {
                          const metric = row.metrics[index];
                          return (
                            <div className="pve-mobile-metric" key={suitName}>
                              <span>{suitName}</span>
                              <strong>
                                {metric?.damage.toLocaleString("zh-CN") ||
                                  (pveCalculating ? "计算中" : "暂无组合")}
                              </strong>
                              {metric ? (
                                <small>
                                  攻{" "}
                                  {Math.round(
                                    metric.panel.attack,
                                  ).toLocaleString("zh-CN")}{" "}
                                  · 爆 {metric.panel.critDamage.toFixed(1)}%
                                </small>
                              ) : null}
                            </div>
                          );
                        })}
                        <div className="pve-mobile-metric is-average">
                          <span>平均指标</span>
                          <strong>
                            {row.average?.toLocaleString("zh-CN") ||
                              (pveCalculating ? "计算中" : "暂无组合")}
                          </strong>
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              </>
            ) : (
              <Empty description="当前账号没有可用于 PVE 组合预览的御魂套件" />
            )}
          </div>

          <div className="pve-score-overview">
            <h2 className="pve-summary-heading">评分</h2>
            <div className="pve-high-score-relics__score-list">
              <div className="pve-high-score-relics__score-list-heading">
                <span>普通御魂总评分</span>
                <small>按已选择的四件套汇总有效词条</small>
              </div>
              <div className="pve-high-score-relics__score-list-body">
                {pveSuitScoreRanking
                  .filter((item) => !fixedOmaSuitNames.includes(item.suitName))
                  .map((item) => (
                    <div
                      className="pve-high-score-relics__score-card"
                      key={item.suitName}
                    >
                      <span className="pve-high-score-relics__score-name">
                        {item.suitName}
                        <small>{item.relicCount} 件</small>
                      </span>
                      <span className="pve-high-score-relics__score-label">
                        总评分
                      </span>
                      <strong>{item.totalScore}</strong>
                    </div>
                  ))}
              </div>
            </div>
            <div className="pve-high-score-relics__score-list">
              <div className="pve-high-score-relics__score-list-heading">
                <span>逢魔御魂总评分</span>
                <small>按土蜘蛛、荒骷髅、鬼灵歌伎分别汇总有效词条</small>
              </div>
              <div className="pve-high-score-relics__score-list-body">
                {pveSuitScoreRanking
                  .filter((item) => fixedOmaSuitNames.includes(item.suitName))
                  .map((item) => (
                    <div
                      className="pve-high-score-relics__score-card"
                      key={item.suitName}
                    >
                      <span className="pve-high-score-relics__score-name">
                        {item.suitName}
                        <small>{item.relicCount} 件</small>
                      </span>
                      <span className="pve-high-score-relics__score-label">
                        总评分
                      </span>
                      <strong>{item.totalScore}</strong>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>

        <section className="pve-high-score-relics">
          <header className="pve-high-score-relics__heading">
            <div>
              <h2>PVE 高评分御魂</h2>
            </div>
            <small className="pve-high-score-relics__rule">
              评分展示标准：仅统计满级6星御魂；2、4 号位仅攻击加成、6
              号位仅暴击或暴击伤害。攻击加成、暴击、暴击伤害各计 1
              条有效词条；普通御魂上限 8 条，逢魔一件套为上述属性时额外 +3
              条（上限 11 条）。单件展示有效词条数，仅展示 5
              条及以上；套件总评分为该套件所有展示御魂的有效词条数之和。
            </small>
          </header>
          <HighScoreRelicList
            activePosition={activePvePosition}
            groups={pveOutputHighScoreGroups}
            title="PVE 输出御魂"
            onPositionChange={setActivePvePosition}
          />
          <HighScoreRelicList
            activePosition={activeOmaPvePosition}
            groups={pveOmaHighScoreGroups}
            title="逢魔御魂"
            onPositionChange={setActiveOmaPvePosition}
          />
        </section>

        <SuitPickerModal
          open={fourPiecePickerOpen}
          options={fourPieceSuitOptions}
          selectedSuitNames={activeFourPieceSuitNames}
          defaultSelectedSuitNames={defaultFourPieceSuitNames}
          title="选择 PVE 四件套"
          onChange={(suitNames) => {
            setHasCustomFourPieceSelection(true);
            setSelectedFourPieceSuitNames(suitNames);
            try {
              window.localStorage.setItem(
                pveFourPieceSelectionStorageKey,
                JSON.stringify(suitNames),
              );
            } catch {
              // 存储失败不影响当前页面的选择。
            }
          }}
          onClose={() => setFourPiecePickerOpen(false)}
        />
      </div>
    </div>
  );
}
