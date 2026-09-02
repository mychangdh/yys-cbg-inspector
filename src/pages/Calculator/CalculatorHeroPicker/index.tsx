import { PictureOutlined } from "@ant-design/icons";
import { Button, Input, Modal } from "antd";
import { useState } from "react";
import { assetUrl } from "@/lib/assetUrl";
import type {
  CalculatorHeroOption,
  CalculatorHeroPickerProps,
} from "./index.types";

function HeroPortrait({ hero }: { hero: CalculatorHeroOption }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="calculator-hero-portrait" aria-hidden="true">
      {!failed && (
        <img
          src={assetUrl(`heroes/${hero.id}.png`)}
          alt=""
          onError={() => setFailed(true)}
        />
      )}
      {failed && <PictureOutlined />}
    </span>
  );
}

/** 选择式神并保留最近使用记录。 */
export function CalculatorHeroPicker({
  state,
  options,
  actions,
  commands,
}: CalculatorHeroPickerProps) {
  const {
    open: heroModalOpen,
    search,
    selectedHeroId: heroId,
    disabled: running,
  } = state;
  const { recentHeroes, heroGroups, rarityLabels } = options;
  const { onSearchChange, onSelect } = actions;
  const { onClose } = commands;
  const heroSearch = search;
  const setHeroSearch = (value: string | { target: { value: string } }) =>
    onSearchChange(typeof value === "string" ? value : value.target.value);
  const chooseHero = onSelect;
  const setHeroModalOpen = (next: boolean) => {
    if (!next) onClose();
  };
  return (
    <Modal
      open={heroModalOpen}
      rootClassName="calculator-page-modal"
      title="选择式神"
      className="calculator-hero-modal"
      destroyOnHidden
      footer={
        <Button onClick={() => setHeroModalOpen(false)} type="primary">
          关闭
        </Button>
      }
      width={860}
      onCancel={() => setHeroModalOpen(false)}
    >
      <Input.Search
        allowClear
        value={heroSearch}
        disabled={running}
        onChange={(event) => setHeroSearch(event.target.value)}
        placeholder="搜索式神"
        style={{ marginBottom: 12 }}
      />
      <div className="calculator-hero-picker">
        {recentHeroes.length > 0 && (
          <section className="calculator-picker-group calculator-recent-picker-group">
            <h3>最近选择</h3>
            <div className="calculator-picker-group-grid">
              {recentHeroes.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={item.id === heroId ? "is-selected" : ""}
                  disabled={running}
                  onClick={() => chooseHero(item)}
                >
                  <HeroPortrait hero={item} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {heroGroups.map(([rarity, items]) => (
          <section className="calculator-picker-group" key={rarity}>
            <h3>{rarityLabels[rarity] || "其他式神"}</h3>
            <div className="calculator-picker-group-grid">
              {items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={item.id === heroId ? "is-selected" : ""}
                  disabled={running}
                  onClick={() => chooseHero(item)}
                >
                  <HeroPortrait hero={item} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
