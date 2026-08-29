import { Button, Modal } from "antd";
import { useRef } from "react";
import { assetUrl } from "@/lib/assetUrl";
import type {
  CalculatorSuitOption,
  CalculatorSuitPickerProps,
} from "./index.types";

/** 选择四件套、两件套属性和逢魔套装。 */
export function CalculatorSuitPicker({
  state,
  options,
  actions,
  commands,
}: CalculatorSuitPickerProps) {
  const {
    open: relicModalOpen,
    running,
    fourPiece: selectedFourPiece,
    twoPieceAttributes: selectedTwoPieceAttributes,
    omaTwoPieces: selectedOmaTwoPieces,
    selectedTwoPieceCount,
    selectedRelicSlots,
  } = state;
  const {
    suitTypes,
    twoPieceGroups,
    omaSuits,
    recentChoices: availableRecentRelicChoices,
  } = options;
  const {
    onSelectFourPiece: selectFourPiece,
    onToggleTwoPieceAttribute: toggleTwoPieceAttribute,
    onToggleOmaTwoPiece: toggleOmaTwoPiece,
  } = actions;
  const { onClose } = commands;
  const twoPiecePickerRef = useRef<HTMLElement>(null);
  const setRelicModalOpen = (next: boolean) => {
    if (!next) onClose();
  };
  return (
    <Modal
      open={relicModalOpen}
      rootClassName="calculator-page-modal"
      title="选择御魂类型"
      className="calculator-relic-modal"
      footer={
        <Button type="primary" onClick={() => setRelicModalOpen(false)}>
          关闭
        </Button>
      }
      width={1100}
      onCancel={() => setRelicModalOpen(false)}
    >
      {availableRecentRelicChoices.length > 0 && (
        <section className="calculator-recent-relic-choices">
          <h3>最近选择</h3>
          <div>
            {availableRecentRelicChoices.map((choice) => {
              const suit = suitTypes.find((item) => item.name === choice.value);
              const selected =
                choice.kind === "fourPiece"
                  ? selectedFourPiece === choice.value
                  : choice.kind === "twoPieceAttribute"
                    ? selectedTwoPieceAttributes.has(choice.value)
                    : selectedOmaTwoPieces.has(choice.value);
              const disabled =
                running ||
                (!selected &&
                  (choice.kind === "fourPiece"
                    ? !selectedFourPiece && selectedTwoPieceCount > 1
                    : selectedRelicSlots >= 6));
              return (
                <button
                  type="button"
                  key={`${choice.kind}-${choice.value}`}
                  className={selected ? "is-selected" : ""}
                  disabled={disabled}
                  onClick={() => {
                    if (choice.kind === "fourPiece")
                      selectFourPiece(choice.value);
                    else if (choice.kind === "twoPieceAttribute")
                      toggleTwoPieceAttribute(choice.value);
                    else toggleOmaTwoPiece(choice.value);
                  }}
                >
                  {suit && (
                    <img src={assetUrl(`suits/${suit.id}.png`)} alt="" />
                  )}
                  <span>
                    {choice.kind === "fourPiece"
                      ? `4件 ${choice.value}`
                      : `2件 ${choice.value}`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <div className="calculator-suit-picker-columns">
        <section className="calculator-suit-picker-column calculator-four-piece-column">
          <h3>四件套（单选）</h3>
          {twoPieceGroups.map((group) => (
            <section className="calculator-picker-group" key={group.label}>
              <h4>{group.label}</h4>
              <div className="calculator-relic-picker">
                {group.suits.map((suit) => {
                  const selected = selectedFourPiece === suit.name;
                  return (
                    <button
                      type="button"
                      key={suit.id}
                      className={`calculator-suit-card${
                        selected ? " is-selected" : ""
                      }`}
                      disabled={
                        running ||
                        (!selected &&
                          !selectedFourPiece &&
                          selectedTwoPieceCount > 1)
                      }
                      onClick={() => selectFourPiece(suit.name)}
                    >
                      <img
                        className="calculator-suit-icon"
                        src={assetUrl(`suits/${suit.id}.png`)}
                        alt=""
                      />
                      <strong>{suit.name}</strong>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </section>
        <section
          className="calculator-suit-picker-column calculator-two-piece-column"
          ref={twoPiecePickerRef}
        >
          <h3>两件套（可多选）</h3>
          <section className="calculator-picker-group">
            <h4>两件套属性</h4>
            <div className="calculator-two-piece-attributes">
              {twoPieceGroups.map((group) => {
                const selected = selectedTwoPieceAttributes.has(group.label);
                return (
                  <button
                    type="button"
                    key={group.label}
                    className={selected ? "is-selected" : ""}
                    disabled={running || (!selected && selectedRelicSlots >= 6)}
                    onClick={() => toggleTwoPieceAttribute(group.label)}
                  >
                    <strong>{group.label}</strong>
                  </button>
                );
              })}
            </div>
          </section>
          {omaSuits.length > 0 && (
            <section className="calculator-picker-group">
              <h4>逢魔御魂</h4>
              <div className="calculator-relic-picker">
                {omaSuits.map((suit) => {
                  const selected = selectedOmaTwoPieces.has(suit.name);
                  return (
                    <button
                      type="button"
                      key={suit.id}
                      className={`calculator-suit-card${
                        selected ? " is-selected" : ""
                      }`}
                      disabled={
                        running || (!selected && selectedRelicSlots >= 6)
                      }
                      onClick={() => toggleOmaTwoPiece(suit.name)}
                    >
                      <img
                        className="calculator-suit-icon"
                        src={assetUrl(`suits/${suit.id}.png`)}
                        alt=""
                      />
                      <strong>{suit.name}</strong>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </section>
      </div>
    </Modal>
  );
}
