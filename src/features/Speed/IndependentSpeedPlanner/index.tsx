"use client";

import {
  DeleteOutlined,
  DownOutlined,
  CloseOutlined,
  PlusOutlined,
  SaveOutlined,
  UpOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Select,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import type { RelicDataset, SpeedSuitOption } from "@/types";
import {
  calculateIndependentSpeed,
  independentSpeedPresetStorageKey,
  parseIndependentSpeedPresets,
} from "@/lib/independentSpeed";
import type {
  IndependentSpeedConfig,
  IndependentSpeedPreset,
} from "@/lib/independentSpeed";
import { PvpSuitPickerModal } from "../PvpSuitPickerModal";
import styles from "./index.module.scss";

type MainAttributeOption = { label: string; value: string };

type IndependentSpeedPlannerProps = {
  dataset: RelicDataset;
  suitOptions: SpeedSuitOption[];
  fourthMainAttributeOptions: MainAttributeOption[];
  sixthMainAttributeOptions: MainAttributeOption[];
};

function createConfig(): IndependentSpeedConfig {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    fourthMainAttributes: [],
    sixthMainAttributes: [],
  };
}

function cloneConfig(config: IndependentSpeedConfig) {
  return {
    ...config,
    fourthMainAttributes: [...config.fourthMainAttributes],
    sixthMainAttributes: [...config.sixthMainAttributes],
  };
}

