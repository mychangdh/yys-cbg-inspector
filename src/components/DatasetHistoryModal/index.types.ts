/** 历史记录弹窗的组件类型。 */
import type { DatasetHistoryRecord } from "@/store";

export type DatasetHistoryModalProps = {
  open: boolean;
  history: DatasetHistoryRecord[];
  onOpenChange: (open: boolean) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
};
