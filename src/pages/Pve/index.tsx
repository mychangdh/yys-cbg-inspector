import "./index.scss";
import { useEffect, useMemo, useRef, useState } from "react";
import { SettingOutlined } from "@ant-design/icons";
import { Button, Empty, Modal, Tabs, Tooltip } from "antd";
import {
  type CalculatedPanel,
  type HeroBaseStats,
  type RelicCalculationRequest,
} from "@/lib/calculator/types";
import { assetUrl } from "@/lib/assetUrl";
import { loadHeroPanels, loadRelicSuits } from "@/lib/staticApi";
import { RelicList } from "@/components/RelicList";
import { useAppSelector } from "@/store";
import type { RelicDataset, RelicView } from "@/types";

type SuitOption = NonNullable<RelicView["suit"]>;

const defaultFourPieceSuitNames = [
  "狂骨",
  "海月火玉",
  "伤魂鸟",
  "破势",
  "隐念",
  "镇墓兽",
  "片叶之苇",
];
const fixedOmaSuitNames = ["土蜘蛛", "荒骷髅", "鬼灵歌伎"];
const pveEffectiveAttributeLabels = new Set(["攻击加成", "暴击", "暴击伤害"]);

type PveScoredRelic = {
  relic: RelicView;
  effectiveCount: number;
  maximumEffectiveCount: 8 | 11;
};

type PveHighScoreGroup = {
  position: number;
  relics: PveScoredRelic[];
};

type HeroRecord = {
  id: number;
  name: string;
  baseStats: HeroBaseStats;
};

type HeroStaticPayload = {
  heroesById?: Record<string, HeroRecord>;
};

type RelicSuitStaticPayload = {
  yuhun_list?: Array<
    [
      id: number,
      name: string,
      slug: string,
      twoPieceText?: string,
      effectText?: string,
    ]
  >;
};

type PveMetric = {
  damage: number;
  panel: CalculatedPanel;
};

type PveTableRow = {
  fourPieceSuitName: string;
  metrics: Array<PveMetric | undefined>;
  average?: number;
};

type PveWorkerJob = {
  id: string;
  fourPieceSuitName: string;
  omaSuitName: string;
  request: RelicCalculationRequest;
};

type PveWorkerPayloadJob = Omit<PveWorkerJob, "request"> & {
  request: Omit<RelicCalculationRequest, "relicsByPosition">;
};

