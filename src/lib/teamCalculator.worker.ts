import { calculateTeam } from "./teamCalculator";
import type { TeamWorkerInboundMessage, TeamWorkerMessage } from "@/types/team";

const workerScope = globalThis as typeof globalThis & {
  onmessage: (event: MessageEvent<TeamWorkerInboundMessage>) => void;
  postMessage: (value: TeamWorkerMessage) => void;
};

workerScope.onmessage = ({ data }) => {
  if (data.type !== "start") return;
  try {
    const result = calculateTeam(data.request, (progress) =>
      workerScope.postMessage({ type: "progress", progress }),
    );
    workerScope.postMessage({ type: "done", result });
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "队伍计算失败",
    });
  }
};

export {};
