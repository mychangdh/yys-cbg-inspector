import type { StaticAssetPreview } from "@/store";

export type MaintenanceModalProps = {
  open: boolean;
  loading: boolean;
  assetPreview: StaticAssetPreview | null;
  onClose: () => void;
  onUpdate: () => Promise<void>;
};
