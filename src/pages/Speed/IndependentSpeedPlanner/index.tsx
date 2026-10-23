import "./index.scss";
import {
  CloseOutlined,
  DeleteOutlined,
  DownOutlined,
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
import type { RelicDataset, RelicView } from "@/types";
import { assetUrl } from "@/lib/assetUrl";
import {
  calculateIndependentSpeed,
  independentSpeedPresetStorageKey,
  parseIndependentSpeedPresets,
} from "@/lib/independentSpeed";
import type {
  IndependentSpeedConfig,
  IndependentSpeedPreset,
} from "@/lib/independentSpeed";

type MainAttributeOption = { label: string; value: string };

type IndependentSpeedPlannerProps = {
  dataset: RelicDataset;
  suitOptions: NonNullable<RelicView["suit"]>[];
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
  const [suitSearch, setSuitSearch] = useState("");
  const results = useMemo(
    () => calculateIndependentSpeed(dataset, configs),
    [dataset, configs],
  );
  const selectedPreset = presets.find(({ id }) => id === selectedPresetId);
  const activeConfig = configs.find(({ id }) => id === activeConfigId);
  const saveableConfigs = configs.filter((config) => config.suitName);
  const matchingSuits = suitOptions.filter((suit) =>
    suit.name
      .toLocaleLowerCase()
      .includes(suitSearch.trim().toLocaleLowerCase()),
  );
  const selectedSuits = matchingSuits.filter(
    (suit) => activeConfig?.suitName === suit.name,
  );
  const availableSuits = matchingSuits.filter(
    (suit) => activeConfig?.suitName !== suit.name,
  );

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
      messageApi.error("预设保存失败，请检查本地存储空间");
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

  const toggleSuit = (suitName: string) => {
    if (!activeConfigId) return;
    updateConfig(activeConfigId, {
      suitName: activeConfig?.suitName === suitName ? undefined : suitName,
    });
    setActiveConfigId(undefined);
  };

  const suitGroups = [
    { title: "当前选择", options: selectedSuits },
    { title: "全部御魂", options: availableSuits },
  ].filter(({ options }) => options.length > 0);

  return (
    <Card className="speed-panel independent-speed-panel" title="独立套件速度">
      {contextHolder}
      <div className="independent-speed-toolbar">
        <Select
          className="independent-speed-preset-select"
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

      <p className="independent-speed-description">
        按优先级从左往右从上往下分配御魂，每件只使用一次；未选四件套时按散件计算，4/6号位可限制主属性。
      </p>

      <section
        className="independent-speed-overview"
        aria-label="独立套件速度概览"
      >
        <strong className="independent-speed-overview-title">速度概览</strong>
        {configs.length ? (
          <ol className="independent-speed-overview-list">
            {configs.map((config, index) => {
              const combination = results[index]?.combination;
              return (
                <li className="independent-speed-overview-item" key={config.id}>
                  <span>第 {index + 1} 套</span>
                  <span className="independent-speed-overview-suit">
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
          <span className="independent-speed-overview-empty">
            添加套件后显示估算速度
          </span>
        )}
      </section>

      {configs.length ? (
        <div className="independent-speed-configs">
          {configs.map((config, index) => {
            const combination = results[index]?.combination;
            return (
              <div className="independent-speed-config" key={config.id}>
                <div className="independent-speed-config-heading">
                  <strong>优先级 {index + 1}</strong>
                  <div className="independent-speed-config-actions">
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
                <div className="independent-speed-selects">
                  <div className="independent-speed-suit-picker">
                    <Button
                      className="independent-speed-suit-picker-button"
                      size="small"
                      onClick={() => {
                        setSuitSearch("");
                        setActiveConfigId(config.id);
                      }}
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
                <div className="independent-speed-result" aria-live="polite">
                  <div className="independent-speed-result-heading">
                    <span>{config.suitName ? "套件一速" : "散件一速"}</span>
                    <strong className="independent-speed-value">
                      {combination ? (combination.value + 57).toFixed(2) : "—"}
                    </strong>
                  </div>
                  {combination ? (
                    <div className="independent-speed-relic-details">
                      {combination.relics.map((relic) => {
                        const isTargetSuit =
                          Boolean(config.suitName) &&
                          relic.suitName === config.suitName;
                        return (
                          <div
                            className={`independent-speed-relic-detail${isTargetSuit ? " is-target-suit" : ""}`}
                            key={relic.relicId || String(relic.position)}
                          >
                            <span>{relic.position}号位</span>
                            <strong>{relic.value.toFixed(2)}</strong>
                            <span className="independent-speed-relic-label">
                              {[relic.mainAttribute, relic.suitName]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="independent-speed-empty-result">
                      {config.suitName
                        ? "剩余御魂无法组成符合条件的套件"
                        : "没有符合条件的散件组合"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty description="添加一套独立套件开始计算" />
      )}

      <Button
        block
        icon={<PlusOutlined />}
        onClick={() => setConfigs((current) => [...current, createConfig()])}
      >
        新增独立套件
      </Button>

      <Modal
        className="independent-speed-suit-modal"
        footer={
          <div className="independent-speed-suit-modal-footer">
            <Button
              aria-label="清除当前套装筛选"
              disabled={!activeConfig?.suitName}
              type="text"
              onClick={() => {
                if (!activeConfigId) return;
                updateConfig(activeConfigId, { suitName: undefined });
                setActiveConfigId(undefined);
              }}
            >
              重置
            </Button>
          </div>
        }
        open={Boolean(activeConfigId)}
        rootClassName="speed-page-modal"
        title="选择四件套御魂"
        width={760}
        onCancel={() => setActiveConfigId(undefined)}
      >
        <Input
          allowClear
          autoFocus
          aria-label="搜索御魂"
          placeholder="搜索御魂名称"
          value={suitSearch}
          onChange={(event) => setSuitSearch(event.target.value)}
        />
        {suitGroups.length ? (
          suitGroups.map(({ title, options }) => (
            <section className="independent-speed-suit-group" key={title}>
              <h3>{title}</h3>
              <div className="speed-pvp-suit-picker" aria-label={title}>
                {options.map((suit) => {
                  const selected = activeConfig?.suitName === suit.name;
                  return (
                    <button
                      aria-pressed={selected}
                      className={selected ? "is-selected" : ""}
                      key={suit.id}
                      type="button"
                      onClick={() => toggleSuit(suit.name)}
                    >
                      <img alt="" src={assetUrl(`suits/${suit.id}.png`)} />
                      <span>{suit.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <Empty description="没有匹配的御魂" />
        )}
      </Modal>

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