export function IndependentSpeedPlanner({
  dataset,
  suitOptions,
  fourthMainAttributeOptions,
  sixthMainAttributeOptions,
}: IndependentSpeedPlannerProps) {
  const [messageApi, contextHolder] = message.useMessage();
  const [configs, setConfigs] = useState<IndependentSpeedConfig[]>([
    createConfig(),
  ]);
  const [presets, setPresets] = useState<IndependentSpeedPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>();
  const [activeConfigId, setActiveConfigId] = useState<string>();
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const results = useMemo(
    () => calculateIndependentSpeed(dataset, configs),
    [dataset, configs],
  );
  const selectedPreset = presets.find(({ id }) => id === selectedPresetId);
  const activeConfig = configs.find(({ id }) => id === activeConfigId);
  const saveableConfigs = configs.filter((config) => config.suitName);

  useEffect(() => {
    try {
      setPresets(
        parseIndependentSpeedPresets(
          window.localStorage.getItem(independentSpeedPresetStorageKey),
        ),
      );
    } catch {
      messageApi.error("无法读取本地套件预设");
    }
  }, [messageApi]);

  const persistPresets = (nextPresets: IndependentSpeedPreset[]) => {
    try {
      window.localStorage.setItem(
        independentSpeedPresetStorageKey,
        JSON.stringify(nextPresets),
      );
      setPresets(nextPresets);
      return true;
    } catch {
      messageApi.error("预设保存失败，请检查浏览器本地存储空间");
      return false;
    }
  };

  const updateConfig = (
    id: string,
    update: Partial<IndependentSpeedConfig>,
  ) => {
    setConfigs((current) =>
      current.map((config) =>
        config.id === id ? { ...config, ...update } : config,
      ),
    );
  };

  const moveConfig = (index: number, offset: -1 | 1) => {
    setConfigs((current) => {
      const destination = index + offset;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name || !saveableConfigs.length) return;
    const preset: IndependentSpeedPreset = {
      id: createConfig().id,
      name,
      configs: saveableConfigs.map(cloneConfig),
    };
    if (!persistPresets([...presets, preset])) return;
    setSelectedPresetId(preset.id);
    setPresetName("");
    setSaveModalOpen(false);
    messageApi.success("独立套件预设已保存");
  };

  const applyPreset = () => {
    if (!selectedPreset) return;
    setConfigs(selectedPreset.configs.map(cloneConfig));
    messageApi.success("独立套件预设已应用");
  };

  const deletePreset = () => {
    if (!selectedPreset) return;
    const nextPresets = presets.filter(({ id }) => id !== selectedPreset.id);
    if (!persistPresets(nextPresets)) return;
    setSelectedPresetId(undefined);
    messageApi.success("独立套件预设已删除");
  };

  return (
    <Card
      className={`${styles.panel} speed-independent-panel`}
      title="独立套件速度"
    >
      {contextHolder}
      <div className={styles.toolbar}>
        <Select
          className={styles.presetSelect}
          allowClear
          placeholder="选择已保存的套件预设"
          value={selectedPresetId}
          options={presets.map(({ id, name }) => ({ value: id, label: name }))}
          onChange={setSelectedPresetId}
        />
        <Button
          icon={<SaveOutlined />}
          disabled={!saveableConfigs.length}
          onClick={() => setSaveModalOpen(true)}
        >
          保存预设
        </Button>
        <Button type="primary" disabled={!selectedPreset} onClick={applyPreset}>
          使用预设
        </Button>
        <Popconfirm
          title="删除这个套件预设？"
          okText="删除"
          cancelText="取消"
          onConfirm={deletePreset}
        >
          <Button danger icon={<DeleteOutlined />} disabled={!selectedPreset}>
            删除预设
          </Button>
        </Popconfirm>
      </div>

      <p className={styles.description}>
        按优先级从左到右从上往下分配御魂，每件只使用一次；未选四件套时按散件计算，4/6号位可限制主属性。
      </p>

      <section className={styles.overview} aria-label="独立套件速度概览">
        <strong className={styles.overviewTitle}>速度概览</strong>
        {configs.length ? (
          <ol className={styles.overviewList}>
            {configs.map((config, index) => {
              const combination = results[index]?.combination;
              return (
                <li className={styles.overviewItem} key={config.id}>
                  <span>第 {index + 1} 套</span>
                  <span className={styles.overviewSuit}>
                    {config.suitName || "散件"}
                  </span>
                  <strong>
                    {combination
                      ? (combination.value + 57).toFixed(2)
                      : "未匹配"}
                  </strong>
                </li>
              );
            })}
          </ol>
        ) : (
          <span className={styles.overviewEmpty}>添加套件后显示估算速度</span>
        )}
      </section>

      {!configs.length && <Empty description="添加一套独立套件开始计算" />}
      <div className={styles.configs}>
        {configs.map((config, index) => {
          const combination = results[index]?.combination;
          return (
            <div className={styles.config} key={config.id}>
              <div className={styles.configHeading}>
                <strong>优先级 {index + 1}</strong>
                <div className={styles.configActions}>
                  <Button
                    aria-label={`套件 ${index + 1} 上移`}
                    icon={<UpOutlined />}
                    size="small"
                    type="text"
                    disabled={index === 0}
                    onClick={() => moveConfig(index, -1)}
                  />
                  <Button
                    aria-label={`套件 ${index + 1} 下移`}
                    icon={<DownOutlined />}
                    size="small"
                    type="text"
                    disabled={index === configs.length - 1}
                    onClick={() => moveConfig(index, 1)}
                  />
                  <Button
                    aria-label={`删除套件 ${index + 1}`}
                    icon={<DeleteOutlined />}
                    size="small"
                    type="text"
                    danger
                    onClick={() =>
                      setConfigs((current) =>
                        current.filter((item) => item.id !== config.id),
                      )
                    }
                  />
                </div>
              </div>
              <div className={styles.selects}>
                <div className={styles.suitPicker}>
                  <Button
                    className={styles.suitPickerButton}
                    size="small"
                    onClick={() => setActiveConfigId(config.id)}
                  >
                    {config.suitName || "选择四件套御魂"}
                  </Button>
                  {config.suitName && (
                    <Button
                      aria-label={`清除套件 ${index + 1} 的御魂选择`}
                      icon={<CloseOutlined />}
                      size="small"
                      onClick={() =>
                        updateConfig(config.id, { suitName: undefined })
                      }
                    />
                  )}
                </div>
                <Select
                  allowClear
                  mode="multiple"
                  maxTagCount="responsive"
                  placeholder="4号位主属性（不限）"
                  size="small"
                  options={fourthMainAttributeOptions}
                  value={config.fourthMainAttributes}
                  onChange={(fourthMainAttributes) =>
                    updateConfig(config.id, { fourthMainAttributes })
                  }
                />
                <Select
                  allowClear
                  mode="multiple"
                  maxTagCount="responsive"
                  placeholder="6号位主属性（不限）"
                  size="small"
                  options={sixthMainAttributeOptions}
                  value={config.sixthMainAttributes}
                  onChange={(sixthMainAttributes) =>
                    updateConfig(config.id, { sixthMainAttributes })
                  }
                />
              </div>
              <div className={styles.result} aria-live="polite">
                <div className={styles.resultHeading}>
                  <span>{config.suitName ? "套件一速" : "散件一速"}</span>
                  <strong className={styles.speed}>
                    {combination ? (combination.value + 57).toFixed(2) : "—"}
                  </strong>
                </div>
                {combination ? (
                  <div className={styles.relicDetails}>
                    {combination.relics.map((relic) => {
                      const isTargetSuit =
                        Boolean(config.suitName) &&
                        relic.suitName === config.suitName;
                      return (
                        <div
                          className={`${styles.relicDetail} ${isTargetSuit ? styles.targetSuit : ""}`}
                          key={relic.relicId || String(relic.position)}
                        >
                          <span className={styles.position}>
                            {relic.position}号位
                          </span>
                          <strong className={styles.relicSpeed}>
                            {relic.value.toFixed(2)}
                          </strong>
                          <span className={styles.relicLabel}>
                            {[relic.mainAttribute, relic.suitName]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <span className={styles.emptyResult}>
                    {config.suitName
                      ? "剩余御魂无法组成符合条件的套件"
                      : "没有符合条件的散件组合"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <Button
          block
          type="dashed"
          className={styles.addConfig}
          icon={<PlusOutlined />}
          onClick={() => setConfigs((current) => [...current, createConfig()])}
        >
          新增独立套件
        </Button>
      </div>

      <PvpSuitPickerModal
        open={Boolean(activeConfigId)}
        options={suitOptions}
        selectedSuitNames={
          activeConfig?.suitName ? [activeConfig.suitName] : []
        }
        resetDisabled={!activeConfig?.suitName}
        onToggleSuit={(suitName) => {
          if (!activeConfigId) return;
          updateConfig(activeConfigId, {
            suitName:
              activeConfig?.suitName === suitName ? undefined : suitName,
          });
          setActiveConfigId(undefined);
        }}
        onReset={() => {
          if (!activeConfigId) return;
          updateConfig(activeConfigId, { suitName: undefined });
          setActiveConfigId(undefined);
        }}
        onClose={() => setActiveConfigId(undefined)}
      />

      <Modal
        title="保存独立套件预设"
        open={saveModalOpen}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ disabled: !presetName.trim() }}
        onCancel={() => setSaveModalOpen(false)}
        onOk={savePreset}
      >
        <Input
          autoFocus
          maxLength={40}
          placeholder="请输入预设名称"
          value={presetName}
          onChange={(event) => setPresetName(event.target.value)}
          onPressEnter={savePreset}
        />
      </Modal>
    </Card>
  );
}
