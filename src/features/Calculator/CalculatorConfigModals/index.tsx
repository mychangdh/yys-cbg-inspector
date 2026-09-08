import styles from "./index.module.scss";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { Button, Grid, Input, Modal, Select } from "antd";
import { useMemo, useState } from "react";
import { CalculatorRangeField } from "../CalculatorRangeField";
import { RelicList } from "@/components/RelicList";
import type { CalculatorConfigModalsProps } from "@/types";

/** 管理已保存配置和自定义快捷条件。 */
export function CalculatorConfigModals({
  config,
  relic,
  excluded,
  mainShortcut,
  panelShortcut,
}: CalculatorConfigModalsProps) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const {
    saveOpen: saveRelicConfigModalOpen,
    libraryOpen: relicConfigLibraryOpen,
    label: relicConfigLabel,
    pendingResult: pendingRelicResult,
    savedRelics,
    save: saveRelicConfig,
    setSaveOpen: setRelicConfigSaveOpen,
    setLibraryOpen: setRelicConfigLibraryOpen,
    setLabel: setRelicConfigLabel,
    removeGroup: removeSavedRelicGroup,
  } = relic;
  const {
    saveOpen: saveCalculatorConfigModalOpen,
    libraryOpen: calculatorConfigLibraryOpen,
    label: calculatorConfigLabel,
    savedConfigs: savedCalculatorConfigs,
    getPreview: getSavedConfigPreview,
    apply: applySavedCalculatorConfig,
    remove: deleteCalculatorConfig,
    save: saveCalculatorConfig,
    setSaveOpen: setSaveCalculatorConfigModalOpen,
    setLibraryOpen: setCalculatorConfigLibraryOpen,
    setLabel: setCalculatorConfigLabel,
  } = config;
  const {
    open: mainShortcutModalOpen,
    editingId: editingMainShortcutId,
    label: mainShortcutLabel,
    attributes: mainShortcutAttributes,
    options: mainAttributeOptions,
    shortcuts: customMainShortcuts,
    setOpen: setMainShortcutModalOpen,
    setLabel: setMainShortcutLabel,
    toggleAttribute: toggleMainShortcutAttribute,
    save: saveMainShortcut,
    edit: openMainShortcutEditor,
    remove: deleteMainShortcut,
  } = mainShortcut;
  const {
    open: shortcutModalOpen,
    editingId: editingShortcutId,
    label: shortcutLabel,
    values: shortcutValues,
    baseStats: shortcutBaseStats,
    fields: panelFields,
    shortcuts: customPanelShortcuts,
    setOpen: setShortcutModalOpen,
    setLabel: setShortcutLabel,
    setValues: setShortcutValues,
    save: saveShortcut,
    edit: openShortcutEditor,
    remove: deleteShortcut,
  } = panelShortcut;
  const overwritingCalculatorConfig = savedCalculatorConfigs.some(
    (config) => config.label === calculatorConfigLabel.trim(),
  );
  const savedRelicGroups = useMemo(() => {
    const groups = new Map<string, typeof savedRelics>();
    savedRelics.forEach((relic) => {
      const sources = relic.savedSources?.length
        ? relic.savedSources
        : [relic.savedSource || relic.suit?.name || "未知来源"];
      sources.forEach((source) => {
        groups.set(source, [...(groups.get(source) || []), relic]);
      });
    });
    return [...groups.entries()];
  }, [savedRelics]);
  const [selectedSavedRelicSource, setSelectedSavedRelicSource] = useState<
    string | undefined
  >();
  const selectedSavedRelicGroup = savedRelicGroups.find(
    ([source]) => source === selectedSavedRelicSource,
  );
  const closeSavedRelicLibrary = () => {
    setSelectedSavedRelicSource(undefined);
    setRelicConfigLibraryOpen(false);
  };
  return (
    <>
      <Modal
        open={excluded.open}
        rootClassName={styles.scope}
        className="calculator-excluded-relic-modal"
        title="排除御魂"
        width={680}
        destroyOnHidden
        onCancel={excluded.onClose}
        footer={[
          <Button key="clear" danger onClick={excluded.onClear}>
            清空已选
          </Button>,
          <Button key="cancel" onClick={excluded.onClose}>
            取消
          </Button>,
          <Button key="apply" type="primary" onClick={excluded.onApply}>
            应用排除
          </Button>,
        ]}
      >
        <div className="calculator-excluded-relic-picker">
          <div className="calculator-excluded-relic-picker-intro">
            <strong>选择要排除的已保存御魂方案</strong>
            <span>
              已选择 {excluded.selectedSources.length} 个方案，计算时不会使用这些方案中的御魂
            </span>
          </div>
          <Select
            mode="multiple"
            showSearch
            allowClear
            value={excluded.selectedSources}
            maxTagCount="responsive"
            optionFilterProp="label"
            placeholder="选择要排除的已保存御魂方案"
            options={savedRelicGroups.map(([source, group]) => ({
              value: source,
              label: `${source} · ${group.length} 件御魂`,
            }))}
            onChange={(values) => excluded.onChange(values as string[])}
          />
        </div>
      </Modal>
      <Modal
        open={saveRelicConfigModalOpen}
        rootClassName={styles.scope}
        className="calculator-saved-config-modal"
        title="保存御魂"
        width={460}
        destroyOnHidden
        onCancel={() => setRelicConfigSaveOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setRelicConfigSaveOpen(false)}>
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            disabled={!relicConfigLabel.trim() || !pendingRelicResult}
            onClick={saveRelicConfig}
          >
            保存
          </Button>,
        ]}
      >
        <div className="calculator-saved-config-editor">
          <label htmlFor="calculator-saved-relic-name">名称</label>
          <Input
            id="calculator-saved-relic-name"
            value={relicConfigLabel}
            maxLength={24}
            placeholder="例如：须佐之男·满暴高速"
            onChange={(event) => setRelicConfigLabel(event.target.value)}
            onPressEnter={saveRelicConfig}
          />
          {pendingRelicResult && (
            <small>{pendingRelicResult.relics.length} 件御魂 · 保存后按名称分组</small>
          )}
        </div>
      </Modal>
      <Modal
        open={relicConfigLibraryOpen}
        rootClassName={`${styles.scope}${isMobile ? ` ${styles.mobile}` : ""}`}
        className="calculator-config-library-modal"
        title="已保存御魂"
        width={960}
        destroyOnHidden
        onCancel={closeSavedRelicLibrary}
        footer={
          <Button
            type="primary"
            onClick={
              selectedSavedRelicGroup
                ? () => setSelectedSavedRelicSource(undefined)
                : closeSavedRelicLibrary
            }
          >
            {selectedSavedRelicGroup ? "返回" : "关闭"}
          </Button>
        }
      >
        <div className="calculator-config-library-list">
          {savedRelicGroups.length ? (
            selectedSavedRelicGroup ? (
              <div
                className={`calculator-saved-relic-detail${isMobile ? " is-mobile" : ""}`}
              >
                <div className="calculator-saved-relic-detail-head">
                  <strong>{selectedSavedRelicGroup[0]}</strong>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={`删除 ${selectedSavedRelicGroup[0]} 组御魂`}
                    title={`删除 ${selectedSavedRelicGroup[0]} 组御魂`}
                    onClick={() => {
                      removeSavedRelicGroup(selectedSavedRelicGroup[0]);
                      setSelectedSavedRelicSource(undefined);
                    }}
                  />
                </div>
                <RelicList
                  items={selectedSavedRelicGroup[1]}
                  highlightedSubAttributes={[]}
                  desktopColumns={3}
                  disablePagination
                  hideVisual={isMobile}
                  itemBadge={
                    isMobile
                      ? (item) =>
                          item.position === undefined ? undefined : `${item.position}号位`
                      : undefined
                  }
                />
              </div>
            ) : (
              <div className="calculator-saved-relic-groups">
                {savedRelicGroups.map(([source]) => (
                  <div className="calculator-saved-relic-group-row" key={source}>
                    <button
                      type="button"
                      onClick={() => setSelectedSavedRelicSource(source)}
                    >
                      {source}
                    </button>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label={`删除 ${source} 组御魂`}
                      title={`删除 ${source} 组御魂`}
                      onClick={() => removeSavedRelicGroup(source)}
                    />
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="calculator-config-library-empty">暂无保存的御魂</div>
          )}
        </div>
      </Modal>
      <Modal
        open={saveCalculatorConfigModalOpen}
        rootClassName={`${styles.scope} calculator-page-modal`}
        className="calculator-saved-config-modal"
        title="保存当前快捷配置"
        width={460}
        forceRender
        transitionName=""
        maskTransitionName=""
        onCancel={() => setSaveCalculatorConfigModalOpen(false)}
        footer={[
          <Button
            key="cancel"
            onClick={() => setSaveCalculatorConfigModalOpen(false)}
          >
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            disabled={!calculatorConfigLabel.trim()}
            onClick={saveCalculatorConfig}
          >
            {overwritingCalculatorConfig ? "覆盖保存" : "保存"}
          </Button>,
        ]}
      >
        <div className="calculator-saved-config-editor">
          <label htmlFor="calculator-saved-config-name">配置名称</label>
          <Input
            id="calculator-saved-config-name"
            value={calculatorConfigLabel}
            maxLength={16}
            placeholder="例如：满爆超星"
            onChange={(event) => setCalculatorConfigLabel(event.target.value)}
            onPressEnter={saveCalculatorConfig}
          />
          {overwritingCalculatorConfig && (
            <small>同名配置将直接覆盖原有内容</small>
          )}
        </div>
      </Modal>
      <Modal
        open={calculatorConfigLibraryOpen}
        rootClassName={`${styles.scope} calculator-page-modal`}
        className="calculator-config-library-modal"
        title="已保存配置"
        width={680}
        forceRender
        transitionName=""
        maskTransitionName=""
        onCancel={() => setCalculatorConfigLibraryOpen(false)}
        footer={
          <Button
            type="primary"
            onClick={() => setCalculatorConfigLibraryOpen(false)}
          >
            关闭
          </Button>
        }
      >
        <div className="calculator-config-library-list">
          {savedCalculatorConfigs.map((config) => {
            const preview = getSavedConfigPreview(config);
            return (
              <article
                className="calculator-config-library-item"
                key={config.id}
              >
                <button
                  type="button"
                  onClick={() => {
                    applySavedCalculatorConfig(config);
                    setCalculatorConfigLibraryOpen(false);
                  }}
                >
                  <strong>{config.label}</strong>
                  <span>{`${preview.heroName} · ${preview.metric}`}</span>
                  <small>{preview.suitSummary}</small>
                  <small>{preview.mainAttributeSummary}</small>
                  {preview.constraintSummary && (
                    <em>{preview.constraintSummary}</em>
                  )}
                </button>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={`删除 ${config.label}`}
                  title="删除配置"
                  onClick={() => deleteCalculatorConfig(config.id)}
                />
              </article>
            );
          })}
        </div>
      </Modal>
      <Modal
        open={mainShortcutModalOpen}
        rootClassName={`${styles.scope} calculator-page-modal`}
        className="calculator-main-shortcut-modal"
        title={
          editingMainShortcutId ? "编辑主属性快捷条件" : "新增主属性快捷条件"
        }
        width={680}
        destroyOnHidden
        onCancel={() => setMainShortcutModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setMainShortcutModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            disabled={
              !mainShortcutLabel.trim() ||
              !([2, 4, 6] as const).every(
                (position) => mainShortcutAttributes[position]?.length,
              )
            }
            onClick={saveMainShortcut}
          >
            保存
          </Button>,
        ]}
      >
        <div className="calculator-main-shortcut-editor">
          <Input
            value={mainShortcutLabel}
            maxLength={12}
            placeholder="快捷条件名称"
            onChange={(event) => setMainShortcutLabel(event.target.value)}
          />
          <div className="calculator-main-shortcut-groups">
            {([2, 4, 6] as const).map((position) => (
              <section key={position}>
                <strong>{position} 号位</strong>
                <div>
                  {mainAttributeOptions[position].map((value) => (
                    <button
                      className={
                        mainShortcutAttributes[position]?.includes(value)
                          ? "is-selected"
                          : ""
                      }
                      key={value}
                      type="button"
                      onClick={() =>
                        toggleMainShortcutAttribute(position, value)
                      }
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          {customMainShortcuts.length > 0 && (
            <div className="calculator-shortcut-list">
              {customMainShortcuts.map((shortcut) => (
                <div key={shortcut.id}>
                  <span>{shortcut.label}</span>
                  <aside>
                    <Button
                      aria-label={`编辑 ${shortcut.label}`}
                      icon={<EditOutlined />}
                      size="small"
                      type="text"
                      onClick={() => openMainShortcutEditor(shortcut)}
                    />
                    <Button
                      aria-label={`删除 ${shortcut.label}`}
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      type="text"
                      onClick={() => deleteMainShortcut(shortcut.id)}
                    />
                  </aside>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
      <Modal
        open={shortcutModalOpen}
        rootClassName={`${styles.scope} calculator-page-modal`}
        className="calculator-shortcut-modal"
        title={editingShortcutId ? "编辑自定义快捷条件" : "新增自定义快捷条件"}
        width={620}
        destroyOnHidden
        onCancel={() => setShortcutModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setShortcutModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            disabled={
              !shortcutLabel.trim() ||
              !Object.values(shortcutValues).some(
                (value) =>
                  value &&
                  (Number.isFinite(value.min) || Number.isFinite(value.max)),
              )
            }
            onClick={saveShortcut}
          >
            保存
          </Button>,
        ]}
      >
        <div className="calculator-shortcut-editor">
          <Input
            value={shortcutLabel}
            maxLength={12}
            placeholder="快捷条件名称"
            onChange={(event) => setShortcutLabel(event.target.value)}
          />
          <div className="calculator-shortcut-value-grid">
            {panelFields.map(({ key, label, suffix }) => (
              <CalculatorRangeField
                key={key}
                field={key}
                label={label}
                suffix={suffix}
                minimum={shortcutBaseStats?.[key] || 0}
                range={shortcutValues[key]}
                emptyMinWhenUnset
                onChange={(range) =>
                  setShortcutValues((current) => ({
                    ...current,
                    [key]: range,
                  }))
                }
              />
            ))}
          </div>
          {customPanelShortcuts.length > 0 && (
            <div className="calculator-shortcut-list">
              {customPanelShortcuts.map((shortcut) => (
                <div key={shortcut.id}>
                  <span>{shortcut.label}</span>
                  <aside>
                    <Button
                      aria-label={`编辑 ${shortcut.label}`}
                      icon={<EditOutlined />}
                      size="small"
                      type="text"
                      onClick={() => openShortcutEditor(shortcut)}
                    />
                    <Button
                      aria-label={`删除 ${shortcut.label}`}
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      type="text"
                      onClick={() => deleteShortcut(shortcut.id)}
                    />
                  </aside>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
