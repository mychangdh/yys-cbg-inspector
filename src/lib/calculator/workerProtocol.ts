import type {
  CalculatorProgressStage,
  CalculatorResult,
  RelicCalculationRequest,
} from "./types";

/** Worker 运行时使用完整请求，默认参数在主线程提交前已经补齐。 */
export type CalculatorWorkerRequest = Required<RelicCalculationRequest>;

/**
 * 同一轮固定四件套计算的第二阶段复用已启动的 Worker。御魂仓库、式神基础
 * 面板和筛选条件均与第一阶段一致，因此只需补充阶段和全局结果下界。
 */
export type CalculatorWorkerReuseRequest = {
  type: "reuse";
  fixedSuitPhase: "unrestricted" | "explicit" | undefined;
  initialResults?: CalculatorResult[];
};

export type CalculatorWorkerInboundMessage =
  CalculatorWorkerRequest | CalculatorWorkerReuseRequest;

export type CalculatorWorkerProgressMessage = {
  type: "progress";
  processedRelics?: number;
  totalRelics?: number;
  stage?: CalculatorProgressStage;
  results?: CalculatorResult[];
};

export type CalculatorWorkerDoneMessage = {
  type: "done";
  results?: CalculatorResult[];
};

export type CalculatorWorkerErrorMessage = {
  type: "error";
  message?: string;
};

/** 主线程只处理以下三种消息，其他 Worker 输出一律忽略。 */
export type CalculatorWorkerMessage =
  | CalculatorWorkerProgressMessage
  | CalculatorWorkerDoneMessage
  | CalculatorWorkerErrorMessage;
