import {
  CalculatorOutlined,
  ClearOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Button, Card, InputNumber, Tooltip } from "antd";
import { useState } from "react";
import type { PanelConstraintKey } from "@/lib/calculator/types";
import { CalculatorRangeField } from "../CalculatorRangeField";
import type { CalculatorConstraintsProps } from "@/types";
import styles from "./index.module.scss";

const calculationHelpContent = (
  <div style={{ maxWidth: 380 }}>
    <p style={{ margin: "0 0 6px" }}>
      算法会根据目标指标、主副属性和面板约束保留候选御魂，并使用束搜索与剪枝控制计算量，并非无上限穷举。
      <strong style={{ color: "#b7eb8f" }}>
        大部分常规搭配场景经过优化后，结果通常可靠。
      </strong>
    </p>
    <p style={{ margin: "0 0 6px" }}>
      <strong style={{ color: "#ffd591" }}>
        注意：候选裁剪和组合剪枝可能造成少量组合丢失，不能保证一定找到理论上的全局最优方案。
      </strong>
      御魂数量特别多、约束复杂或条件过窄时，出现偏差的可能越高。
    </p>
    <p style={{ margin: 0 }}>
      极速模式只返回一套当前搜索结果，适合快速参考。固定套装、两件套、主属性及面板上下限等条件过严时可能无结果，条件与实际需求不匹配时结果也会失真；额外属性和游戏内未纳入计算的效果请以实际面板复核。
    </p>
  </div>
);

