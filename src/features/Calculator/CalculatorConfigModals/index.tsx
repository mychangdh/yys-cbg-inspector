import styles from "./index.module.scss";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { Button, Input, Modal } from "antd";
import { CalculatorRangeField } from "../CalculatorRangeField";
import type { CalculatorConfigModalsProps } from "@/types";

/** 管理已保存配置和自定义快捷条件。 */
export function CalculatorConfigModals({
  config,
  mainShortcut,
  panelShortcut,
}: CalculatorConfigModalsProps) {
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
  return (
    <>
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
