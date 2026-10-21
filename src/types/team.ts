import type {
  CalculatedPanel,
  CalculatorExtraAttributeKey,
  HeroBaseStats,
  PanelConstraintKey,
} from "@/lib/calculator/types";
import type { CalculatorResult } from "@/lib/calculator/types";
import type { CalculatorNumericRange } from "./calculator";
import type { RelicView } from "./index";

export type TeamObjectiveDirection = "max" | "min";

/** 单个队伍成员的目标；同一成员只有一个属性和一个方向。 */
export type TeamMemberConfig = {
  id: string;
  heroId: number;
  targetAttribute: PanelConstraintKey;
  targetDirection: TeamObjectiveDirection;
  constraints: Partial<Record<PanelConstraintKey, CalculatorNumericRange>>;
  mainAttributes: Partial<Record<2 | 4 | 6, string[]>>;
  extraAttributes: Record<CalculatorExtraAttributeKey, number>;
  requiredFourPiece?: string;
  requiredTwoPieceAttributes: string[];
  requiredTwoPieceNames: string[];
};

export type TeamCalculationMember = {
  config: TeamMemberConfig;
  heroName: string;
  baseStats: HeroBaseStats;
};

export type TeamCalculationRequest = {
  members: TeamCalculationMember[];
  relicsByPosition: Record<string, RelicView[]>;
  suitTwoPieceAttributes: Record<string, string>;
};

export type TeamMemberCalculationResult = {
  config: TeamMemberConfig;
  heroName: string;
  result: CalculatorResult;
};

export type TeamCalculationResult = {
  members: TeamMemberCalculationResult[];
};

export type TeamCalculationProgress = {
  stage: "preparing" | "generating" | "matching" | "done";
  completed: number;
  total: number;
  message: string;
};

export type TeamWorkerInboundMessage = {
  type: "start";
  request: TeamCalculationRequest;
};

export type TeamWorkerProgressMessage = {
  type: "progress";
  progress: TeamCalculationProgress;
};

export type TeamWorkerDoneMessage = {
  type: "done";
  result: TeamCalculationResult;
};

export type TeamWorkerErrorMessage = {
  type: "error";
  message: string;
};

export type TeamWorkerMessage =
  TeamWorkerProgressMessage | TeamWorkerDoneMessage | TeamWorkerErrorMessage;

export type TeamMemberDraft = Omit<TeamMemberConfig, "id">;

export type TeamPanel = CalculatedPanel;