/** 维护主属性、面板约束和计算操作。 */
export function CalculatorConstraints({
  state,
  options,
  actions,
  commands,
}: CalculatorConstraintsProps) {
  const {
    running,
    hero,
    metric,
    metricIsPanelField,
    mainAttributes,
    constraints,
    extraAttributes,
    extraAttributesOpen,
    fastMode,
    hasCompleteMainAttributeSelection,
    staticDataReady,
  } = state;
  const {
    mainAttributePresets,
    mainAttributeOptions,
    panelShortcuts,
    panelFields,
    extraAttributeFields,
    savedCalculatorConfigs,
  } = options;
  const {
    applyMainPreset: applyMainAttributePreset,
    toggleMainAttribute,
    applyPanelShortcut,
    updateConstraintRange,
    updateExtraAttribute,
    setExtraAttributesOpen,
    setFastMode,
  } = actions;
  const {
    openMainShortcut: openNewMainShortcut,
    openPanelShortcut: openNewShortcut,
    clearPanelConstraints,
    clearExtraAttributes,
    openConfigLibrary: onOpenConfigLibrary,
    openSaveConfig: openNewCalculatorConfig,
    run,
  } = commands;
  const [suppressedPanelShortcut, setSuppressedPanelShortcut] =
    useState<string>();
  const setCalculatorConfigLibraryOpen = (open: boolean) => {
    if (open) onOpenConfigLibrary();
  };
  return (
    <div className={styles.scope}>
      <Card className="calculator-constraints" title="面板">
        <section className="calculator-main-attributes">
          <div className="calculator-section-label">2 / 4 / 6 号位主属性</div>
          <div className="calculator-main-attribute-presets">
            {mainAttributePresets.map((preset) => {
              const active =
                !preset.icon &&
                ([2, 4, 6] as const).every((position) => {
                  const selected = mainAttributes[position] || [];
                  const expected = preset.mainAttributes?.[position] || [];
                  return (
                    selected.length === expected.length &&
                    expected.every((attribute) => selected.includes(attribute))
                  );
                });
              return (
                <Button
                  aria-label={preset.label}
                  className={
                    `${
                      preset.icon
                        ? `is-icon-only${preset.icon === "clear" ? " calculator-clear-button" : ""}`
                        : ""
                    }${active ? " is-active" : ""}` || undefined
                  }
                  icon={preset.icon === "clear" ? <ClearOutlined /> : undefined}
                  key={preset.label}
                  size="small"
                  title={preset.label}
                  disabled={running}
                  onClick={(event) => {
                    applyMainAttributePreset(preset);
                    event.currentTarget.blur();
                  }}
                >
                  {preset.icon ? null : preset.label}
                </Button>
              );
            })}
            <Button
              aria-label="管理自定义主属性快捷条件"
              className="calculator-shortcut-manage-button"
              disabled={running}
              icon={<PlusOutlined />}
              size="small"
              title="管理自定义主属性快捷条件"
              onClick={openNewMainShortcut}
            />
          </div>
          <div className="calculator-main-attribute-grid">
            {([2, 4, 6] as const).map((position) => (
              <div className="calculator-main-attribute-group" key={position}>
                <span>{position}号位</span>
                <div>
                  {mainAttributeOptions[position].map((value) => (
                    <button
                      className={
                        mainAttributes[position]?.includes(value)
                          ? "is-selected"
                          : ""
                      }
                      key={value}
                      type="button"
                      disabled={running}
                      onClick={() => toggleMainAttribute(position, value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="calculator-panel-ranges">
          <div className="calculator-section-label">最终面板范围</div>
          <div className="calculator-section-tip">
            觉醒的属性加成请自行填进额外属性
          </div>
          <div className="calculator-constraint-shortcuts">
            {panelShortcuts.map((shortcut) => {
              const entries = Object.entries(shortcut.values) as [
                PanelConstraintKey,
                { min?: number; max?: number },
              ][];
              const active = entries.every(([key, range]) => {
                const current = constraints[key];
                return (
                  (range.min === undefined || current?.min === range.min) &&
                  (range.max === undefined || current?.max === range.max)
                );
              });
              const disabledByMetric = entries.some(
                ([key]) => metricIsPanelField && key === metric,
              );
              return (
                <Button
                  key={shortcut.label}
                  size="small"
                  className={
                    active
                      ? "is-active"
                      : suppressedPanelShortcut === shortcut.label
                        ? "is-suppressed"
                        : undefined
                  }
                  disabled={running || disabledByMetric}
                  onMouseLeave={() => {
                    if (suppressedPanelShortcut === shortcut.label) {
                      setSuppressedPanelShortcut(undefined);
                    }
                  }}
                  onClick={(event) => {
                    setSuppressedPanelShortcut(
                      active ? shortcut.label : undefined,
                    );
                    applyPanelShortcut(shortcut.values);
                    event.currentTarget.blur();
                  }}
                >
                  {shortcut.label}
                </Button>
              );
            })}
            <Button
              aria-label="清空最终面板范围"
              icon={<ClearOutlined />}
              title="清空最终面板范围"
              size="small"
              className="calculator-clear-button"
              disabled={running}
              onClick={clearPanelConstraints}
            />
            <Button
              aria-label="管理自定义快捷条件"
              className="calculator-shortcut-manage-button"
              disabled={running}
              icon={<PlusOutlined />}
              size="small"
              title="管理自定义快捷条件"
              onClick={openNewShortcut}
            />
          </div>
          <div className="calculator-constraint-grid">
            {panelFields.map(({ key, label, suffix }) => (
              <CalculatorRangeField
                key={key}
                field={key}
                label={label}
                suffix={suffix}
                minimum={hero?.baseStats[key] || 0}
                range={constraints[key]}
                disabled={running || (metricIsPanelField && key === metric)}
                onChange={(range) => updateConstraintRange(key, range)}
              />
            ))}
          </div>
          <section className="calculator-extra-attributes">
            <div className="calculator-extra-attributes-head">
              <div>
                <div className="calculator-section-label">额外属性</div>
                <small>与御魂属性共同计入最终面板，数值不能低于 0</small>
              </div>
              <Button
                size="small"
                type={extraAttributesOpen ? "primary" : "default"}
                disabled={running}
                onClick={() => setExtraAttributesOpen((current) => !current)}
              >
                {extraAttributesOpen ? "收起" : "设置"}
              </Button>
            </div>
            {extraAttributesOpen && (
              <div className="calculator-extra-attribute-grid">
                {extraAttributeFields.map(({ key, label, suffix }) => (
                  <label className="calculator-extra-attribute-field" key={key}>
                    <span>{`${label}${suffix || ""}`}</span>
                    <InputNumber
                      min={0}
                      step={0.01}
                      value={extraAttributes[key]}
                      placeholder="0"
                      disabled={running}
                      onChange={(value) => updateExtraAttribute(key, value)}
                    />
                  </label>
                ))}
                <Button
                  className="calculator-clear-button"
                  aria-label="清空副本额外属性"
                  title="清空副本额外属性"
                  icon={<ClearOutlined />}
                  size="small"
                  disabled={
                    running ||
                    !Object.values(extraAttributes).some((value) => value !== 0)
                  }
                  onClick={clearExtraAttributes}
                />
              </div>
            )}
          </section>
        </section>
      </Card>
      <div className="calculator-run-action">
        <div className="calculator-saved-config-actions">
          <Button
            icon={<CalculatorOutlined />}
            disabled={
              running || !staticDataReady || savedCalculatorConfigs.length === 0
            }
            onClick={() => setCalculatorConfigLibraryOpen(true)}
          >
            已保存配置
            {savedCalculatorConfigs.length
              ? ` (${savedCalculatorConfigs.length})`
              : ""}
          </Button>
          <Button
            icon={<SaveOutlined />}
            disabled={running || !staticDataReady}
            onClick={openNewCalculatorConfig}
          >
            保存配置
          </Button>
        </div>
        <div className="calculator-run-controls">
          <Tooltip
            title={calculationHelpContent}
            trigger={["hover", "click"]}
            placement="topRight"
            overlayInnerStyle={{ maxWidth: 420 }}
          >
            <button
              type="button"
              className="calculator-calculation-help"
              aria-label="查看计算说明"
            >
              <QuestionCircleOutlined />
            </button>
          </Tooltip>
          <div className="calculator-run-buttons">
            <Button
              className={`calculator-fast-mode${fastMode ? " is-active" : ""}`}
              type="default"
              aria-pressed={fastMode}
              disabled={running}
              icon={<ThunderboltOutlined />}
              onClick={() => setFastMode(!fastMode)}
            >
              极速模式
            </Button>
            <Button
              className="calculator-start-button"
              type="primary"
              icon={<CalculatorOutlined />}
              loading={running}
              disabled={running || !hasCompleteMainAttributeSelection}
              onClick={run}
            >
              {fastMode ? "极速计算" : "开始计算"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
