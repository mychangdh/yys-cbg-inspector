import {
  DeleteOutlined,
  EditOutlined,
  MinusOutlined,
  PlusOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  UpOutlined,
  DownOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Empty,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { HeroPortrait } from "../Calculator/CalculatorHeroPicker/HeroPortrait";
import {
  calculatorMainAttributePresets,
  calculatorPanelShortcuts,
} from "@/config/calculatorPresets";
import {
  defaultExtraAttributes,
  loadCustomMainAttributeShortcuts,
  loadCustomPanelShortcuts,
  loadSavedCalculatorConfigs,
  mainAttributeOptions,
  panelFields,
  rarityLabels,
  type CbgYuhunConfig,
  type HeroRecord,
} from "../Calculator/calculatorShared";
import { loadHeroPanels, loadRelicSuits } from "@/lib/staticApi";
import { useAppSelector } from "@/store";
import type { CalculatorNumericRange } from "@/types/calculator";
import type {
  TeamCalculationResult,
  TeamMemberConfig,
  TeamMemberDraft,
  TeamObjectiveDirection,
} from "@/types/team";
import type { PanelConstraintKey } from "@/lib/calculator/types";
import "./index.scss";

type HeroStaticPayload = { heroesById?: Record<string, HeroRecord> };

type TeamDraft = Omit<TeamMemberDraft, "heroId"> & { heroId?: number };

const emptyDraft = (): TeamDraft => ({
  targetAttribute: "speed",
  targetDirection: "max",
  constraints: {},
  mainAttributes: {},
  extraAttributes: { ...defaultExtraAttributes },
  requiredTwoPieceAttributes: [],
  requiredTwoPieceNames: [],
});

function formatValue(value: number, attribute: PanelConstraintKey) {
  const digits = ["attack", "health", "defense"].includes(attribute) ? 0 : 2;
  return value.toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

function rangeText(range?: CalculatorNumericRange) {
  if (!range?.min && range?.max === undefined) return "不限";
  if (range?.min !== undefined && range.max !== undefined)
    return `${range.min}～${range.max}`;
  if (range?.min !== undefined) return `≥ ${range.min}`;
  return `≤ ${range?.max}`;
}

function cloneConfig(config: TeamMemberConfig): TeamMemberConfig {
  return {
    ...config,
    constraints: Object.fromEntries(
      Object.entries(config.constraints).map(([key, range]) => [
        key,
        { ...range },
      ]),
    ) as TeamMemberConfig["constraints"],
    mainAttributes: Object.fromEntries(
      Object.entries(config.mainAttributes).map(([key, values]) => [
        key,
        [...(values || [])],
      ]),
    ) as TeamMemberConfig["mainAttributes"],
    extraAttributes: { ...config.extraAttributes },
    requiredTwoPieceAttributes: [...config.requiredTwoPieceAttributes],
    requiredTwoPieceNames: [...config.requiredTwoPieceNames],
  };
}

function cloneMainAttributes(values: Partial<Record<2 | 4 | 6, string[]>>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, attributes]) => [
      key,
      [...(attributes || [])],
    ]),
  ) as Partial<Record<2 | 4 | 6, string[]>>;
}

function compactRelic(relic: import("@/types").RelicView) {
  return {
    id: relic.id,
    level: relic.level,
    quality: relic.quality,
    position: relic.position,
    suit: relic.suit ? { id: relic.suit.id, name: relic.suit.name } : undefined,
    mainAttribute: relic.mainAttribute ? { ...relic.mainAttribute } : null,
    subAttributes: relic.subAttributes?.map((attribute) => ({ ...attribute })),
    setBonusAttribute: relic.setBonusAttribute
      ? { ...relic.setBonusAttribute }
      : null,
    enhancement: relic.enhancement?.totals
      ? {
          totals: relic.enhancement.totals.map((attribute) => ({
            ...attribute,
            values: [],
          })),
        }
      : undefined,
  };
}

