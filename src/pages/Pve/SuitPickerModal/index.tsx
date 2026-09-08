import { useEffect, useState } from "react";
import { Button, Modal } from "antd";
import { assetUrl } from "@/lib/assetUrl";
import type { SuitPickerModalProps } from "@/types/pve";
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
              <img alt="" src={assetUrl(`suits/${suit.id}.png`)} />
              <span>{suit.name}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
