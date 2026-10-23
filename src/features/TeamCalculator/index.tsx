"use client";

import {
  ClearOutlined,
  DeleteOutlined,
  EditOutlined,
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
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalculatorHeroPortrait as HeroPortrait } from "../Calculator/CalculatorHeroPicker/HeroPortrait";
import { CalculatorHeroPicker } from "../Calculator/CalculatorHeroPicker";
import { CalculatorSuitPicker } from "../Calculator/CalculatorSuitPicker";
import { TeamCalculationResults } from "./TeamCalculationResults";
import {
  calculatorMainAttributePresets,
  calculatorPanelShortcuts,
} from "@/config/calculatorPresets";
import {
  allMainAttributes,
  defaultExtraAttributes,
  extraAttributeFields,
  loadCustomMainAttributeShortcuts,
  loadCustomPanelShortcuts,
  loadRecentHeroIds,
  loadRecentRelicChoices,
  loadSavedCalculatorConfigs,
  mainAttributeOptions,
  metricOptions,
  panelFields,
  rarityLabels,
  recentChoiceLimit,
  recentHeroStorageKey,
  recentRelicStorageKey,
  twoPieceAttributeOrderMap,
  type CbgYuhunConfig,
  type CalculatorMainAttributePreset,
  type HeroRecord,
  type SuitType,
} from "../Calculator/calculatorShared";
import { loadHeroPanels, loadRelicSuits } from "@/lib/staticApi";
import {
  isPanelShortcutActive,
  togglePanelShortcutConstraints,
} from "@/lib/calculator/panel";
import {
  loadSavedTeamPresets,
  teamPresetStorageKey,
  type SavedTeamPreset,
} from "@/lib/teamPresets";
import type { CalculatorMetric } from "@/lib/calculator/types";
import { useAppSelector } from "@/store";
import { useMobileLayout } from "@/components/Layout/mobileLayout";
import type { CalculatorNumericRange } from "@/types/calculator";
import type {
  CalculatorHeroOption,
  RecentRelicChoice,
} from "@/types/calculator";
import type {
  TeamCalculationResult,
  TeamMemberConfig,
  TeamMemberDraft,
  TeamObjectiveDirection,
} from "@/types/team";
import type { PanelConstraintKey } from "@/lib/calculator/types";
import { CalculatorRangeField } from "../Calculator/CalculatorRangeField";
import styles from "./index.module.scss";

type HeroStaticPayload = { heroesById?: Record<string, HeroRecord> };

type TeamDraft = Omit<TeamMemberDraft, "heroId"> & { heroId?: number };

function normalizeMainAttributes(
  attributes?: TeamMemberConfig["mainAttributes"],
): NonNullable<TeamMemberConfig["mainAttributes"]> {
  if (attributes === undefined) return allMainAttributes();
  return Object.fromEntries(
    ([2, 4, 6] as const).map((position) => [
      position,
      [...(attributes[position] || [])],
    ]),
  ) as NonNullable<TeamMemberConfig["mainAttributes"]>;
}

const emptyDraft = (): TeamDraft => ({
  targetAttribute: "speed",
  targetDirections: {},
  constraints: {},
  mainAttributes: normalizeMainAttributes(),
  extraAttributes: { ...defaultExtraAttributes },
  requiredTwoPieceAttributes: [],
  requiredTwoPieceNames: [],
});

