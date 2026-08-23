import { message } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { prioritizeCalculatorResults } from "../../../lib/calculator/resultRanking";
import {
  workerLimitForCapacity,
  workerLimitForRelicCount,
  type ComputeCapacity,
} from "../../../lib/calculator/workerCapacity";
import type { CalculatorResult } from "../../../lib/calculator/types";
import type { CalculatorWorkerMessage } from "../../../lib/calculator/workerProtocol";
import {
  format,
  minimumCalculationNoticeDuration,
  type CalculationRequest,
} from "../calculatorShared";
import type { RelicView } from "../../../types";

type CalculationProgressStage = NonNullable<
  Extract<CalculatorWorkerMessage, { type: "progress" }>["stage"]
>;

const progressStageOrder: Record<CalculationProgressStage, number> = {
  preparing: 0,
  matching: 1,
  validating: 2,
  ranking: 3,
};

function validResults(results: CalculatorResult[] | undefined) {
  return (results || []).filter((result) => result.relics.length === 6);
}

/**
 * Worker 搜索只依赖这些字段。剥离详情中的成长记录、图标和阶段快照，避免每个
 * Worker 都结构化克隆整套展示对象；完成后会按 id 还原完整御魂供结果页使用。
 */
function compactRelicForCalculation(relic: RelicView): RelicView {
  return {
    id: relic.id,
    level: relic.level,
    quality: relic.quality,
    position: relic.position,
    suit: relic.suit ? { id: relic.suit.id, name: relic.suit.name } : undefined,
    mainAttribute: relic.mainAttribute
      ? {
          label: relic.mainAttribute.label,
          value: relic.mainAttribute.value,
          isPercent: relic.mainAttribute.isPercent,
        }
      : null,
    subAttributes: relic.subAttributes?.map((attribute) => ({
      label: attribute.label,
      value: attribute.value,
      isPercent: attribute.isPercent,
    })),
    setBonusAttribute: relic.setBonusAttribute
      ? {
          label: relic.setBonusAttribute.label,
          value: relic.setBonusAttribute.value,
          isPercent: relic.setBonusAttribute.isPercent,
        }
      : null,
    enhancement: relic.enhancement?.totals
      ? {
          totals: relic.enhancement.totals.map((attribute) => ({
            key: attribute.key,
            label: attribute.label,
            count: attribute.count,
            total: attribute.total,
            values: [],
          })),
        }
      : undefined,
  };
}

function compactCalculationRequest(request: CalculationRequest) {
  return {
    ...request,
    relicsByPosition: Object.fromEntries(
      Object.entries(request.relicsByPosition).map(([position, relics]) => [
        position,
        relics.map(compactRelicForCalculation),
      ]),
    ),
  } as CalculationRequest;
}

function relicIndexForCalculation(request: CalculationRequest) {
  const byId = new Map<string, RelicView>();
  Object.values(request.relicsByPosition).forEach((relics) => {
    relics.forEach((relic) => {
      if (relic.id) byId.set(String(relic.id), relic);
    });
  });
  return byId;
}

function hydrateCalculationResults(
  results: CalculatorResult[] | undefined,
  relicsById: ReadonlyMap<string, RelicView>,
) {
  return validResults(results).map((result) => ({
    ...result,
    relics: result.relics.map(
      (relic) => relicsById.get(String(relic.id)) || relic,
    ),
  }));
}

