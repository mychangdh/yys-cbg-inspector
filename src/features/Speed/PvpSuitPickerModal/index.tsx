import Image from "next/image";
import { Button, Empty, Input, Modal } from "antd";
import { useEffect, useState } from "react";
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
  const [search, setSearch] = useState("");
  const matchedOptions = options.filter((suit) =>
    suit.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const selectedOptions = matchedOptions.filter((suit) =>
    selectedSuitNames.includes(suit.name),
  );
  const availableOptions = matchedOptions.filter(
    (suit) => !selectedSuitNames.includes(suit.name),
  );

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  const optionGroups = [
    { title: "已选御魂", options: selectedOptions },
    { title: "全部御魂", options: availableOptions },
  ].filter(({ options: groupOptions }) => groupOptions.length > 0);

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
      <Input
        allowClear
        aria-label="搜索御魂"
        className="speed-pvp-suit-search"
        placeholder="搜索御魂名称"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {optionGroups.length ? (
        optionGroups.map(({ title, options: groupOptions }) => (
          <section className="speed-pvp-suit-group" key={title}>
            <h3>{title}</h3>
            <div className="speed-pvp-suit-picker" aria-label={title}>
              {groupOptions.map((suit) => {
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
          </section>
        ))
      ) : (
        <Empty className="speed-pvp-suit-empty" description="没有匹配的御魂" />
      )}
    </Modal>
  );
}
