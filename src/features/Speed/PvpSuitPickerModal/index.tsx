import Image from "next/image";
import { Button, Modal } from "antd";
import { assetUrl } from "@/lib/assetUrl";
import type { PvpSuitPickerModalProps } from "@/types";
import styles from "./index.module.scss";

export function PvpSuitPickerModal({
  open,
  options,
  selectedSuitNames,
  onToggleSuit,
  onClose,
}: PvpSuitPickerModalProps) {
  return (
    <Modal
      className="speed-pvp-suit-modal"
      footer={
        <Button type="primary" onClick={onClose}>
          完成
        </Button>
      }
      open={open}
      rootClassName={`${styles.scope} speed-page-modal`}
      title="选择四件套"
      width={760}
      onCancel={onClose}
    >
      <div className="speed-pvp-suit-picker" aria-label="选择御魂套件">
        {options.map((suit) => {
          const selected = selectedSuitNames.includes(suit.name);
          return (
            <button
              aria-pressed={selected}
              className={selected ? "is-selected" : ""}
              key={suit.id}
              type="button"
              onClick={() => onToggleSuit(suit.name)}
            >
              <Image
                alt=""
                src={assetUrl(`suits/${suit.id}.png`)}
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