type PveWorkerResponse = {
  type: "result" | "done" | "error";
  requestId: number;
  result?: { id: string; metric?: PveMetric };
  message?: string;
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
function getPveEffectiveSubAttributeCount(relic: RelicView) {
  const totals = relic.enhancement?.totals;
  if (totals?.length) {
    return totals.reduce(
      (count, attribute) =>
        count +
        (pveEffectiveAttributeLabels.has(attribute.label)
          ? attribute.count
          : 0),
      0,
    );
  }

  return (relic.subAttributes || []).filter((attribute) =>
    pveEffectiveAttributeLabels.has(attribute.label),
  ).length;
}

function getPveEffectiveGrowthTotal(relic: RelicView) {
  const totals = relic.enhancement?.totals;
  if (totals?.length) {
    return totals.reduce(
      (total, attribute) =>
        total +
        (pveEffectiveAttributeLabels.has(attribute.label)
          ? attribute.total
          : 0),
      0,
    );
  }

  return (relic.subAttributes || []).reduce(
    (total, attribute) =>
      total +
      (pveEffectiveAttributeLabels.has(attribute.label) ? attribute.value : 0),
    0,
  );
}

function scorePveRelic(relic: RelicView): PveScoredRelic | null {
  const position = relic.position || 0;
  const isOmaRelic = Boolean(relic.setBonusAttribute);
  const isOutputOmaBonus =
    isOmaRelic &&
    pveEffectiveAttributeLabels.has(relic.setBonusAttribute?.label || "");

  if (
    relic.quality !== 6 ||
    relic.level !== 15 ||
    ([2, 4].includes(position) && relic.mainAttribute?.label !== "攻击加成") ||
    (position === 6 &&
      !["暴击", "暴击伤害"].includes(relic.mainAttribute?.label || ""))
  ) {
    return null;
  }

  return {
    relic,
    effectiveCount:
      getPveEffectiveSubAttributeCount(relic) + (isOutputOmaBonus ? 3 : 0),
    maximumEffectiveCount: isOutputOmaBonus ? 11 : 8,
  };
}

export type PveSuitScoreSummary = {
  suitName: string;
  totalScore: number;
  relicCount: number;
  isOma: boolean;
};

/** 首页与 PVE 页面共用的常用御魂评分汇总，评分规则保持单一来源。 */
export function getPveSuitScoreRanking(
  dataset: RelicDataset,
): PveSuitScoreSummary[] {
  const fourPieceSuitNames = new Set<string>();
  Object.values(dataset.relicsByPosition || {})
    .flat()
    .forEach((relic) => {
      const suit = relic.suit;
      if (!suit || relic.setBonusAttribute || suit.isTwoPieceSet) return;
      fourPieceSuitNames.add(suit.name);
    });

  const preferredFourPieceSuitNames = defaultFourPieceSuitNames.filter(
    (name) => fourPieceSuitNames.has(name),
  );
  const activeFourPieceSuitNames = preferredFourPieceSuitNames.length
    ? preferredFourPieceSuitNames
    : [...fourPieceSuitNames].slice(0, 7);
  const selectedSuitNames = new Set([
    ...activeFourPieceSuitNames,
    ...fixedOmaSuitNames,
  ]);
  const scores = new Map<string, PveSuitScoreSummary>();

  Object.values(dataset.relicsByPosition || {})
    .flat()
    .map(scorePveRelic)
    .filter((item): item is PveScoredRelic => Boolean(item))
    .filter((item) => selectedSuitNames.has(item.relic.suit?.name || ""))
    .filter((item) => item.effectiveCount >= 5)
    .forEach((item) => {
      const suitName = item.relic.suit?.name || "未知御魂";
      const current = scores.get(suitName) || {
        suitName,
        totalScore: 0,
        relicCount: 0,
        isOma: fixedOmaSuitNames.includes(suitName),
      };
      current.totalScore += item.effectiveCount;
      current.relicCount += 1;
      scores.set(suitName, current);
    });

  return [...activeFourPieceSuitNames, ...fixedOmaSuitNames].flatMap(
    (suitName) => {
      const score = scores.get(suitName);
      return score ? [score] : [];
    },
  );
}

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

function SuitPickerModal({
  open,
  title,
  options,
  selectedSuitNames,
  onChange,
  onClose,
}: {
  open: boolean;
  title: string;
  options: SuitOption[];
  selectedSuitNames: string[];
  onChange: (suitNames: string[]) => void;
  onClose: () => void;
}) {
  const [draftSuitNames, setDraftSuitNames] = useState(selectedSuitNames);

  useEffect(() => {
    if (open) setDraftSuitNames(selectedSuitNames);
  }, [open, selectedSuitNames]);

  return (
    <Modal
      className="pve-suit-modal"
      footer={
        <Button
          type="primary"
          onClick={() => {
            onChange(draftSuitNames);
            onClose();
          }}
        >
          完成
        </Button>
      }
      open={open}
      rootClassName="pve-page-modal"
      title={title}
      width={760}
      onCancel={onClose}
    >
      <div className="pve-suit-picker">
        {options.map((suit) => {
          const selected = draftSuitNames.includes(suit.name);
          return (
            <button
              aria-pressed={selected}
              className={selected ? "is-selected" : ""}
              key={suit.id}
              type="button"
              onClick={() =>
                setDraftSuitNames(
                  selected
                    ? draftSuitNames.filter((name) => name !== suit.name)
                    : [...draftSuitNames, suit.name],
                )
              }
            >
              <img alt="" src={assetUrl(`suits/${suit.id}.png`)} />
              <span>{suit.name}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

function HighScoreRelicList({
  title,
  groups,
  activePosition,
  onPositionChange,
}: {
  title: string;
  groups: PveHighScoreGroup[];
  activePosition: string;
  onPositionChange: (position: string) => void;
}) {
  const groupByPosition = new Map(
    groups.map((group) => [String(group.position), group]),
  );
  const positionStats = [1, 2, 3, 4, 5, 6].map((position) => ({
    position,
    count: groupByPosition.get(String(position))?.relics.length || 0,
  }));

  return (
    <section className="pve-high-score-relics__category">
      <h3>{title}</h3>
      {groups.length ? (
        <Tabs
          className="pve-high-score-relics__tabs"
          activeKey={activePosition}
          items={positionStats.map(({ position, count }) => {
            const group = groupByPosition.get(String(position));
            const scoreByRelicId = new Map(
              (group?.relics || []).map((item) => [item.relic.id, item]),
            );
            return {
              key: String(position),
              label: (
                <span className="pve-high-score-relics__tab-label">
                  <b>{position} 号位</b>
                  <small>({count})</small>
                </span>
              ),
              children: group ? (
                <RelicList
                  desktopColumns={5}
                  desktopRows={3}
                  highlightedSubAttributes={["攻击加成", "暴击", "暴击伤害"]}
                  items={group.relics.map((item) => item.relic)}
                  itemBadge={(relic) => {
                    const score = scoreByRelicId.get(relic.id);
                    return score
                      ? `有效 ${score.effectiveCount}/${score.maximumEffectiveCount}`
                      : null;
                  }}
                />
              ) : (
                <Empty description="暂无符合条件的高评分御魂" />
              ),
            };
          })}
          onChange={onPositionChange}
        />
      ) : (
        <Empty description={`暂无符合条件的${title}`} />
      )}
    </section>
  );
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
    let cancelled = false;

    void Promise.all([
      loadHeroPanels<HeroStaticPayload>(),
      loadRelicSuits<RelicSuitStaticPayload>(),
    ])
      .then(([heroPayload, suitPayload]) => {
        if (cancelled) return;
        const susanoo = Object.values(heroPayload.heroesById || {}).find(
          (hero) => hero.name === "须佐之男",
        );
        setSusanooBaseStats(susanoo?.baseStats);
        setSuitTwoPieceAttributes(
          new Map(
            (suitPayload.yuhun_list || [])
              .filter(([, , , twoPieceText]) => Boolean(twoPieceText))
              .map(([, name, , twoPieceText]) => [name, twoPieceText || ""]),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setSusanooBaseStats(undefined);
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

  const activeFourPieceSuitNames = useMemo(
    () =>
      hasCustomFourPieceSelection
        ? selectedFourPieceSuitNames.filter((name) =>
            fourPieceSuitOptions.some((suit) => suit.name === name),
          )
        : preferredSuitNames(
            fourPieceSuitOptions,
            defaultFourPieceSuitNames,
            7,
          ),
    [
      fourPieceSuitOptions,
      hasCustomFourPieceSelection,
      selectedFourPieceSuitNames,
    ],
  );
  const activeFourPieceSuitNamesRef = useRef(activeFourPieceSuitNames);
  activeFourPieceSuitNamesRef.current = activeFourPieceSuitNames;
  const allFourPieceSuitNames = useMemo(
    () => fourPieceSuitOptions.map((suit) => suit.name),
    [fourPieceSuitOptions],
  );
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
      new URL("../../lib/pveCalculator.worker.ts", import.meta.url),
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
    <div className="width result pve-page">
      <div className="page-heading">
        <div>
          <span className="page-kicker">PVE 御魂组合</span>
          <h1>PVE 数据预览</h1>
        </div>
        <Tooltip title="按满级须佐之男的基础属性，结合御魂主副属性、普通两件套与逢魔一件套计算最终面板。">
          <span>须佐之男面板</span>
        </Tooltip>
      </div>

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
      <div className="pve-toolbar">
        <Button
          icon={<SettingOutlined />}
          onClick={() => setFourPiecePickerOpen(true)}
        >
          四件套：{activeFourPieceSuitNames.length} 个
        </Button>
      </div>

      <section className="pve-high-score-relics">
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
        <header className="pve-high-score-relics__heading">
          <div>
            <span>高评分御魂</span>
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
                gridTemplateColumns: `170px repeat(${fixedOmaSuitNames.length + 1}, minmax(178px, 1fr))`,
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
                    <span>御魂：{row.fourPieceSuitName}</span>
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
                        · 暴 {metric.panel.critRate.toFixed(1)}% · 爆{" "}
                        {metric.panel.critDamage.toFixed(1)}%
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
              <section className="pve-mobile-row" key={row.fourPieceSuitName}>
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
                            {Math.round(metric.panel.attack).toLocaleString(
                              "zh-CN",
                            )}{" "}
                            · 暴 {metric.panel.critRate.toFixed(1)}% · 爆{" "}
                            {metric.panel.critDamage.toFixed(1)}%
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

      <SuitPickerModal
        open={fourPiecePickerOpen}
        options={fourPieceSuitOptions}
        selectedSuitNames={activeFourPieceSuitNames}
        title="选择 PVE 四件套"
        onChange={(suitNames) => {
          setHasCustomFourPieceSelection(true);
          setSelectedFourPieceSuitNames(suitNames);
        }}
        onClose={() => setFourPiecePickerOpen(false)}
      />
    </div>
  );
}
