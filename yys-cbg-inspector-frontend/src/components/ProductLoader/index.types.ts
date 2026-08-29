/** ProductLoader 的组件类型。 */
import type { DatasetHistoryRecord } from "@/store";

export type ProductLoaderProps = {
  value: string;
  loading: boolean;
  history: DatasetHistoryRecord[];
  showHistoryTrigger: boolean;
  onChange: (value: string) => void;
  onLoad: () => void;
  onOpenHistory: () => void;
};
