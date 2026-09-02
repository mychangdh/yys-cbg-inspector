import Image from "next/image";
import { Button, Input, Modal } from "antd";
import { assetUrl } from "@/lib/assetUrl";
import type { RelicSuitOption } from "@/types/relicInventory";
import styles from "./index.module.scss";

type RelicSuitPickerModalProps = {
  open: boolean;
  search: string;
  options: RelicSuitOption[];
  selectedSuitNames: string[];
  onSearchChange: (value: string) => void;
  onToggleSuit: (name: string) => void;
  onClose: () => void;
};

export function RelicSuitPickerModal({
  open,
  search,
  options,
  selectedSuitNames,
  onSearchChange,
  onToggleSuit,
  onClose,
}: RelicSuitPickerModalProps) {
  return (
    <Modal
      open={open}
      className={styles.modal}
      rootClassName={styles.modalRoot}
      title="选择御魂种类"
      width={760}
      onCancel={onClose}
      footer={
        <Button type="primary" onClick={onClose}>
          关闭
        </Button>
      }
    >
      <Input
        allowClear
        value={search}
        placeholder="搜索御魂名称"
        onChange={(event) => onSearchChange(event.target.value)}
        style={{ marginBottom: 12 }}
      />
      <div className={styles.suitPicker}>
        {options.map((suit) => {
          const selected = selectedSuitNames.includes(suit.name);
          return (
            <button
              type="button"
              key={suit.id}
              className={`${styles.suitOption} ${selected ? styles.selected : ""}`.trim()}
              onClick={() => onToggleSuit(suit.name)}
            >
              <Image
                src={assetUrl(`suits/${suit.id}.png`)}
                alt=""
                width={48}
                height={48}
                unoptimized
              />
              <span>{suit.name}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
