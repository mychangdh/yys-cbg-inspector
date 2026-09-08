import type {
  CalculatedPanel,
  RelicCalculationRequest,
} from "@/lib/calculator/types";
import type { RelicDataset, RelicView } from "./index";

export type PvePageProps = {
  dataset: RelicDataset;
};

export type SuitOption = NonNullable<RelicView["suit"]>;

export type PveScoredRelic = {
  relic: RelicView;
  effectiveCount: number;
  maximumEffectiveCount: 8 | 11;
};

export type PveHighScoreGroup = {
  position: number;
  relics: PveScoredRelic[];
};

export type PveMetric = {
  damage: number;
  panel: CalculatedPanel;
};

export type PveTableRow = {
  fourPieceSuitName: string;
  metrics: Array<PveMetric | undefined>;
  average?: number;
};

export type PveWorkerJob = {
  id: string;
  fourPieceSuitName: string;
  omaSuitName: string;
  request: RelicCalculationRequest;
};

export type PveWorkerPayloadJob = Omit<PveWorkerJob, "request"> & {
  request: Omit<RelicCalculationRequest, "relicsByPosition">;
};

export type PveWorkerResponse = {
  type: "result" | "done" | "error";
  requestId: number;
  result?: { id: string; metric?: PveMetric };
  message?: string;
};

export type SuitPickerModalProps = {
  open: boolean;
  title: string;
  options: SuitOption[];
  selectedSuitNames: string[];
  onChange: (suitNames: string[]) => void;
  onClose: () => void;
};

export type HighScoreRelicListProps = {
  title: string;
  groups: PveHighScoreGroup[];
  activePosition: string;
  onPositionChange: (position: string) => void;
};