export function TeamCalculatorPage() {
  const dataset = useAppSelector((state) => state.app.dataset);
  const [messageApi, contextHolder] = message.useMessage();
  const [heroCatalog, setHeroCatalog] = useState<HeroRecord[]>([]);
  const [suitTwoPieceAttributes, setSuitTwoPieceAttributes] = useState<
    Record<string, string>
  >({});
  const [staticLoading, setStaticLoading] = useState(true);
  const [members, setMembers] = useState<TeamMemberConfig[]>([]);
  const [draft, setDraft] = useState<TeamDraft>();
  const [editingId, setEditingId] = useState<string>();
  const [running, setRunning] = useState(false);
  const [progressText, setProgressText] = useState("等待计算");
  const [progressPercent, setProgressPercent] = useState(0);
  const [calculationResult, setCalculationResult] =
    useState<TeamCalculationResult>();
  const [draggingId, setDraggingId] = useState<string>();
  const workerRef = useRef<Worker | undefined>(undefined);

  useEffect(() => {
    let disposed = false;
    setStaticLoading(true);
    Promise.all([
      loadHeroPanels<HeroStaticPayload>(false),
      loadRelicSuits<CbgYuhunConfig>(false),
    ])
      .then(([heroPayload, suitPayload]) => {
        if (disposed) return;
        setHeroCatalog(Object.values(heroPayload.heroesById || {}));
        setSuitTwoPieceAttributes(
          Object.fromEntries(
            (suitPayload.yuhun_list || []).flatMap(
              ([, name, , twoPieceText]) =>
                name ? [[String(name), String(twoPieceText || "")]] : [],
            ),
          ),
        );
      })
      .catch(() => {
        if (!disposed) messageApi.error("队伍计算资料加载失败");
      })
      .finally(() => {
        if (!disposed) setStaticLoading(false);
      });
    return () => {
      disposed = true;
      workerRef.current?.terminate();
    };
  }, [messageApi]);

  const ownedHeroIds = useMemo(
    () => new Set((dataset.heroes || []).map((hero) => hero.heroId)),
    [dataset.heroes],
  );
  const availableHeroes = useMemo(
    () =>
      heroCatalog
        .filter((hero) => ownedHeroIds.has(hero.id))
        .sort((left, right) => right.id - left.id),
    [heroCatalog, ownedHeroIds],
  );
  const heroById = useMemo(
    () => new Map(heroCatalog.map((hero) => [hero.id, hero])),
    [heroCatalog],
  );
  const customPanelShortcuts = useMemo(loadCustomPanelShortcuts, []);
  const customMainShortcuts = useMemo(loadCustomMainAttributeShortcuts, []);
  const savedCalculatorConfigs = useMemo(loadSavedCalculatorConfigs, []);
  const panelShortcuts = useMemo(
    () => [...calculatorPanelShortcuts, ...customPanelShortcuts],
    [customPanelShortcuts],
  );
  const mainPresets = useMemo(
    () => [
      ...calculatorMainAttributePresets.filter(
        (preset) => preset.icon !== "clear",
      ),
      ...customMainShortcuts,
    ],
    [customMainShortcuts],
  );
  const resultById = useMemo(
    () =>
      new Map(
        (calculationResult?.members || []).map((item) => [
          item.config.id,
          item,
        ]),
      ),
    [calculationResult],
  );

  const openNewMember = () => {
    setEditingId(undefined);
    setDraft(emptyDraft());
  };

  const openEditMember = (config: TeamMemberConfig) => {
    setEditingId(config.id);
    setDraft(cloneConfig(config));
  };

  const updateTargetRange = (bound: "min" | "max", value: number | null) => {
    setDraft((current) => {
      if (!current) return current;
      const previous = current.constraints[current.targetAttribute] || {};
      const nextRange = {
        ...previous,
        [bound]: value === null ? undefined : Number(value),
      };
      if (
        nextRange.min !== undefined &&
        nextRange.max !== undefined &&
        nextRange.min > nextRange.max
      ) {
        return current;
      }
      return {
        ...current,
        constraints: {
          ...current.constraints,
          [current.targetAttribute]: nextRange,
        },
      };
    });
  };

  const applyPanelShortcut = (
    values: Record<string, CalculatorNumericRange>,
  ) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            constraints: {
              ...current.constraints,
              ...Object.fromEntries(
                Object.entries(values).map(([key, value]) => [
                  key,
                  { ...value },
                ]),
              ),
            },
          }
        : current,
    );
  };

  const applySavedConfig = (id?: string) => {
    const config = savedCalculatorConfigs.find((item) => item.id === id);
    if (!config) return;
    setDraft((current) =>
      current
        ? {
            ...current,
            heroId: config.heroId || current.heroId,
            targetAttribute: panelFields.some(
              ({ key }) => key === config.metric,
            )
              ? (config.metric as PanelConstraintKey)
              : current.targetAttribute,
            constraints: Object.fromEntries(
              Object.entries(config.constraints).map(([key, value]) => [
                key,
                { ...value },
              ]),
            ) as TeamDraft["constraints"],
            mainAttributes: Object.fromEntries(
              Object.entries(config.mainAttributes).map(([key, values]) => [
                key,
                [...(values || [])],
              ]),
            ) as TeamDraft["mainAttributes"],
            extraAttributes: { ...config.extraAttributes },
            requiredFourPiece: config.relicSuitSelection.fourPiece,
            requiredTwoPieceAttributes: [
              ...config.relicSuitSelection.twoPieceAttributes,
            ],
            requiredTwoPieceNames: [...config.relicSuitSelection.omaTwoPieces],
          }
        : current,
    );
  };

  const saveMember = () => {
    if (!draft?.heroId) {
      messageApi.warning("请先选择式神");
      return;
    }
    const hero = heroById.get(draft.heroId);
    if (!hero) {
      messageApi.warning("式神资料尚未加载完成");
      return;
    }
    if (
      members.some(
        (member) => member.heroId === draft.heroId && member.id !== editingId,
      )
    ) {
      messageApi.warning("同一个式神不能重复加入队伍");
      return;
    }
    const id =
      editingId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const nextMember = { ...draft, id, heroId: hero.id } as TeamMemberConfig;
    setMembers((current) =>
      editingId
        ? current.map((member) =>
            member.id === editingId ? nextMember : member,
          )
        : [...current, nextMember],
    );
    setCalculationResult(undefined);
    setDraft(undefined);
  };

  const removeMember = (id: string) => {
    setMembers((current) => current.filter((member) => member.id !== id));
    setCalculationResult(undefined);
  };

  const moveMember = (id: string, offset: number) => {
    setMembers((current) => {
      const index = current.findIndex((member) => member.id === id);
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length)
        return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
    setCalculationResult(undefined);
  };

  const runCalculation = () => {
    if (!members.length) {
      messageApi.info("请先新增至少一个式神");
      return;
    }
    const calculationMembers = members.flatMap((config) => {
      const hero = heroById.get(config.heroId);
      return hero
        ? [{ config, heroName: hero.name, baseStats: hero.baseStats }]
        : [];
    });
    if (calculationMembers.length !== members.length) {
      messageApi.warning("部分式神资料尚未准备好，请稍后再试");
      return;
    }
    workerRef.current?.terminate();
    const worker = new Worker(
      new URL("../../lib/teamCalculator.worker.ts", import.meta.url),
      {
        type: "module",
      },
    );
    workerRef.current = worker;
    setRunning(true);
    setCalculationResult(undefined);
    setProgressPercent(0);
    setProgressText("正在准备队伍计算");
    worker.onmessage = (
      event: MessageEvent<import("@/types/team").TeamWorkerMessage>,
    ) => {
      const data = event.data;
      if (data.type === "progress") {
        const percent =
          data.progress.stage === "matching"
            ? 90
            : Math.min(
                88,
                Math.round(
                  (data.progress.completed / Math.max(1, data.progress.total)) *
                    88,
                ),
              );
        setProgressPercent(percent);
        setProgressText(data.progress.message);
        return;
      }
      if (data.type === "done") {
        setProgressPercent(100);
        setProgressText("计算完成");
        setCalculationResult(data.result);
        setRunning(false);
        worker.terminate();
        workerRef.current = undefined;
        return;
      }
      setRunning(false);
      worker.terminate();
      workerRef.current = undefined;
      messageApi.error(data.message);
      setProgressText(data.message);
    };
    worker.onerror = () => {
      setRunning(false);
      worker.terminate();
      workerRef.current = undefined;
      messageApi.error("队伍计算线程异常退出");
    };
    worker.postMessage({
      type: "start",
      request: {
        members: calculationMembers,
        relicsByPosition: Object.fromEntries(
          Object.entries(dataset.relicsByPosition || {}).map(
            ([position, relics]) => [position, relics.map(compactRelic)],
          ),
        ),
        suitTwoPieceAttributes,
      },
    });
  };

  const canAddMore = members.length < 20;

  return (
    <main className="width result calculator-page team-calculator-page">
      {contextHolder}
      <div className="page-heading">
        <div>
          <h1>队伍计算</h1>
        </div>
        <Typography.Text type="secondary">
          {members.length} / 20 名式神
        </Typography.Text>
      </div>

      <Card
        className="calculator-constraints team-member-panel"
        title="队伍成员"
      >
        {staticLoading ? (
          <Typography.Text type="secondary">正在加载式神资料…</Typography.Text>
        ) : !availableHeroes.length ? (
          <Empty description="当前账号没有可用于队伍计算的式神资料" />
        ) : (
          <Row gutter={[12, 12]} className="team-member-grid">
            {members.map((member, index) => {
              const hero = heroById.get(member.heroId);
              const result = resultById.get(member.id)?.result;
              if (!hero) return null;
              const range = member.constraints[member.targetAttribute];
              return (
                <Col
                  key={member.id}
                  xs={12}
                  sm={12}
                  md={8}
                  className="team-member-col"
                >
                  <Card
                    className="team-member-card"
                    draggable={!running}
                    onDragStart={() => setDraggingId(member.id)}
                    onDragEnd={() => setDraggingId(undefined)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (!draggingId || draggingId === member.id) return;
                      const from = members.findIndex(
                        (item) => item.id === draggingId,
                      );
                      const to = members.findIndex(
                        (item) => item.id === member.id,
                      );
                      if (from < 0 || to < 0) return;
                      setMembers((current) => {
                        const next = [...current];
                        const [item] = next.splice(from, 1);
                        next.splice(to, 0, item);
                        return next;
                      });
                      setCalculationResult(undefined);
                      setDraggingId(undefined);
                    }}
                  >
                    <div className="team-member-card-head">
                      <span className="team-member-priority">
                        优先级 {index + 1}
                      </span>
                      <Space size={2}>
                        <Button
                          type="text"
                          size="small"
                          icon={<UpOutlined />}
                          disabled={index === 0 || running}
                          aria-label="上移"
                          onClick={() => moveMember(member.id, -1)}
                        />
                        <Button
                          type="text"
                          size="small"
                          icon={<DownOutlined />}
                          disabled={index === members.length - 1 || running}
                          aria-label="下移"
                          onClick={() => moveMember(member.id, 1)}
                        />
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          disabled={running}
                          aria-label="编辑"
                          onClick={() => openEditMember(member)}
                        />
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          disabled={running}
                          aria-label="删除"
                          onClick={() => removeMember(member.id)}
                        />
                      </Space>
                    </div>
                    <div className="team-member-card-main">
                      <HeroPortrait
                        hero={{
                          id: hero.id,
                          name: hero.name,
                          rarityCode: hero.rarityCode,
                        }}
                      />
                      <div className="team-member-card-copy">
                        <strong>{hero.name}</strong>
                        <span>
                          {rarityLabels[hero.rarityCode || 0] || "式神"}
                        </span>
                      </div>
                    </div>
                    <div className="team-member-objective">
                      <span>
                        目标：
                        {
                          panelFields.find(
                            ({ key }) => key === member.targetAttribute,
                          )?.label
                        }
                      </span>
                      <Tag
                        color={
                          member.targetDirection === "max" ? "blue" : "gold"
                        }
                      >
                        {member.targetDirection === "max" ? "最大" : "最小"}
                      </Tag>
                      <small>要求 {rangeText(range)}</small>
                    </div>
                    {result ? (
                      <div className="team-member-result">
                        <span>
                          最终{" "}
                          {formatValue(
                            result.panel[member.targetAttribute],
                            member.targetAttribute,
                          )}
                        </span>
                        <small>
                          {result.suits.length
                            ? result.suits.join(" / ")
                            : "散件方案"}
                        </small>
                      </div>
                    ) : (
                      <div className="team-member-pending">等待计算</div>
                    )}
                  </Card>
                </Col>
              );
            })}
            {canAddMore && (
              <Col xs={12} sm={12} md={8} className="team-member-col">
                <Button
                  block
                  type="dashed"
                  className={`team-add-member${members.length === 0 ? " is-icon-only" : ""}`}
                  icon={<PlusOutlined />}
                  aria-label="新增式神"
                  title="新增式神"
                  disabled={running}
                  onClick={openNewMember}
                >
                  {members.length ? "新增式神" : null}
                </Button>
              </Col>
            )}
          </Row>
        )}
      </Card>

      <div className="calculator-run-action team-calculator-actions">
        <div className="team-calculator-progress" aria-live="polite">
          <div className="team-calculator-progress-head">
            <span>{progressText}</span>
            <strong>{progressPercent}%</strong>
          </div>
          <div className="team-calculator-progress-track">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <Button
          className="team-calculator-start-button"
          type="primary"
          size="large"
          icon={<ThunderboltOutlined />}
          loading={running}
          onClick={runCalculation}
        >
          {running ? "正在计算" : "一键计算"}
        </Button>
      </div>

      <Modal
        open={Boolean(draft)}
        title={editingId ? "编辑队伍式神" : "新增队伍式神"}
        width={760}
        destroyOnHidden
        rootClassName="calculator-page-modal"
        className="team-member-modal"
        onCancel={() => setDraft(undefined)}
        footer={[
          <Button key="cancel" onClick={() => setDraft(undefined)}>
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            onClick={saveMember}
          >
            保存式神
          </Button>,
        ]}
      >
        {draft && (
          <div className="team-member-form">
            <section className="team-form-section">
              <div className="team-form-section-title">式神</div>
              <Select
                showSearch
                value={draft.heroId}
                placeholder="选择账号内式神"
                optionFilterProp="label"
                options={availableHeroes
                  .filter(
                    (hero) =>
                      !members.some(
                        (member) =>
                          member.heroId === hero.id && member.id !== editingId,
                      ),
                  )
                  .map((hero) => ({ value: hero.id, label: hero.name }))}
                onChange={(heroId) =>
                  setDraft((current) =>
                    current ? { ...current, heroId } : current,
                  )
                }
              />
            </section>

            <section className="team-form-section">
              <div className="team-form-section-title">目标属性（排他）</div>
              <div className="team-objective-form-row">
                <Select
                  value={draft.targetAttribute}
                  options={panelFields.map(({ key, label, suffix }) => ({
                    value: key,
                    label: `${label}${suffix || ""}`,
                  }))}
                  onChange={(targetAttribute: PanelConstraintKey) =>
                    setDraft((current) =>
                      current ? { ...current, targetAttribute } : current,
                    )
                  }
                />
                <Radio.Group
                  value={draft.targetDirection}
                  optionType="button"
                  buttonStyle="solid"
                  options={[
                    { label: "最大", value: "max" },
                    { label: "最小", value: "min" },
                  ]}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            targetDirection: event.target
                              .value as TeamObjectiveDirection,
                          }
                        : current,
                    )
                  }
                />
              </div>
              <div className="team-target-range">
                <label>
                  <span>最低要求</span>
                  <InputNumber
                    value={draft.constraints[draft.targetAttribute]?.min}
                    placeholder="不限"
                    min={0}
                    onChange={(value) => updateTargetRange("min", value)}
                  />
                </label>
                <MinusOutlined />
                <label>
                  <span>最高要求</span>
                  <InputNumber
                    value={draft.constraints[draft.targetAttribute]?.max}
                    placeholder="不限"
                    min={draft.constraints[draft.targetAttribute]?.min || 0}
                    onChange={(value) => updateTargetRange("max", value)}
                  />
                </label>
              </div>
              <small className="team-form-help">
                同一属性只能选择一个方向；“最大”和“最小”不能同时存在。
              </small>
            </section>

            <section className="team-form-section">
              <div className="team-form-section-title">计算器快速方案</div>
              <div className="team-quick-row">
                {mainPresets.map((preset) => (
                  <Button
                    key={preset.label}
                    size="small"
                    onClick={() => {
                      const presetMetric =
                        "metric" in preset ? preset.metric : undefined;
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              mainAttributes: cloneMainAttributes(
                                preset.mainAttributes || {},
                              ),
                              targetAttribute:
                                presetMetric &&
                                panelFields.some(
                                  ({ key }) => key === presetMetric,
                                )
                                  ? (presetMetric as PanelConstraintKey)
                                  : current.targetAttribute,
                            }
                          : current,
                      );
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
                {panelShortcuts.map((shortcut) => (
                  <Button
                    key={shortcut.label}
                    size="small"
                    onClick={() => applyPanelShortcut(shortcut.values)}
                  >
                    {shortcut.label}
                  </Button>
                ))}
              </div>
              <Select
                allowClear
                placeholder="导入已保存的计算器方案"
                options={savedCalculatorConfigs.map((config) => ({
                  value: config.id,
                  label: config.label,
                }))}
                onChange={applySavedConfig}
              />
              <div className="team-main-attribute-preview">
                {([2, 4, 6] as const).map((position) => (
                  <span key={position}>
                    {position}号位：
                    {draft.mainAttributes[position]?.join(" / ") || "不限"}
                  </span>
                ))}
              </div>
            </section>

            <section className="team-form-section team-form-secondary">
              <div className="team-form-section-title">主属性微调</div>
              <div className="team-main-attribute-grid">
                {([2, 4, 6] as const).map((position) => (
                  <label key={position}>
                    <span>{position}号位</span>
                    <Select
                      mode="multiple"
                      allowClear
                      value={draft.mainAttributes[position] || []}
                      options={mainAttributeOptions[position].map((value) => ({
                        value,
                        label: value,
                      }))}
                      onChange={(values) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                mainAttributes: {
                                  ...current.mainAttributes,
                                  [position]: values,
                                },
                              }
                            : current,
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </section>
          </div>
        )}
      </Modal>
    </main>
  );
}
