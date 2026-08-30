import Image from "next/image";
import { Button, Modal } from "antd";
import { useEffect, useState } from "react";
import { assetUrl } from "@/lib/assetUrl";
import type { SuitPickerModalProps } from "../index.types";
import "./index.scss";

export function SuitPickerModal({
  open,
  title,
  options,
  selectedSuitNames,
  onChange,
  onClose,
}: SuitPickerModalProps) {
  const [draftSuitNames, setDraftSuitNames] = useState(selectedSuitNames);

  useEffect(() => {
    if (open) setDraftSuitNames(selectedSuitNames);
  }, [open, selectedSuitNames]);

  return (
    <Modal
      className="pve-suit-modal"
      footer={
        <Button
          type="primary"
          onClick={() => {
            onChange(draftSuitNames);
            onClose();
          }}
        >
          完成
        </Button>
      }
      open={open}
      rootClassName="pve-page-modal"
      title={title}
      width={760}
      onCancel={onClose}
    >
      <div className="pve-suit-picker">
        {options.map((suit) => {
          const selected = draftSuitNames.includes(suit.name);
          return (
            <button
              aria-pressed={selected}
              className={selected ? "is-selected" : ""}
              key={suit.id}
              type="button"
              onClick={() =>
                setDraftSuitNames(
                  selected
                    ? draftSuitNames.filter((name) => name !== suit.name)
                    : [...draftSuitNames, suit.name],
                )
              }
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
