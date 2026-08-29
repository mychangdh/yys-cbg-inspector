export type MaintenancePageProps = {
  onBack: () => void;
  onRemoteUpdate: () => Promise<void>;
  remoteUpdating: boolean;
  staticDataRevision: number;
};
