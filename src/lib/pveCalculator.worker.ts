import { calculateRelicCombinationsForRequest } from "./relicCalculator";
import type {
  CalculatedPanel,
  RelicCalculationRequest,
} from "./calculator/types";

type PveWorkerJob = {
  id: string;
  request: Omit<RelicCalculationRequest, "relicsByPosition">;
};

type PveWorkerRequest =
  | {
      type: "calculate";
      requestId: number;
      relicsByPosition: RelicCalculationRequest["relicsByPosition"];
      jobs: PveWorkerJob[];
    }
  | {
      type: "prioritize";
      requestId: number;
      jobIds: string[];
    };

type PveWorkerRun = {
  requestId: number;
  relicsByPosition: RelicCalculationRequest["relicsByPosition"];
  jobs: PveWorkerJob[];
};

const workerScope = globalThis as typeof globalThis & {
  onmessage: (event: MessageEvent<PveWorkerRequest>) => void;
  postMessage: (value: unknown) => void;
};

let activeRun: PveWorkerRun | undefined;

function prioritizeJobs(run: PveWorkerRun, jobIds: string[]) {
  const priorityIds = new Set(jobIds);
  run.jobs = [
    ...run.jobs.filter((job) => priorityIds.has(job.id)),
    ...run.jobs.filter((job) => !priorityIds.has(job.id)),
  ];
}

async function calculateJobs(run: PveWorkerRun) {
  try {
    while (activeRun === run && run.jobs.length) {
      const job = run.jobs.shift();
      if (!job) continue;

      try {
        const result = calculateRelicCombinationsForRequest({
          ...job.request,
          relicsByPosition: run.relicsByPosition,
        })[0];
        workerScope.postMessage({
          type: "result",
          requestId: run.requestId,
          result: result
            ? {
                id: job.id,
                metric: {
                  damage: Math.round(result.score),
                  panel: result.panel as CalculatedPanel,
                },
              }
            : { id: job.id },
        });
      } catch {
        workerScope.postMessage({
          type: "result",
          requestId: run.requestId,
          result: { id: job.id },
        });
      }

      // Yield after each search so a changed suit selection can reprioritize jobs.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    if (activeRun === run) {
      activeRun = undefined;
      workerScope.postMessage({ type: "done", requestId: run.requestId });
    }
  } catch (error) {
    if (activeRun === run) activeRun = undefined;
    workerScope.postMessage({
      type: "error",
      requestId: run.requestId,
      message:
        error instanceof Error ? error.message : "PVE calculation failed",
    });
  }
}

workerScope.onmessage = ({ data }) => {
  if (data.type === "prioritize") {
    const currentRun = activeRun;
    if (currentRun && currentRun.requestId === data.requestId) {
      prioritizeJobs(currentRun, data.jobIds);
    }
    return;
  }

  const run: PveWorkerRun = {
    requestId: data.requestId,
    relicsByPosition: data.relicsByPosition,
    jobs: [...data.jobs],
  };
  activeRun = run;
  void calculateJobs(run);
};

export {};