function formatValue(value: number, attribute: CalculatorMetric) {
  const digits = ["attack", "health", "defense"].includes(attribute) ? 0 : 2;
  return value.toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

function rangeText(range?: CalculatorNumericRange) {
  if (range?.min === undefined && range?.max === undefined) return "不限";
  if (range?.min !== undefined && range.max !== undefined)
    return `${range.min}～${range.max}`;
  if (range?.min !== undefined) return `≥ ${range.min}`;
  return `≤ ${range?.max}`;
}

function cloneConfig(config: TeamMemberConfig): TeamMemberConfig {
  return {
    ...config,
    targetDirections: { ...config.targetDirections },
    constraints: Object.fromEntries(
      Object.entries(config.constraints).map(([key, range]) => [
        key,
        { ...range },
      ]),
    ) as TeamMemberConfig["constraints"],
    mainAttributes: normalizeMainAttributes(config.mainAttributes),
    extraAttributes: { ...config.extraAttributes },
    requiredTwoPieceAttributes: [...config.requiredTwoPieceAttributes],
    requiredTwoPieceNames: [...config.requiredTwoPieceNames],
  };
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
  const isMobile = useMobileLayout();
  const dataset = useAppSelector((state) => state.app.dataset);
  const [messageApi, contextHolder] = message.useMessage();
  const [heroCatalog, setHeroCatalog] = useState<HeroRecord[]>([]);
  const [suitTypes, setSuitTypes] = useState<SuitType[]>([]);
  const [staticLoading, setStaticLoading] = useState(true);
  const [members, setMembers] = useState<TeamMemberConfig[]>([]);
  const [teamPresets, setTeamPresets] = useState<SavedTeamPreset[]>([]);
  const [selectedTeamPresetId, setSelectedTeamPresetId] = useState<string>();
  const [teamPresetModalOpen, setTeamPresetModalOpen] = useState(false);
  const [teamPresetLabel, setTeamPresetLabel] = useState("");
  const [draft, setDraft] = useState<TeamDraft>();
  const [selectedSavedConfigId, setSelectedSavedConfigId] = useState<string>();
  const [suppressedPanelShortcut, setSuppressedPanelShortcut] =
    useState<string>();
  const [extraAttributesOpen, setExtraAttributesOpen] = useState(false);
  const [heroPickerOpen, setHeroPickerOpen] = useState(false);
  const [suitPickerOpen, setSuitPickerOpen] = useState(false);
  const [heroSearch, setHeroSearch] = useState("");
  const [recentHeroIds, setRecentHeroIds] = useState(loadRecentHeroIds);
  const [recentRelicChoices, setRecentRelicChoices] = useState(
    loadRecentRelicChoices,
  );
  const [editingId, setEditingId] = useState<string>();
  const [running, setRunning] = useState(false);
  const [progressText, setProgressText] = useState("等待计算");
  const [progressPercent, setProgressPercent] = useState(0);
  const [calculationResult, setCalculationResult] =
    useState<TeamCalculationResult>();
  const [draggingId, setDraggingId] = useState<string>();
  const workerRef = useRef<Worker | undefined>(undefined);

  useEffect(() => {
    setTeamPresets(loadSavedTeamPresets());
  }, []);

  const updateDraft = (update: (current: TeamDraft) => TeamDraft) => {
    setSelectedSavedConfigId(undefined);
    setDraft((current) => (current ? update(current) : current));
  };

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
        const omaIds = new Set(
          Object.keys(suitPayload.two_suit_yuhun || {}).map(Number),
        );
        setSuitTypes(
          (suitPayload.yuhun_list || [])
            .map(([id, name, , twoPieceText = ""]) => ({
              id: Number(id),
              name: String(name),
              twoPieceText: String(twoPieceText),
              isOma: omaIds.has(Number(id)),
            }))
            .filter((item) => item.id > 0 && item.name)
            .sort((left, right) =>
              left.name.localeCompare(right.name, "zh-CN"),
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

  useEffect(() => {
    try {
      window.localStorage.setItem(
        recentHeroStorageKey,
        JSON.stringify(recentHeroIds),
      );
    } catch {
      // 本地存储不可用时仍保留本次页面中的最近选择。
    }
  }, [recentHeroIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        recentRelicStorageKey,
        JSON.stringify(recentRelicChoices),
      );
    } catch {
      // 本地存储不可用时仍保留本次页面中的最近选择。
    }
  }, [recentRelicChoices]);

  const availableHeroes = useMemo(
    () => [...heroCatalog].sort((left, right) => right.id - left.id),
    [heroCatalog],
  );
  const heroById = useMemo(
    () => new Map(heroCatalog.map((hero) => [hero.id, hero])),
    [heroCatalog],
  );
  const heroGroups = useMemo(() => {
    const groups = new Map<number, HeroRecord[]>();
    const keyword = heroSearch.trim().toLocaleLowerCase();
    availableHeroes
      .filter(
        (hero) => !keyword || hero.name.toLocaleLowerCase().includes(keyword),
      )
      .forEach((hero) => {
        const rarity = hero.rarityCode || 0;
        groups.set(rarity, [...(groups.get(rarity) || []), hero]);
      });
    return [...groups.entries()].sort(([left], [right]) => right - left);
  }, [availableHeroes, heroSearch]);
  const recentHeroes = useMemo(
    () =>
      recentHeroIds
        .map((id) => availableHeroes.find((hero) => hero.id === id))
        .filter((hero): hero is HeroRecord => Boolean(hero)),
    [availableHeroes, recentHeroIds],
  );
  const twoPieceGroups = useMemo(() => {
    const groups = new Map<string, SuitType[]>();
    suitTypes
      .filter((item) => !item.isOma)
      .forEach((item) => {
        const label = item.twoPieceText || "无两件套属性";
        groups.set(label, [...(groups.get(label) || []), item]);
      });
    return [...groups.entries()]
      .sort(([left], [right]) => {
        const leftOrder = twoPieceAttributeOrderMap.get(left);
        const rightOrder = twoPieceAttributeOrderMap.get(right);
        return (
          (leftOrder ?? Number.MAX_SAFE_INTEGER) -
            (rightOrder ?? Number.MAX_SAFE_INTEGER) ||
          left.localeCompare(right, "zh-CN")
        );
      })
      .map(([label, suits]) => ({ label, suits }));
  }, [suitTypes]);
  const omaSuits = useMemo(
    () =>
      suitTypes
        .filter((item) => item.isOma)
        .sort((left, right) => left.id - right.id),
    [suitTypes],
  );
  const suitTwoPieceAttributes = useMemo(
    () =>
      Object.fromEntries(
        suitTypes
          .filter((suit) => !suit.isOma && suit.twoPieceText)
          .map((suit) => [suit.name, suit.twoPieceText]),
      ),
    [suitTypes],
  );
  const recentChoices = useMemo(
    () =>
      recentRelicChoices.filter((choice) => {
        if (choice.kind === "twoPieceAttribute")
          return twoPieceGroups.some((group) => group.label === choice.value);
        return suitTypes.some(
          (suit) =>
            suit.name === choice.value &&
            (choice.kind === "omaTwoPiece" ? suit.isOma : !suit.isOma),
        );
      }),
    [recentRelicChoices, suitTypes, twoPieceGroups],
  );
  const selectedTwoPieceAttributes = new Set(
    draft?.requiredTwoPieceAttributes || [],
  );
  const selectedOmaTwoPieces = new Set(draft?.requiredTwoPieceNames || []);
  const selectedTwoPieceCount =
    selectedTwoPieceAttributes.size + selectedOmaTwoPieces.size;
  const selectedRelicSlots =
    (draft?.requiredFourPiece ? 4 : 0) + selectedTwoPieceCount * 2;
  const relicSuitSummary =
    [
      ...(draft?.requiredFourPiece ? [`4件 ${draft.requiredFourPiece}`] : []),
      ...[...selectedTwoPieceAttributes].map((attribute) => `2件 ${attribute}`),
      ...[...selectedOmaTwoPieces].map((name) => `2件 ${name}`),
    ].join(" / ") || "全部类型";
  const customPanelShortcuts = useMemo(loadCustomPanelShortcuts, []);
  const customMainAttributeShortcuts = useMemo(
    loadCustomMainAttributeShortcuts,
    [],
  );
  const mainAttributePresets = useMemo<CalculatorMainAttributePreset[]>(() => {
    const clearPreset = calculatorMainAttributePresets.find(
      (preset) => preset.icon === "clear",
    );
    return [
      ...calculatorMainAttributePresets.filter(
        (preset) => preset.icon !== "clear",
      ),
      ...customMainAttributeShortcuts,
      ...(clearPreset ? [clearPreset] : []),
    ];
  }, [customMainAttributeShortcuts]);
  const savedCalculatorConfigs = useMemo(loadSavedCalculatorConfigs, []);
  const panelShortcuts = useMemo(
    () => [...calculatorPanelShortcuts, ...customPanelShortcuts],
    [customPanelShortcuts],
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
  const hasCompleteMainAttributeSelection = members.every(
    (member) =>
      member.mainAttributes === undefined ||
      ([2, 4, 6] as const).every(
        (position) => (member.mainAttributes?.[position]?.length || 0) > 0,
      ),
  );

  const openNewMember = () => {
    setEditingId(undefined);
    setSelectedSavedConfigId(undefined);
    setExtraAttributesOpen(false);
    setHeroPickerOpen(false);
    setSuitPickerOpen(false);
    setHeroSearch("");
    setDraft(emptyDraft());
  };

  const openEditMember = (config: TeamMemberConfig) => {
    setEditingId(config.id);
    setSelectedSavedConfigId(undefined);
    setHeroPickerOpen(false);
    setSuitPickerOpen(false);
    setHeroSearch("");
    setExtraAttributesOpen(
      Object.values(config.extraAttributes).some((value) => value !== 0),
    );
    setDraft(cloneConfig(config));
  };

  const chooseHero = (option: CalculatorHeroOption) => {
    if (!availableHeroes.some((hero) => hero.id === option.id)) return;
    updateDraft((current) => ({ ...current, heroId: option.id }));
    setRecentHeroIds((current) =>
      [option.id, ...current.filter((id) => id !== option.id)].slice(
        0,
        recentChoiceLimit,
      ),
    );
    setHeroPickerOpen(false);
  };

  const rememberRecentRelicChoice = (choice: RecentRelicChoice) => {
    setRecentRelicChoices((current) =>
      [
        choice,
        ...current.filter(
          (item) => item.kind !== choice.kind || item.value !== choice.value,
        ),
      ].slice(0, recentChoiceLimit),
    );
  };

  const commitRelicSuitSelection = (
    fourPiece: string | undefined,
    twoPieceAttributes: Set<string>,
    omaTwoPieces: Set<string>,
  ) => {
    const slots =
      (fourPiece ? 4 : 0) + (twoPieceAttributes.size + omaTwoPieces.size) * 2;
    updateDraft((current) => ({
      ...current,
      requiredFourPiece: fourPiece,
      requiredTwoPieceAttributes: [...twoPieceAttributes],
      requiredTwoPieceNames: [...omaTwoPieces],
    }));
    if (slots === 6) setSuitPickerOpen(false);
  };

  const selectFourPiece = (name: string) => {
    const nextFourPiece = draft?.requiredFourPiece === name ? undefined : name;
    const nextTwoPieceCount =
      selectedTwoPieceAttributes.size +
      [...selectedOmaTwoPieces].filter((item) => item !== name).length;
    const nextOmaTwoPieces = new Set(selectedOmaTwoPieces);
    nextOmaTwoPieces.delete(name);
    if (nextFourPiece && nextTwoPieceCount > 1) return;
    commitRelicSuitSelection(
      nextFourPiece,
      new Set(selectedTwoPieceAttributes),
      nextOmaTwoPieces,
    );
    if (nextFourPiece)
      rememberRecentRelicChoice({ kind: "fourPiece", value: nextFourPiece });
  };

  const toggleTwoPieceAttribute = (attribute: string) => {
    const next = new Set(selectedTwoPieceAttributes);
    if (next.has(attribute)) next.delete(attribute);
    else if (selectedRelicSlots < 6) {
      next.add(attribute);
      rememberRecentRelicChoice({
        kind: "twoPieceAttribute",
        value: attribute,
      });
    }
    commitRelicSuitSelection(
      draft?.requiredFourPiece,
      next,
      new Set(selectedOmaTwoPieces),
    );
  };

  const toggleOmaTwoPiece = (name: string) => {
    const next = new Set(selectedOmaTwoPieces);
    if (next.has(name)) next.delete(name);
    else if (selectedRelicSlots < 6) {
      next.add(name);
      rememberRecentRelicChoice({ kind: "omaTwoPiece", value: name });
    }
    commitRelicSuitSelection(
      draft?.requiredFourPiece,
      new Set(selectedTwoPieceAttributes),
      next,
    );
  };

  const updateConstraintRange = (
    attribute: PanelConstraintKey,
    range: CalculatorNumericRange,
  ) => {
    updateDraft((current) => ({
      ...current,
      constraints: { ...current.constraints, [attribute]: range },
    }));
  };

  const toggleMainAttribute = (position: 2 | 4 | 6, attribute: string) => {
    updateDraft((current) => {
      const selected = current.mainAttributes?.[position] || [];
      const next = selected.includes(attribute)
        ? selected.filter((item) => item !== attribute)
        : [...selected, attribute];
      return {
        ...current,
        mainAttributes: {
          ...normalizeMainAttributes(current.mainAttributes),
          [position]: next.length ? next : undefined,
        },
      };
    });
  };

  const applyMainAttributePreset = (preset: CalculatorMainAttributePreset) => {
    const isActive =
      !preset.icon &&
      ([2, 4, 6] as const).every((position) => {
        const selected = draft?.mainAttributes?.[position] || [];
        const expected = preset.mainAttributes[position] || [];
        return (
          selected.length === expected.length &&
          expected.every((attribute) => selected.includes(attribute))
        );
      });
    updateDraft((current) => ({
      ...current,
      mainAttributes:
        preset.icon === "clear" || isActive
          ? allMainAttributes()
          : (Object.fromEntries(
              Object.entries(preset.mainAttributes).map(
                ([position, values]) => [position, [...values]],
              ),
            ) as TeamDraft["mainAttributes"]),
    }));
  };

  const updateTargetDirection = (
    attribute: PanelConstraintKey,
    direction: Exclude<TeamObjectiveDirection, "none">,
    enabled: boolean,
  ) => {
    updateDraft((current) => {
      const currentDirection = current.targetDirections?.[attribute] || "none";
      return {
        ...current,
        targetDirections: {
          ...current.targetDirections,
          [attribute]: enabled
            ? direction
            : currentDirection === direction
              ? "none"
              : currentDirection,
        },
      };
    });
  };

  const applyPanelShortcut = (
    values: Partial<Record<PanelConstraintKey, CalculatorNumericRange>>,
  ) => {
    updateDraft((current) => {
      const baseStats = heroById.get(current.heroId || 0)?.baseStats || {};
      return {
        ...current,
        constraints: togglePanelShortcutConstraints(
          current.constraints,
          values,
          baseStats,
        ),
      };
    });
  };

  const applySavedConfig = (id?: string) => {
    const config = savedCalculatorConfigs.find((item) => item.id === id);
    setSelectedSavedConfigId(config?.id);
    if (!config) return;
    setDraft((current) =>
      current
        ? {
            ...current,
            heroId: config.heroId || current.heroId,
            targetAttribute: config.metric,
            mainAttributes: normalizeMainAttributes(config.mainAttributes),
            constraints: Object.fromEntries(
              Object.entries(config.constraints).map(([key, value]) => [
                key,
                { ...value },
              ]),
            ) as TeamDraft["constraints"],
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
    setSelectedTeamPresetId(undefined);
    setCalculationResult(undefined);
    setSelectedSavedConfigId(undefined);
    setDraft(undefined);
  };

  const removeMember = (id: string) => {
    setMembers((current) => current.filter((member) => member.id !== id));
    setSelectedTeamPresetId(undefined);
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
    setSelectedTeamPresetId(undefined);
    setCalculationResult(undefined);
  };

  const openSaveTeamPreset = () => {
    setTeamPresetLabel("");
    setTeamPresetModalOpen(true);
  };

  const saveTeamPreset = () => {
    const label = teamPresetLabel.trim();
    if (!label || !members.length) return;
    const existing = teamPresets.find((preset) => preset.label === label);
    const preset: SavedTeamPreset = {
      id:
        existing?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      label,
      members: members.map(cloneConfig),
    };
    const next = existing
      ? teamPresets.map((item) => (item.id === existing.id ? preset : item))
      : [...teamPresets, preset];
    try {
      window.localStorage.setItem(teamPresetStorageKey, JSON.stringify(next));
    } catch {
      messageApi.error("队伍预设保存失败，请检查浏览器本地存储空间");
      return;
    }
    setTeamPresets(next);
    setSelectedTeamPresetId(preset.id);
    setTeamPresetModalOpen(false);
    messageApi.success(existing ? "队伍预设已覆盖保存" : "队伍预设已保存");
  };

  const applySelectedTeamPreset = () => {
    const preset = teamPresets.find((item) => item.id === selectedTeamPresetId);
    if (!preset) return;
    const apply = () => {
      const createdAt = Date.now();
      setMembers(
        preset.members.map((member, index) => ({
          ...cloneConfig(member),
          id: `${createdAt}-${index}-${Math.random().toString(36).slice(2)}`,
        })),
      );
      setCalculationResult(undefined);
      setProgressPercent(0);
      setProgressText("等待计算");
      messageApi.success(`已应用队伍预设「${preset.label}」`);
    };
    if (!members.length) {
      apply();
      return;
    }
    Modal.confirm({
      title: "替换当前队伍？",
      content: `应用「${preset.label}」将替换当前 ${members.length} 名队伍成员。`,
      okText: "替换并应用",
      cancelText: "取消",
      onOk: apply,
    });
  };

  const deleteSelectedTeamPreset = () => {
    const preset = teamPresets.find((item) => item.id === selectedTeamPresetId);
    if (!preset) return;
    Modal.confirm({
      title: "删除队伍预设？",
      content: `确定删除「${preset.label}」吗？当前队伍不会受到影响。`,
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        const next = teamPresets.filter((item) => item.id !== preset.id);
        try {
          window.localStorage.setItem(
            teamPresetStorageKey,
            JSON.stringify(next),
          );
        } catch {
          messageApi.error("队伍预设删除失败，请重试");
          return;
        }
        setTeamPresets(next);
        setSelectedTeamPresetId(undefined);
        messageApi.success("队伍预设已删除");
      },
    });
  };

  const runCalculation = () => {
    if (!members.length) {
      messageApi.info("请先新增至少一个式神");
      return;
    }
    if (!hasCompleteMainAttributeSelection) {
      messageApi.warning("每位式神的 2 / 4 / 6 号位主属性都至少需要选择一项");
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
    <div className={styles.scope}>
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
          <Row gutter={[8, 8]} className="team-preset-toolbar">
            <Col xs={24} md={12}>
              <Select
                aria-label="选择队伍预设"
                className="team-preset-select"
                placeholder="选择已保存的队伍预设"
                value={selectedTeamPresetId}
                options={teamPresets.map((preset) => ({
                  value: preset.id,
                  label: `${preset.label}（${preset.members.length}人）`,
                }))}
                disabled={!teamPresets.length || running}
                onChange={setSelectedTeamPresetId}
              />
            </Col>
            <Col xs={24} sm={8} md={4}>
              <Button
                block
                icon={<SaveOutlined />}
                disabled={!members.length || running}
                onClick={openSaveTeamPreset}
              >
                保存预设
              </Button>
            </Col>
            <Col xs={24} sm={8} md={4}>
              <Button
                block
                type="primary"
                disabled={!selectedTeamPresetId || running}
                onClick={applySelectedTeamPreset}
              >
                使用预设
              </Button>
            </Col>
            <Col xs={24} sm={8} md={4}>
              <Button
                block
                danger
                disabled={!selectedTeamPresetId || running}
                onClick={deleteSelectedTeamPreset}
              >
                删除预设
              </Button>
            </Col>
          </Row>
          {staticLoading ? (
            <Typography.Text type="secondary">
              正在加载式神资料…
            </Typography.Text>
          ) : !availableHeroes.length ? (
            <Empty description="当前账号没有可用于队伍计算的式神资料" />
          ) : (
            <Row gutter={[12, 12]} className="team-member-grid">
              {members.map((member, index) => {
                const hero = heroById.get(member.heroId);
                const result = resultById.get(member.id)?.result;
                if (!hero) return null;
                const panelConstraints = panelFields.flatMap(
                  ({ key, label, suffix }) => {
                    const range = member.constraints[key];
                    const min =
                      range?.min !== undefined &&
                      range.min > (hero.baseStats[key] || 0)
                        ? range.min
                        : undefined;
                    const max = range?.max;
                    if (min === undefined && max === undefined) return [];
                    return [
                      `${label} ${rangeText({ min, max })}${suffix || ""}`,
                    ];
                  },
                );
                const targetLabel =
                  metricOptions.find(
                    ({ value }) => value === member.targetAttribute,
                  )?.label || member.targetAttribute;
                const objectiveFields = panelFields.filter(
                  ({ key }) =>
                    member.targetDirections?.[key] &&
                    member.targetDirections[key] !== "none",
                );
                const mainAttributeFilters = ([2, 4, 6] as const).flatMap(
                  (position) => {
                    const selected =
                      member.mainAttributes === undefined
                        ? mainAttributeOptions[position]
                        : member.mainAttributes[position] || [];
                    if (!selected.length) return [`${position}号位未选`];
                    return selected.length <
                      mainAttributeOptions[position].length
                      ? [`${position}号位 ${selected.join("、")}`]
                      : [];
                  },
                );
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
                        setSelectedTeamPresetId(undefined);
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
                        <span>计算目标：{targetLabel}</span>
                        {objectiveFields.map(({ key, label }) => (
                          <Tag
                            key={key}
                            color={
                              member.targetDirections?.[key] === "max"
                                ? "blue"
                                : "gold"
                            }
                          >
                            {label}
                            {member.targetDirections?.[key] === "max"
                              ? "最大"
                              : "最小"}
                          </Tag>
                        ))}
                        {panelConstraints.length > 0 && (
                          <small>面板约束：{panelConstraints.join("；")}</small>
                        )}
                        {mainAttributeFilters.length > 0 && (
                          <small>
                            主属性：{mainAttributeFilters.join("；")}
                          </small>
                        )}
                      </div>
                      {result ? (
                        <div className="team-member-result">
                          <span>
                            {objectiveFields.length ? "优化结果" : "参考结果"}{" "}
                            {formatValue(result.score, member.targetAttribute)}
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
                    className="team-add-member"
                    icon={<PlusOutlined />}
                    aria-label="新增式神"
                    title="新增式神"
                    disabled={running}
                    onClick={openNewMember}
                  >
                    新增式神
                  </Button>
                </Col>
              )}
            </Row>
          )}
        </Card>

        <TeamCalculationResults
          results={calculationResult?.members || []}
          heroById={heroById}
          running={running}
        />

        <div className="calculator-run-action team-calculator-actions">
          <div className="team-calculator-progress" aria-live="polite">
            <div className="team-calculator-progress-head">
              <span>
                {hasCompleteMainAttributeSelection
                  ? progressText
                  : "每位式神的 2 / 4 / 6 号位主属性都至少需要选择一项"}
              </span>
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
            disabled={!hasCompleteMainAttributeSelection}
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
          rootClassName={`${styles.scope}${isMobile ? ` ${styles.mobile}` : ""} calculator-page-modal`}
          className="team-member-modal"
          onCancel={() => {
            setSelectedSavedConfigId(undefined);
            setDraft(undefined);
          }}
          footer={[
            <Button
              key="cancel"
              onClick={() => {
                setSelectedSavedConfigId(undefined);
                setDraft(undefined);
              }}
            >
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
                <div className="team-form-section-title">快捷选择与筛选</div>
                <Select
                  allowClear
                  value={selectedSavedConfigId}
                  placeholder="导入已保存的计算器方案"
                  options={savedCalculatorConfigs.map((config) => ({
                    value: config.id,
                    label: config.label,
                  }))}
                  onChange={applySavedConfig}
                />
                <Row gutter={[8, 8]} className="team-quick-pickers">
                  <Col xs={24} sm={12}>
                    <Button
                      block
                      disabled={staticLoading || !availableHeroes.length}
                      onClick={() => setHeroPickerOpen(true)}
                    >
                      式神：{heroById.get(draft.heroId || 0)?.name || "请选择"}
                    </Button>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Button
                      block
                      disabled={staticLoading || !suitTypes.length}
                      onClick={() => setSuitPickerOpen(true)}
                    >
                      御魂类型：{relicSuitSummary}
                    </Button>
                  </Col>
                </Row>
              </section>

              <section className="team-form-section">
                <div className="team-form-section-title">
                  2 / 4 / 6 号位主属性
                </div>
                <div
                  className="team-quick-row team-main-attribute-presets"
                  role="group"
                  aria-label="主属性快捷选择"
                >
                  {mainAttributePresets.map((preset) => {
                    const active =
                      !preset.icon &&
                      ([2, 4, 6] as const).every((position) => {
                        const selected = draft.mainAttributes?.[position] || [];
                        const expected = preset.mainAttributes[position] || [];
                        return (
                          selected.length === expected.length &&
                          expected.every((attribute) =>
                            selected.includes(attribute),
                          )
                        );
                      });
                    return (
                      <Button
                        key={preset.label}
                        size="small"
                        aria-pressed={active}
                        className={active ? "is-active" : undefined}
                        title={preset.label}
                        disabled={running}
                        onClick={(event) => {
                          applyMainAttributePreset(preset);
                          event.currentTarget.blur();
                        }}
                      >
                        {preset.label}
                      </Button>
                    );
                  })}
                </div>
                <div className="team-main-attribute-grid">
                  {([2, 4, 6] as const).map((position) => (
                    <div className="team-main-attribute-group" key={position}>
                      <span>{position}号位</span>
                      <div>
                        {mainAttributeOptions[position].map((attribute) => {
                          const selected = Boolean(
                            draft.mainAttributes?.[position]?.includes(
                              attribute,
                            ),
                          );
                          return (
                            <button
                              aria-pressed={selected}
                              className={selected ? "is-selected" : ""}
                              key={attribute}
                              type="button"
                              disabled={running}
                              onClick={() =>
                                toggleMainAttribute(position, attribute)
                              }
                            >
                              {attribute}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="team-form-section">
                <div className="team-form-section-title">计算目标</div>
                <Row gutter={[12, 12]}>
                  <Col xs={24}>
                    <Select
                      value={draft.targetAttribute}
                      options={metricOptions}
                      onChange={(targetAttribute: CalculatorMetric) =>
                        updateDraft((current) => ({
                          ...current,
                          targetAttribute,
                        }))
                      }
                    />
                  </Col>
                </Row>
                <small className="team-form-help">
                  先按已启用的最大方向排序，再按计算目标和最小方向排序。
                </small>
              </section>

              <section className="team-form-section">
                <div className="team-panel-range-header">
                  <div className="team-form-section-title">最终面板范围</div>
                  <div className="team-quick-choice-group team-panel-range-shortcuts">
                    <span>快捷筛选</span>
                    <div
                      className="team-quick-row"
                      role="group"
                      aria-label="面板快捷筛选"
                    >
                      {panelShortcuts.map((shortcut) => {
                        const entries = Object.entries(shortcut.values) as [
                          PanelConstraintKey,
                          CalculatorNumericRange,
                        ][];
                        const active = isPanelShortcutActive(
                          draft.constraints,
                          shortcut.values,
                        );
                        const disabledByMetric = entries.some(
                          ([key]) => key === draft.targetAttribute,
                        );
                        return (
                          <Button
                            key={shortcut.label}
                            size="small"
                            aria-pressed={active}
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
                    </div>
                  </div>
                </div>
                <Row gutter={[16, 16]} className="team-panel-range-grid">
                  {panelFields.map(({ key, label, suffix }) => (
                    <Col key={key} xs={24} md={12}>
                      <div className="team-panel-range-item">
                        <CalculatorRangeField
                          field={key}
                          label={label}
                          suffix={suffix}
                          minimum={
                            heroById.get(draft.heroId || 0)?.baseStats[key] || 0
                          }
                          range={draft.constraints[key]}
                          disabled={draft.targetAttribute === key}
                          onChange={(range) =>
                            updateConstraintRange(key, range)
                          }
                        />
                        <Space size={8} className="team-panel-range-direction">
                          <label>
                            <Switch
                              size="small"
                              aria-label={`${label}最大`}
                              checked={draft.targetDirections?.[key] === "max"}
                              onChange={(enabled) =>
                                updateTargetDirection(key, "max", enabled)
                              }
                            />
                            <span>最大</span>
                          </label>
                          <label>
                            <Switch
                              size="small"
                              aria-label={`${label}最小`}
                              checked={draft.targetDirections?.[key] === "min"}
                              onChange={(enabled) =>
                                updateTargetDirection(key, "min", enabled)
                              }
                            />
                            <span>最小</span>
                          </label>
                        </Space>
                      </div>
                    </Col>
                  ))}
                </Row>
              </section>

              <section className="team-form-section">
                <div className="team-extra-attributes-head">
                  <div>
                    <div className="team-form-section-title">额外属性</div>
                    <small>与御魂属性共同计入最终面板</small>
                  </div>
                  <Button
                    size="small"
                    type={extraAttributesOpen ? "primary" : "default"}
                    onClick={() =>
                      setExtraAttributesOpen((current) => !current)
                    }
                  >
                    {extraAttributesOpen ? "收起" : "设置"}
                  </Button>
                </div>
                {extraAttributesOpen && (
                  <div className="team-extra-attribute-grid">
                    {extraAttributeFields.map(({ key, label, suffix }) => (
                      <label className="team-extra-attribute-field" key={key}>
                        <span>{`${label}${suffix || ""}`}</span>
                        <InputNumber
                          min={0}
                          step={0.01}
                          value={draft.extraAttributes[key]}
                          placeholder="0"
                          onChange={(value) =>
                            updateDraft((current) => ({
                              ...current,
                              extraAttributes: {
                                ...current.extraAttributes,
                                [key]: Number(value) || 0,
                              },
                            }))
                          }
                        />
                      </label>
                    ))}
                    <Button
                      aria-label="清空额外属性"
                      title="清空额外属性"
                      icon={<ClearOutlined />}
                      size="small"
                      disabled={
                        !Object.values(draft.extraAttributes).some(
                          (value) => value !== 0,
                        )
                      }
                      onClick={() =>
                        updateDraft((current) => ({
                          ...current,
                          extraAttributes: { ...defaultExtraAttributes },
                        }))
                      }
                    />
                  </div>
                )}
              </section>
            </div>
          )}
        </Modal>
        <Modal
          open={teamPresetModalOpen}
          title="保存队伍预设"
          width={420}
          rootClassName={`${styles.scope} calculator-page-modal`}
          onCancel={() => setTeamPresetModalOpen(false)}
          footer={[
            <Button key="cancel" onClick={() => setTeamPresetModalOpen(false)}>
              取消
            </Button>,
            <Button
              key="save"
              type="primary"
              disabled={!teamPresetLabel.trim()}
              onClick={saveTeamPreset}
            >
              {teamPresets.some(
                (preset) => preset.label === teamPresetLabel.trim(),
              )
                ? "覆盖保存"
                : "保存"}
            </Button>,
          ]}
        >
          <div className="team-preset-save-form">
            <label htmlFor="team-preset-label">预设名称</label>
            <Input
              id="team-preset-label"
              maxLength={16}
              placeholder="例如：双拉一速队"
              value={teamPresetLabel}
              onChange={(event) => setTeamPresetLabel(event.target.value)}
              onPressEnter={saveTeamPreset}
            />
            <small>同名预设会被覆盖保存，最多 20 名式神。</small>
          </div>
        </Modal>
        <CalculatorHeroPicker
          state={{
            open: heroPickerOpen,
            search: heroSearch,
            selectedHeroId: draft?.heroId,
            disabled: running,
          }}
          options={{ recentHeroes, heroGroups, rarityLabels }}
          actions={{ onSearchChange: setHeroSearch, onSelect: chooseHero }}
          commands={{ onClose: () => setHeroPickerOpen(false) }}
        />
        <CalculatorSuitPicker
          state={{
            open: suitPickerOpen,
            running,
            fourPiece: draft?.requiredFourPiece,
            twoPieceAttributes: selectedTwoPieceAttributes,
            omaTwoPieces: selectedOmaTwoPieces,
            selectedTwoPieceCount,
            selectedRelicSlots,
          }}
          options={{ suitTypes, twoPieceGroups, omaSuits, recentChoices }}
          actions={{
            onSelectFourPiece: selectFourPiece,
            onToggleTwoPieceAttribute: toggleTwoPieceAttribute,
            onToggleOmaTwoPiece: toggleOmaTwoPiece,
          }}
          commands={{ onClose: () => setSuitPickerOpen(false) }}
        />
      </main>
    </div>
  );
}
