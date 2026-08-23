import {
  calculateRelicCombinationsForRequest,
  type RelicCalculationCache,
} from "./relicCalculator";
import type {
  CalculatorWorkerInboundMessage,
  CalculatorWorkerRequest,
} from "./calculator/workerProtocol";

const workerScope = globalThis as typeof globalThis & {
  onmessage: (event: MessageEvent<CalculatorWorkerInboundMessage>) => void;
  postMessage: (value: unknown) => void;
};

let initialRequest: CalculatorWorkerRequest | undefined;
let calculationCache: RelicCalculationCache | undefined;

workerScope.onmessage = ({ data }) => {
  try {
    const request =
      data.type === "reuse"
        ? initialRequest
          ? {
              ...initialRequest,
              fixedSuitPhase: data.fixedSuitPhase,
              initialResults: data.initialResults || [],
            }
          : undefined
        : data;
    if (!request) {
      throw new Error("计算线程尚未收到初始御魂数据");
    }
    if (data.type !== "reuse") {
      initialRequest = data;
      calculationCache = { fixedSuitCandidateCache: new Map() };
    }
    let lastProgressSentAt = 0;
    const results = calculateRelicCombinationsForRequest(
      request,
      (progress) => {
      const now = performance.now();
      // 进度和预览均是展示信息，不应抢占组合搜索的消息队列。
      // 完成节点始终发送，中间更新限制为每 200ms 一次。
      const shouldSend =
        progress.processedRelics >= progress.totalRelics ||
        now - lastProgressSentAt >= 200;
      if (!shouldSend) return;
      lastProgressSentAt = now;
      // 极速模式只需要最终第一名。中间预览会携带完整的六件御魂对象，
      // 多 Worker 下的结构化克隆和弹窗渲染反而可能比搜索本身更耗时。
      // 完成消息仍始终返回完整结果，因此不影响最终结果或排序。
      if (request.filters.fastMode) {
        const { results: _results, ...lightweightProgress } = progress;
        workerScope.postMessage({ type: "progress", ...lightweightProgress });
      } else {
        workerScope.postMessage({ type: "progress", ...progress });
      }
      },
      calculationCache,
    );
    workerScope.postMessage({ type: "done", results });
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "御魂计算失败",
    });
  }
};

export {};