function scrollToResults() {
  // Ant Design 弹窗关闭前会锁住页面滚动；等退出动画完成后再定位结果区域。
  window.setTimeout(() => {
    const target = document.querySelector<HTMLElement>(".calculator-results");
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, 320);
}

/**
 * 管理一次御魂计算的完整生命周期。
 *
 * Worker 的实时预览和最终结果均在这里合并，避免页面根据不同终端走出不同的
 * 状态分支。计算器页面只负责准备请求和展示状态。
 */
export function useRelicCalculation() {
  const [results, setResults] = useState<CalculatorResult[]>([]);
  const [running, setRunning] = useState(false);
  const [latestCalculationResults, setLatestCalculationResults] = useState<
    CalculatorResult[]
  >([]);
  const [calculationProgress, setCalculationProgress] = useState(0);
  const [calculationStage, setCalculationStage] =
    useState<CalculationProgressStage>("preparing");
  const [calculationProgressText, setCalculationProgressText] =
    useState("正在准备计算任务");
  const [elapsed, setElapsed] = useState<number>();

  const workersRef = useRef<Set<Worker>>(new Set());
  const finishTimerRef = useRef<number | undefined>(undefined);
  const startedAtRef = useRef(0);
  const latestResultsRef = useRef<CalculatorResult[]>([]);
  const runIdRef = useRef(0);
  const runningRef = useRef(false);
  const computeCapacityRef = useRef<ComputeCapacity | undefined>(undefined);
  const computeCapacityPromiseRef = useRef<
    Promise<ComputeCapacity | undefined> | undefined
  >(undefined);

  useEffect(() => {
    const request = window.desktop
      ?.getComputeCapacity()
      .then((capacity) => {
        computeCapacityRef.current = capacity;
        return capacity;
      })
      .catch(() => undefined);
    computeCapacityPromiseRef.current = request;
  }, []);

  const terminateWorkers = useCallback(() => {
    workersRef.current.forEach((worker) => worker.terminate());
    workersRef.current.clear();
  }, []);

  const clearTimers = useCallback(() => {
    if (finishTimerRef.current !== undefined) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = undefined;
    }
  }, []);

  const finishCalculation = useCallback(
    (runId: number, nextResults: CalculatorResult[]) => {
      if (runIdRef.current !== runId) return;

      const finalResults = nextResults.length
        ? nextResults
        : latestResultsRef.current;
      const duration = performance.now() - startedAtRef.current;

      // 完成消息在某些桌面浏览器中可能不含大型 results 数组。此时保留已成功
      // 克隆到主线程的实时预览，不能让最终表格被空数组覆盖。
      latestResultsRef.current = finalResults;
      setLatestCalculationResults(finalResults);
      setResults(finalResults);
      setElapsed(duration);
      // Keep 100% reserved for the instant the running modal closes. This
      // avoids showing a completed bar while the minimum notice timer is still
      // keeping the modal visible.
      setCalculationProgress(99);
      setCalculationStage("ranking");
      setCalculationProgressText("计算完成，正在整理最终结果");

      const closeFinishedCalculation = () => {
        if (runIdRef.current !== runId) return;
        terminateWorkers();
        runningRef.current = false;
        setCalculationProgress(100);
        setRunning(false);
        finishTimerRef.current = undefined;
        scrollToResults();
      };
      const remainingNoticeDuration = Math.max(
        0,
        minimumCalculationNoticeDuration - duration,
      );
      if (remainingNoticeDuration) {
        finishTimerRef.current = window.setTimeout(
          closeFinishedCalculation,
          remainingNoticeDuration,
        );
      } else {
        closeFinishedCalculation();
      }
    },
    [terminateWorkers],
  );

  const startCalculation = useCallback(
    async (request: CalculationRequest) => {
      if (runningRef.current) return;

      clearTimers();
      terminateWorkers();
      runIdRef.current += 1;
      const runId = runIdRef.current;
      runningRef.current = true;
      startedAtRef.current = performance.now();
      latestResultsRef.current = [];

      setResults([]);
      setElapsed(undefined);
      setLatestCalculationResults([]);
      setRunning(true);
      setCalculationProgress(0);
      setCalculationStage("preparing");
      setCalculationProgressText("正在整理御魂数据和计算条件");

      // 首次启动时 IPC 可能尚未回传。等待这一次极短的资源探测，避免首轮计算
      // 错用固定回退并发数；探测失败或异常悬挂时都必须迅速回退，不能阻塞计算入口。
      if (!computeCapacityRef.current && computeCapacityPromiseRef.current) {
        await Promise.race([
          computeCapacityPromiseRef.current,
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, 180);
          }),
        ]);
        if (runIdRef.current !== runId) return;
      }

      window.setTimeout(() => {
        if (runIdRef.current !== runId) return;
        const mergeResults = (candidateResults: CalculatorResult[]) =>
          prioritizeCalculatorResults(
            candidateResults,
            request.filters,
            request.resultLimit,
          );
        // 固定四件套的 15 种号位布局彼此独立。即使同时选择多个两件套，
        // 每个布局仍可完整交给单独 Worker，最后只需合并结果，不会改变搜索覆盖范围。
        // 之前按两件套数量限制并行，用户一旦增加条件就退化为单线程。
        const canSplitFixedSuitLayouts = Boolean(
          request.filters.requiredFourPiece,
        );
        // Electron 会提供实时空闲内存；启动早期 IPC 尚未返回时，只使用保守
        // 的桌面回退值，避免固定四件套一次性把 15 个布局全部并发启动。
        const maximumWorkers = computeCapacityRef.current
          ? workerLimitForCapacity(computeCapacityRef.current)
          : 4;
        const totalRelics = Object.values(request.relicsByPosition).reduce(
          (total, relics) => total + relics.length,
          0,
        );
        // 大仓库中每个 Worker 都会保留一份完整御魂副本。按仓库规模限流能避免
        // 多份候选缓存同时触发 GC，把 CPU 时间留给真正的组合搜索。
        const workerCount = canSplitFixedSuitLayouts
          ? Math.min(
              workerLimitForRelicCount(maximumWorkers, totalRelics),
              15,
            )
          : 1;
        const patternGroups = Array.from(
          { length: workerCount },
          () => [] as number[],
        );
        // 15 种四件套布局的候选量并不均匀。按索引轮转会让包含御魂较少
        // 号位的 Worker 很早完成，剩下一个 Worker 独占大量组合。用每个
        // 号位可选御魂数的对数和估算布局成本，再按最长任务优先分配，能够
        // 平衡 CPU 占用且不改变任何 Worker 实际搜索的布局集合。
        const eligibleCountFor = (position: number, isRequired: boolean) => {
          const mainAttributes =
            request.filters.mainAttributes[position as 2 | 4 | 6];
          return (request.relicsByPosition[String(position)] || []).filter(
            (relic) => {
              const selected = request.filters.selectedRelicIds?.[position];
              return (
                (relic.quality || 0) >= request.filters.quality &&
                (relic.level || 0) >= request.filters.level &&
                (!selected ||
                  selected.size === 0 ||
                  selected.has(String(relic.id))) &&
                (!request.filters.suitName ||
                  relic.suit?.name === request.filters.suitName) &&
                (!mainAttributes?.length ||
                  mainAttributes.includes(relic.mainAttribute?.label || "")) &&
                (!isRequired ||
                  relic.suit?.name === request.filters.requiredFourPiece)
              );
            },
          ).length;
        };
        const positionCounts = [1, 2, 3, 4, 5, 6].map((position) => ({
          all: eligibleCountFor(position, false),
          required: eligibleCountFor(position, true),
        }));
        const fourPieceMasks: number[] = [];
        for (let mask = 0; mask < 1 << 6; mask += 1) {
          let pieceCount = 0;
          for (let position = 0; position < 6; position += 1) {
            pieceCount += Number(Boolean(mask & (1 << position)));
          }
          if (pieceCount === 4) fourPieceMasks.push(mask);
        }
        const patternJobs = fourPieceMasks
          .map((mask, index) => {
            // The progress denominator is based on matching relics, so the
            // scheduler must use the same linear work estimate. Logarithmic
            // weights put the largest layout in one late Worker and make the
            // normal progress bar look stuck near the end.
            const weight = positionCounts.reduce((total, counts, position) => {
              const isRequired = Boolean(mask & (1 << position));
              return total + (isRequired ? counts.required : counts.all);
            }, 0);
            return { index, weight };
          })
          .sort((left, right) => right.weight - left.weight);
        const groupWeights = Array.from({ length: workerCount }, () => 0);
        patternJobs.forEach(({ index, weight }) => {
          const target = groupWeights.reduce(
            (best, value, groupIndex) =>
              value < groupWeights[best] ? groupIndex : best,
            0,
          );
          patternGroups[target].push(index);
          groupWeights[target] += weight;
        });
        const streamedResults = new Map<Worker, CalculatorResult[]>();
        const completedResults = new Map<Worker, CalculatorResult[]>();
        const stagedResults: CalculatorResult[] = [];
        const workerRequest = compactCalculationRequest(request);
        const relicsById = relicIndexForCalculation(request);
        const progressCounts = new Map<
          Worker,
          {
            processed: number;
            total: number;
            completed: boolean;
            stage: CalculationProgressStage;
          }
        >();
        let completedWorkers = 0;
        let lastPreviewRefreshAt = 0;
        let lastProgressUpdateAt = 0;
        let activeFixedSuitPhase: "unrestricted" | "explicit" | undefined;
        const progressUpdateInterval = request.filters.fastMode ? 400 : 180;
        const publishProgress = (force = false) => {
          const now = performance.now();
          if (!force && now - lastProgressUpdateAt < progressUpdateInterval) {
            return;
          }
          lastProgressUpdateAt = now;
          const processed = [...progressCounts.values()].reduce(
            (total, item) => total + item.processed,
            0,
          );
          const total = [...progressCounts.values()].reduce(
            (sum, item) => sum + item.total,
            0,
          );
          const allWorkerTotalsKnown =
            progressCounts.size === patternGroups.length &&
            [...progressCounts.values()].every((item) => item.total > 0);
          const localProgress = allWorkerTotalsKnown
            ? (processed / total) * 100
            : 0;
          /**
           * 固定四件套的大仓库搜索分为“全覆盖”和“具体两件套补漏”两轮。
           * 两轮各自的 Worker 分母独立，直接显示会在第一轮完成时误报 100%；
           * 映射到统一进度区间后，用户能看到连续、单调的真实阶段进度。
           */
          const overallProgress =
            canSplitFixedSuitLayouts && activeFixedSuitPhase
              ? activeFixedSuitPhase === "unrestricted"
                ? localProgress * 0.5
                : 50 + localProgress * 0.5
              : localProgress;
          const currentStage =
            [...progressCounts.values()]
              .filter((item) => !item.completed)
              .map((item) => item.stage)
              .sort(
                (left, right) =>
                  progressStageOrder[left] - progressStageOrder[right],
              )[0] || "ranking";
          setCalculationProgress((current) =>
            Math.max(current, Math.min(99, Math.round(overallProgress))),
          );
          setCalculationStage(currentStage);
          setCalculationProgressText(
            total
              ? `已处理搜索节点 ${format(processed)} / ${format(total)}`
              : "正在建立候选组合",
          );
        };
        const mergedWorkerResults = () =>
          mergeResults(
            [
              ...stagedResults,
              ...streamedResults.values(),
              ...completedResults.values(),
            ].flat(),
          );
        const refreshPreview = (force = false) => {
          const now = performance.now();
          // 进度消息可能比屏幕刷新频率更密集。预览只需保持流畅，最终结果仍在
          // Worker 完成时强制合并，避免主线程反复排序和触发 React 重渲染拖慢计算。
          if (!force && now - lastPreviewRefreshAt < 250) return;
          lastPreviewRefreshAt = now;
          const merged = mergedWorkerResults();
          if (!merged.length) return;
          latestResultsRef.current = merged;
          setLatestCalculationResults(merged);
        };
        const fail = (errorMessage: string) => {
          if (runIdRef.current !== runId) return;
          terminateWorkers();
          runningRef.current = false;
          setRunning(false);
          void message.error(errorMessage);
        };

        const startWorkerPhase = (
          fixedSuitPhase?: "unrestricted" | "explicit",
          reuseWorkers = false,
        ) => {
          activeFixedSuitPhase = fixedSuitPhase;
          streamedResults.clear();
          completedResults.clear();
          progressCounts.clear();
          completedWorkers = 0;
          setCalculationStage("matching");
          setCalculationProgressText("正在分配并行计算任务");
          const startExistingWorker = (worker: Worker) => {
            progressCounts.set(worker, {
              processed: 0,
              total: 0,
              completed: false,
              stage: "preparing",
            });
            try {
              worker.postMessage({
                type: "reuse",
                fixedSuitPhase,
                initialResults:
                  fixedSuitPhase === "explicit" ? stagedResults : undefined,
              });
            } catch {
              fail("御魂计算任务无法继续执行");
            }
          };
          const createWorker = (fixedPatternIndexes: number[]) => {
            const worker = new Worker(
              new URL(
                "../../../lib/relicCalculator.worker.ts",
                import.meta.url,
              ),
              { type: "module" },
            );
            workersRef.current.add(worker);
            progressCounts.set(worker, {
              processed: 0,
              total: 0,
              completed: false,
              stage: "preparing",
            });
            worker.onmessage = (
              event: MessageEvent<CalculatorWorkerMessage>,
            ) => {
              if (runIdRef.current !== runId) return;
              const data = event.data;
              if (data.type === "error") {
                fail(data.message || "御魂计算失败");
                return;
              }
              if (data.type === "progress") {
                const previous = progressCounts.get(worker);
                progressCounts.set(worker, {
                  processed: Math.max(
                    previous?.processed || 0,
                    data.processedRelics || 0,
                  ),
                  total: Math.max(previous?.total || 0, data.totalRelics || 0),
                  completed: false,
                  stage: data.stage || previous?.stage || "matching",
                });
                publishProgress(data.processedRelics === data.totalRelics);
                /* Progress is published by publishProgress above. */
                // Worker 完成阶段切换时，旧逻辑会把第二阶段重新映射到
                // 低百分比，导致进度条回退；进度展示只允许单调增长。
                // 极速模式的 Worker 不会回传中间结果，避免在计算期间把
                // 多份完整御魂组合克隆到主线程和弹窗；最终 done 仍会合并。
                const preview = request.filters.fastMode
                  ? []
                  : hydrateCalculationResults(data.results, relicsById);
                if (!preview.length) return;
                // Worker 发送的是该 Worker 当前的累计前沿，直接替换即可。
                // 反复追加再排序会让预览阶段的主线程开销随进度线性膨胀。
                streamedResults.set(worker, preview);
                refreshPreview();
                return;
              }

              const completed = hydrateCalculationResults(
                data.results,
                relicsById,
              );
              completedResults.set(
                worker,
                completed.length
                  ? completed
                  : streamedResults.get(worker) || [],
              );
              const previousProgress = progressCounts.get(worker);
              if (previousProgress) {
                progressCounts.set(worker, {
                  processed: previousProgress.total,
                  total: previousProgress.total,
                  completed: true,
                  stage: previousProgress.stage,
                });
              }
              completedWorkers += 1;
              publishProgress(true);
              refreshPreview(true);
              if (completedWorkers === workerCount) {
                if (activeFixedSuitPhase === "unrestricted") {
                  stagedResults.splice(
                    0,
                    stagedResults.length,
                    ...mergedWorkerResults(),
                  );
                  startWorkerPhase("explicit", true);
                  return;
                }
                workersRef.current.delete(worker);
                worker.terminate();
                finishCalculation(runId, mergedWorkerResults());
              }
            };
            worker.onerror = (event) => {
              event.preventDefault();
              fail("御魂计算线程异常退出");
            };
            worker.onmessageerror = () => {
              fail("御魂计算结果传输失败，本次计算已停止");
            };
            try {
              worker.postMessage({
                ...workerRequest,
                resultLimit: workerRequest.resultLimit,
                filters:
                  workerCount > 1
                    ? { ...workerRequest.filters, fixedPatternIndexes }
                    : workerRequest.filters,
                fixedSuitPhase,
                initialResults:
                  fixedSuitPhase === "explicit" ? stagedResults : undefined,
              });
            } catch {
              worker.terminate();
              workersRef.current.delete(worker);
              fail("御魂计算任务无法启动");
            }
          };
          if (reuseWorkers) {
            [...workersRef.current].forEach(startExistingWorker);
          } else {
            patternGroups.forEach(createWorker);
          }
        };
        /**
         * 先完成所有布局的全覆盖搜索，再把合并后的全局 Top-N 作为具体
         * 两件套补漏阶段的下界。补漏阶段仍逐布局完整执行，但不再只能使用
         * 单个 Worker 的局部结果，六千件以上仓库可跳过更多理论上无望布局。
         */
        startWorkerPhase(
          canSplitFixedSuitLayouts ? "unrestricted" : undefined,
        );
      }, 0);
    },
    [clearTimers, finishCalculation, terminateWorkers],
  );

  const stopCalculation = useCallback(() => {
    if (!runningRef.current) return;

    clearTimers();
    const completedResults = latestResultsRef.current;
    const duration = startedAtRef.current
      ? performance.now() - startedAtRef.current
      : undefined;
    runIdRef.current += 1;
    terminateWorkers();
    runningRef.current = false;
    setRunning(false);

    if (completedResults.length) {
      setResults(completedResults);
      if (duration !== undefined) setElapsed(duration);
      scrollToResults();
      void message.info("计算已终止，已展示当前完成的组合");
      return;
    }
    void message.info("本次御魂计算已终止，尚未生成完整组合");
  }, [clearTimers, terminateWorkers]);

  useEffect(
    () => () => {
      clearTimers();
      terminateWorkers();
    },
    [clearTimers, terminateWorkers],
  );

  return {
    results,
    running,
    latestCalculationResults,
    calculationProgress,
    calculationStage,
    calculationProgressText,
    elapsed,
    startCalculation,
    stopCalculation,
  };
}
