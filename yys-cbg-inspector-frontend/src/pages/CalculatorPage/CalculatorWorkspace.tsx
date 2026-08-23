import "./CalculatorPage.scss";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { CalculatorRunningState } from "./CalculatorRunningState/CalculatorRunningState";
import { CalculatorControls } from "./CalculatorControls/CalculatorControls";
import { CalculatorStaticUpdateModal } from "./CalculatorStaticUpdateModal/CalculatorStaticUpdateModal";
import {
  CalculatorHeroPicker,
  type CalculatorHeroOption,
} from "./CalculatorHeroPicker/CalculatorHeroPicker";
import { CalculatorSuitPicker } from "./CalculatorSuitPicker/CalculatorSuitPicker";
import { CalculatorResults } from "./CalculatorResults/CalculatorResults";
import { CalculatorConstraints } from "./CalculatorConstraints/CalculatorConstraints";
import { relicPanelCeiling } from "./CalculatorRangeField/CalculatorRangeField";
import { CalculatorMethodInfo } from "./CalculatorMethodInfo/CalculatorMethodInfo";
import { useRelicCalculation } from "./hooks/useRelicCalculation";
import { useCalculatorPersistence } from "./hooks/useCalculatorPersistence";
import { createCalculatorResultColumns } from "./calculatorResultColumns";
import { getCalculatorConfigPreview } from "./calculatorConfigPreview";
import {
  CalculatorConfigModals,
  type CalculatorConfigState,
  type MainShortcutState,
  type PanelShortcutState,
} from "./CalculatorConfigModals/CalculatorConfigModals";
import {
  calculatorPanelShortcuts,
  calculatorMainAttributePresets,
  type CalculatorMainAttributePreset,
  type CalculatorPanelShortcut,
} from "../../config/calculatorPresets";
import {
  getStaticRefreshRemaining,
  markStaticRefresh,
} from "../../lib/staticRefresh";
import { loadHeroPanels, loadRelicSuits } from "../../lib/staticApi";
import type {
  CalculatorExtraAttributeKey,
  CalculatorMetric,
  CalculatorResult,
  PanelConstraintKey,
} from "../../lib/calculator/types";
import { createCalculationRelics } from "../../lib/calculator/relicInput";
import type { RelicDataset } from "../../types";
import {
  heroes,
  replaceHeroes,
  defaultHero,
  rarityLabels,
  metricOptions,
  metricPanelHighlights,
  panelKeyForAttribute,
  isMetricSubAttribute,
  panelFields,
  extraAttributeFields,
  defaultExtraAttributes,
  panelBadgeLabels,
  mainAttributeOptions,
  allMainAttributes,
  twoPieceAttributeOrderMap,
  format,
  basePanelConstraints,
  loadCustomPanelShortcuts,
  loadCustomMainAttributeShortcuts,
  loadSavedCalculatorConfigs,
  loadRecentHeroIds,
  loadRecentRelicChoices,
  recentChoiceLimit,
  StaticUpdateReport,
  HeroRecord,
  HeroStaticPayload,
  SuitType,
  CbgYuhunConfig,
  CustomPanelShortcut,
  CustomMainAttributeShortcut,
  SavedCalculatorConfig,
  RelicSuitSelection,
  RecentRelicChoice,
} from "./calculatorShared";

export function CalculatorWorkspace({
  dataset,
  staticRefreshRequestId = 0,
}: {
  dataset: RelicDataset;
  staticRefreshRequestId?: number;
}) {
  const [staticDataRevision, setStaticDataRevision] = useState(0);
  const [staticDataReady, setStaticDataReady] = useState(false);
  const [suitConfig, setSuitConfig] = useState<CbgYuhunConfig>({});
  const [staticUpdateReport, setStaticUpdateReport] =
    useState<StaticUpdateReport>();
  const [heroId, setHeroId] = useState(defaultHero?.id);
  const [metric, setMetric] = useState<CalculatorMetric>("damage");
  const [resultLimit, setResultLimit] = useState(5);
  const [fastMode, setFastMode] = useState(false);
  const [constraints, setConstraints] = useState<
    Partial<Record<PanelConstraintKey, { min?: number; max?: number }>>
  >(() => basePanelConstraints(defaultHero?.baseStats));
  const [extraAttributes, setExtraAttributes] = useState<
    Record<CalculatorExtraAttributeKey, number>
  >(() => ({ ...defaultExtraAttributes }));
  const [extraAttributesOpen, setExtraAttributesOpen] = useState(false);
  const [customPanelShortcuts, setCustomPanelShortcuts] = useState<
    CustomPanelShortcut[]
  >(loadCustomPanelShortcuts);
  const [shortcutModalOpen, setShortcutModalOpen] = useState(false);
  const [editingShortcutId, setEditingShortcutId] = useState<string>();
  const [shortcutLabel, setShortcutLabel] = useState("");
  const [shortcutValues, setShortcutValues] = useState<
    CustomPanelShortcut["values"]
  >({});
  const [customMainShortcuts, setCustomMainShortcuts] = useState<
    CustomMainAttributeShortcut[]
  >(loadCustomMainAttributeShortcuts);
  const [savedCalculatorConfigs, setSavedCalculatorConfigs] = useState<
    SavedCalculatorConfig[]
  >(loadSavedCalculatorConfigs);
  const [saveCalculatorConfigModalOpen, setSaveCalculatorConfigModalOpen] =
    useState(false);
  const [calculatorConfigLibraryOpen, setCalculatorConfigLibraryOpen] =
    useState(false);
  const [calculatorConfigLabel, setCalculatorConfigLabel] = useState("");
  const [mainShortcutModalOpen, setMainShortcutModalOpen] = useState(false);
  const [editingMainShortcutId, setEditingMainShortcutId] = useState<string>();
  const [mainShortcutLabel, setMainShortcutLabel] = useState("");
  const [mainShortcutAttributes, setMainShortcutAttributes] =
    useState<Partial<Record<2 | 4 | 6, string[]>>>(allMainAttributes);
  const [heroModalOpen, setHeroModalOpen] = useState(false);
  const [relicModalOpen, setRelicModalOpen] = useState(false);
  const [heroSearch, setHeroSearch] = useState("");
  const [recentHeroIds, setRecentHeroIds] = useState(loadRecentHeroIds);
  const [recentRelicChoices, setRecentRelicChoices] = useState(
    loadRecentRelicChoices,
  );
  const [relicSuitSelection, setRelicSuitSelection] =
    useState<RelicSuitSelection>({
      twoPieceAttributes: new Set(),
      omaTwoPieces: new Set(),
    });
  const [mainAttributes, setMainAttributes] =
    useState<Partial<Record<2 | 4 | 6, string[]>>>(allMainAttributes);
  const [selectedResult, setSelectedResult] = useState<CalculatorResult>();
  const staticReadyFrameRef = useRef<number[]>([]);
  const {
    results,
    running,
    calculationProgress,
    calculationStage,
    calculationProgressText,
    elapsed,
    startCalculation,
    stopCalculation,
  } = useRelicCalculation();
  const handledStaticRefreshRequestIdRef = useRef(staticRefreshRequestId);
  const twoPiecePickerRef = useRef<HTMLElement>(null);
  const refreshStaticData = async (refresh = false) => {
    setStaticDataReady(false);
    setSaveCalculatorConfigModalOpen(false);
    setCalculatorConfigLibraryOpen(false);
    try {
      const [heroPayload, nextSuitConfig] = await Promise.all([
        loadHeroPanels<HeroStaticPayload>(refresh),
        loadRelicSuits<CbgYuhunConfig>(refresh),
      ]);
      replaceHeroes(Object.values(heroPayload.heroesById || {}));
      const defaultHero =
        heroes.find((item) => item.name === "须佐之男") || heroes[0];
      setHeroId((current) => current || defaultHero?.id);
      setConstraints((current) =>
        Object.keys(current).length
          ? current
          : basePanelConstraints(defaultHero?.baseStats),
      );
      setSuitConfig(nextSuitConfig);
      setStaticDataRevision((value) => value + 1);
      if (refresh) {
        markStaticRefresh();
        setStaticUpdateReport({
          heroCount: heroes.length,
          suitCount: nextSuitConfig.yuhun_list?.length || 0,
        });
      }
    } catch {
      // Keep the page usable with the existing local state if static refresh
      // fails. The config dialogs must not remain locked indefinitely.
    } finally {
      staticReadyFrameRef.current.forEach((frame) =>
        window.cancelAnimationFrame(frame),
      );
      staticReadyFrameRef.current = [];
      let frameCount = 0;
      const releaseAfterPaint = () => {
        frameCount += 1;
        if (frameCount < 2) {
          staticReadyFrameRef.current.push(
            window.requestAnimationFrame(releaseAfterPaint),
          );
          return;
        }
        staticReadyFrameRef.current = [];
        setStaticDataReady(true);
      };
      staticReadyFrameRef.current.push(
        window.requestAnimationFrame(releaseAfterPaint),
      );
    }
  };
  useEffect(() => {
    void refreshStaticData(
      staticRefreshRequestId > 0 && getStaticRefreshRemaining() === 0,
    );
    return () => {
      staticReadyFrameRef.current.forEach((frame) =>
        window.cancelAnimationFrame(frame),
      );
      staticReadyFrameRef.current = [];
    };
  }, []);
  useEffect(() => {
    if (staticRefreshRequestId <= handledStaticRefreshRequestIdRef.current)
      return;
    handledStaticRefreshRequestIdRef.current = staticRefreshRequestId;
    void refreshStaticData(false);
  }, [staticRefreshRequestId]);
  useCalculatorPersistence({
    customPanelShortcuts,
    customMainShortcuts,
    savedCalculatorConfigs,
    recentHeroIds,
    recentRelicChoices,
  });
  const relicsByPosition = dataset.relicsByPosition || {};
  const relicCount = useMemo(
    () =>
      Object.values(relicsByPosition).reduce(
        (total, items) => total + items.length,
        0,
      ),
    [relicsByPosition],
  );

  const suitTypes = useMemo(() => {
    const config = suitConfig;
    const omaIds = new Set(
      Object.keys(config.two_suit_yuhun || {}).map((id) => Number(id)),
    );
    return (config.yuhun_list || [])
      .map(([id, name, , twoPieceText = ""]) => ({
        id: Number(id),
        name: String(name),
        twoPieceText: String(twoPieceText),
        isOma: omaIds.has(Number(id)),
      }))
      .filter((item) => item.id > 0 && item.name)
      .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  }, [suitConfig]);
  const twoPieceGroups = useMemo(() => {
    const groups = new Map<string, SuitType[]>();
    suitTypes
      .filter((item) => !item.isOma)
      .forEach((item) => {
        const key = item.twoPieceText || "无两件套属性";
        groups.set(key, [...(groups.get(key) || []), item]);
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
      new Map(
        suitTypes
          .filter((suit) => !suit.isOma && suit.twoPieceText)
          .map((suit) => [suit.name, suit.twoPieceText]),
      ),
    [suitTypes],
  );
  const hero = heroes.find((item) => item.id === heroId) || heroes[0];
  const recentHeroes = useMemo(
    () =>
      recentHeroIds
        .map((id) => heroes.find((item) => item.id === id))
        .filter((item): item is HeroRecord => Boolean(item)),
    [recentHeroIds, staticDataRevision],
  );
  const availableRecentRelicChoices = useMemo(
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
  const {
    fourPiece: selectedFourPiece,
    twoPieceAttributes: selectedTwoPieceAttributes,
    omaTwoPieces: selectedOmaTwoPieces,
  } = relicSuitSelection;
  const selectedSuitNames = useMemo(
    () => new Set(selectedOmaTwoPieces),
    [selectedOmaTwoPieces],
  );
  const selectedTwoPieceCount =
    selectedTwoPieceAttributes.size + selectedOmaTwoPieces.size;
  const selectedRelicSlots =
    (selectedFourPiece ? 4 : 0) + selectedTwoPieceCount * 2;
  const selectedSuitSummary = useMemo(() => {
    const selections = [
      ...(selectedFourPiece ? [`4件 ${selectedFourPiece}`] : []),
      ...[...selectedTwoPieceAttributes].map((attribute) => `2件 ${attribute}`),
      ...[...selectedOmaTwoPieces].map((name) => `2件 ${name}`),
    ];
    return selections.length ? selections.join(" / ") : "全部类型";
  }, [selectedFourPiece, selectedOmaTwoPieces, selectedTwoPieceAttributes]);
  const panelShortcuts = useMemo<CalculatorPanelShortcut[]>(
    () => [...calculatorPanelShortcuts, ...customPanelShortcuts],
    [customPanelShortcuts],
  );
  const mainAttributePresets = useMemo<CalculatorMainAttributePreset[]>(() => {
    // 清空按钮固定放在最后，避免新增的快捷按钮插入到清空和管理按钮之间。
    const clearPreset = calculatorMainAttributePresets.find(
      (preset) => preset.icon === "clear",
    );
    return [
      ...calculatorMainAttributePresets.filter(
        (preset) => preset.icon !== "clear",
      ),
      ...customMainShortcuts,
      ...(clearPreset ? [clearPreset] : []),
    ];
  }, [customMainShortcuts]);
  const heroGroups = useMemo(() => {
    const groups = new Map<number, HeroRecord[]>();
    const searchTerm = heroSearch.trim().toLowerCase();
    heroes
      .filter((item) => item.name.toLowerCase().includes(searchTerm))
      .forEach((item) => {
        const rarity = item.rarityCode || 0;
        groups.set(rarity, [...(groups.get(rarity) || []), item]);
      });
    return [...groups.entries()]
      .map(
        ([rarity, items]) =>
          [
            rarity,
            [...items].sort((left, right) => right.id - left.id),
          ] as const,
      )
      .sort(([left], [right]) => right - left);
  }, [heroSearch, staticDataRevision]);
  const metricLabel =
    metricOptions.find((option) => option.value === metric)?.label || "指标";
  const metricIsPanelField = panelFields.some(({ key }) => key === metric);
  const hasCompleteMainAttributeSelection = ([2, 4, 6] as const).every(
    (position) => (mainAttributes[position]?.length || 0) > 0,
  );
  const isActivePanelConstraint = (key: PanelConstraintKey) => {
    const range = constraints[key];
    const baseValue = hero?.baseStats[key] || 0;
    return Boolean(
      range &&
      ((range.min !== undefined && range.min > baseValue) ||
        range.max !== undefined),
    );
  };

  const updateConstraintRange = (
    key: PanelConstraintKey,
    range: { min?: number; max?: number },
  ) => {
    const baseValue = hero?.baseStats[key] || 0;
    setConstraints((current) => {
      const min = Math.max(range.min ?? baseValue, baseValue);
      const max =
        range.max === undefined ? undefined : Math.max(Number(range.max), min);
      return { ...current, [key]: { min, max } };
    });
  };
  const changeMetric = (nextMetric: CalculatorMetric) => {
    setMetric(nextMetric);
    if (!panelFields.some(({ key }) => key === nextMetric)) return;
    setConstraints((current) => ({
      ...current,
      [nextMetric]: { min: hero?.baseStats[nextMetric] || 0 },
    }));
  };
  const toggleMainAttribute = (position: 2 | 4 | 6, value: string) => {
    setMainAttributes((current) => {
      const selected = current[position] || [];
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];
      return { ...current, [position]: next.length ? next : undefined };
    });
  };
  const rememberRecentHero = (id: number) => {
    setRecentHeroIds((current) =>
      [id, ...current.filter((item) => item !== id)].slice(
        0,
        recentChoiceLimit,
      ),
    );
  };
  const rememberRecentRelicChoice = (nextChoice: RecentRelicChoice) => {
    setRecentRelicChoices((current) =>
      [
        nextChoice,
        ...current.filter(
          (choice) =>
            choice.kind !== nextChoice.kind ||
            choice.value !== nextChoice.value,
        ),
      ].slice(0, recentChoiceLimit),
    );
  };
  const chooseHero = (nextHero: HeroRecord) => {
    setHeroId(nextHero.id);
    setConstraints(basePanelConstraints(nextHero.baseStats));
    rememberRecentHero(nextHero.id);
    setHeroModalOpen(false);
  };
  const chooseHeroOption = (option: CalculatorHeroOption) => {
    const selected = heroes.find((item) => item.id === option.id);
    if (selected) chooseHero(selected);
  };
  const applyMainAttributePreset = (preset: CalculatorMainAttributePreset) => {
    if (preset.icon === "clear") {
      setMainAttributes({});
      return;
    }
    const isActive = ([2, 4, 6] as const).every((position) => {
      const selected = mainAttributes[position] || [];
      const expected = preset.mainAttributes[position] || [];
      return (
        selected.length === expected.length &&
        expected.every((attribute) => selected.includes(attribute))
      );
    });
    setMainAttributes(
      isActive
        ? allMainAttributes()
        : (Object.fromEntries(
            Object.entries(preset.mainAttributes).map(([position, values]) => [
              position,
              [...values],
            ]),
          ) as Partial<Record<2 | 4 | 6, string[]>>),
    );
  };
  const openNewMainShortcut = () => {
    setEditingMainShortcutId(undefined);
    setMainShortcutLabel("");
    setMainShortcutAttributes(allMainAttributes());
    setMainShortcutModalOpen(true);
  };
  const openMainShortcutEditor = (shortcut: CustomMainAttributeShortcut) => {
    setEditingMainShortcutId(shortcut.id);
    setMainShortcutLabel(shortcut.label);
    setMainShortcutAttributes(
      Object.fromEntries(
        Object.entries(shortcut.mainAttributes).map(([position, values]) => [
          position,
          [...(values || [])],
        ]),
      ),
    );
    setMainShortcutModalOpen(true);
  };
  const toggleMainShortcutAttribute = (position: 2 | 4 | 6, value: string) => {
    setMainShortcutAttributes((current) => {
      const selected = current[position] || [];
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];
      return { ...current, [position]: next };
    });
  };
  const saveMainShortcut = () => {
    const label = mainShortcutLabel.trim();
    const complete = ([2, 4, 6] as const).every(
      (position) => mainShortcutAttributes[position]?.length,
    );
    if (!label || !complete) return;
    const mainAttributes = Object.fromEntries(
      ([2, 4, 6] as const).map((position) => [
        position,
        [...(mainShortcutAttributes[position] || [])],
      ]),
    ) as CustomMainAttributeShortcut["mainAttributes"];
    setCustomMainShortcuts((current) => {
      const id = editingMainShortcutId || `${Date.now()}-${label}`;
      const next = {
        id,
        label,
        mainAttributes,
      };
      return editingMainShortcutId
        ? current.map((shortcut) =>
            shortcut.id === editingMainShortcutId ? next : shortcut,
          )
        : [...current, next];
    });
    setMainShortcutModalOpen(false);
  };
  const deleteMainShortcut = (id: string) => {
    setCustomMainShortcuts((current) =>
      current.filter((shortcut) => shortcut.id !== id),
    );
    if (editingMainShortcutId === id) setMainShortcutModalOpen(false);
  };
  const commitRelicSuitSelection = (next: RelicSuitSelection) => {
    const slots =
      (next.fourPiece ? 4 : 0) +
      (next.twoPieceAttributes.size + next.omaTwoPieces.size) * 2;
    setRelicSuitSelection(next);

    // 关闭动作与选择操作同批提交，避免 Modal 关闭时又被状态副作用重复触发。
    if (slots === 6) setRelicModalOpen(false);
  };
  const selectFourPiece = (name: string) => {
    const nextFourPiece = selectedFourPiece === name ? undefined : name;
    const nextTwoPieceCount =
      selectedTwoPieceAttributes.size +
      [...selectedOmaTwoPieces].filter((item) => item !== name).length;
    if (nextFourPiece && nextTwoPieceCount > 1) return;

    const nextOmaTwoPieces = new Set(selectedOmaTwoPieces);
    nextOmaTwoPieces.delete(name);
    commitRelicSuitSelection({
      fourPiece: nextFourPiece,
      twoPieceAttributes: new Set(selectedTwoPieceAttributes),
      omaTwoPieces: nextOmaTwoPieces,
    });
    if (nextFourPiece)
      rememberRecentRelicChoice({ kind: "fourPiece", value: nextFourPiece });

    if (nextFourPiece && nextTwoPieceCount === 0 && window.innerWidth <= 760) {
      window.requestAnimationFrame(() => {
        twoPiecePickerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  };
  const toggleTwoPieceAttribute = (attribute: string) => {
    const nextTwoPieceAttributes = new Set(selectedTwoPieceAttributes);
    if (nextTwoPieceAttributes.has(attribute)) {
      nextTwoPieceAttributes.delete(attribute);
    } else if (selectedRelicSlots < 6) {
      nextTwoPieceAttributes.add(attribute);
      rememberRecentRelicChoice({
        kind: "twoPieceAttribute",
        value: attribute,
      });
    }
    commitRelicSuitSelection({
      fourPiece: selectedFourPiece,
      twoPieceAttributes: nextTwoPieceAttributes,
      omaTwoPieces: new Set(selectedOmaTwoPieces),
    });
  };
  const toggleOmaTwoPiece = (name: string) => {
    const nextOmaTwoPieces = new Set(selectedOmaTwoPieces);
    if (nextOmaTwoPieces.has(name)) {
      nextOmaTwoPieces.delete(name);
    } else if (selectedRelicSlots < 6) {
      nextOmaTwoPieces.add(name);
      rememberRecentRelicChoice({ kind: "omaTwoPiece", value: name });
    }
    commitRelicSuitSelection({
      fourPiece: selectedFourPiece,
      twoPieceAttributes: new Set(selectedTwoPieceAttributes),
      omaTwoPieces: nextOmaTwoPieces,
    });
  };
  const applyPanelShortcut = (
    values: Partial<Record<PanelConstraintKey, { min?: number; max?: number }>>,
  ) => {
    setConstraints((current) => {
      const entries = Object.entries(values) as [
        PanelConstraintKey,
        { min?: number; max?: number },
      ][];
      const isActive = entries.every(([key, range]) => {
        const currentRange = current[key];
        return (
          (range.min === undefined || currentRange?.min === range.min) &&
          (range.max === undefined || currentRange?.max === range.max)
        );
      });
      const next = { ...current };
      entries.forEach(([key, range]) => {
        const baseValue = hero?.baseStats[key] || 0;
        if (isActive) {
          next[key] = { min: baseValue, max: undefined };
          return;
        }
        const min = Math.max(range.min ?? baseValue, baseValue);
        const previous = current[key] || {};
        const max =
          range.max === undefined
            ? previous.max !== undefined && previous.max < min
              ? min
              : previous.max
            : Math.max(range.max, min);
        next[key] = { ...previous, min, max };
      });
      return next;
    });
  };
  const clearPanelConstraints = () => {
    setConstraints(basePanelConstraints(hero?.baseStats));
  };
  const updateExtraAttribute = (
    key: CalculatorExtraAttributeKey,
    value: number | null,
  ) => {
    setExtraAttributes((current) => {
      const next = { ...current };
      next[key] =
        value === null || !Number.isFinite(value)
          ? 0
          : Math.max(0, Number(value));
      return next;
    });
  };
  const clearExtraAttributes = () =>
    setExtraAttributes({ ...defaultExtraAttributes });
  const applySavedCalculatorConfig = (config: SavedCalculatorConfig) => {
    // Close the modal first. Mobile Safari can spend several frames rendering
    // the large calculator page after all configuration fields change at once.
    // Deferring the transition lets the tap finish and keeps the UI responsive.
    const apply = () => {
      startTransition(() => {
        if (config.heroId !== undefined) setHeroId(config.heroId);
        setMetric(config.metric);
        setResultLimit(Math.min(50, Math.max(1, config.resultLimit)));
        setConstraints(
          Object.fromEntries(
            Object.entries(config.constraints).map(([key, range]) => [
              key,
              { ...range },
            ]),
          ) as SavedCalculatorConfig["constraints"],
        );
        setExtraAttributes({ ...config.extraAttributes });
        setMainAttributes(
          Object.fromEntries(
            Object.entries(config.mainAttributes).map(([position, values]) => [
              position,
              [...(values || [])],
            ]),
          ) as SavedCalculatorConfig["mainAttributes"],
        );
        setRelicSuitSelection({
          fourPiece: config.relicSuitSelection.fourPiece,
          twoPieceAttributes: new Set(
            config.relicSuitSelection.twoPieceAttributes,
          ),
          omaTwoPieces: new Set(config.relicSuitSelection.omaTwoPieces),
        });
      });
    };
    if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
      window.requestAnimationFrame(apply);
    } else {
      globalThis.setTimeout(apply, 0);
    }
  };
  const openNewCalculatorConfig = () => {
    setCalculatorConfigLabel("");
    setSaveCalculatorConfigModalOpen(true);
  };
  const saveCalculatorConfig = () => {
    const label = calculatorConfigLabel.trim();
    if (!label) return;

    const id = `${Date.now()}-${label}`;
    const next: SavedCalculatorConfig = {
      id,
      label,
      heroId: hero?.id,
      metric,
      resultLimit,
      constraints: Object.fromEntries(
        Object.entries(constraints).map(([key, range]) => [key, { ...range }]),
      ) as SavedCalculatorConfig["constraints"],
      extraAttributes: { ...extraAttributes },
      mainAttributes: Object.fromEntries(
        Object.entries(mainAttributes).map(([position, values]) => [
          position,
          [...(values || [])],
        ]),
      ) as SavedCalculatorConfig["mainAttributes"],
      relicSuitSelection: {
        fourPiece: selectedFourPiece,
        twoPieceAttributes: [...selectedTwoPieceAttributes],
        omaTwoPieces: [...selectedOmaTwoPieces],
      },
    };
    setSavedCalculatorConfigs((current) => [...current, next]);
    setSaveCalculatorConfigModalOpen(false);
  };
  const deleteCalculatorConfig = (id: string) => {
    setSavedCalculatorConfigs((current) =>
      current.filter((config) => config.id !== id),
    );
  };
  const openNewShortcut = () => {
    setEditingShortcutId(undefined);
    setShortcutLabel("");
    setShortcutValues({});
    setShortcutModalOpen(true);
  };
  const openShortcutEditor = (shortcut: CustomPanelShortcut) => {
    setEditingShortcutId(shortcut.id);
    setShortcutLabel(shortcut.label);
    setShortcutValues(shortcut.values);
    setShortcutModalOpen(true);
  };
  const saveShortcut = () => {
    const label = shortcutLabel.trim();
    const values = Object.fromEntries(
      Object.entries(shortcutValues).filter(
        ([, value]) =>
          value && (Number.isFinite(value.min) || Number.isFinite(value.max)),
      ),
    ) as CustomPanelShortcut["values"];
    if (!label || !Object.keys(values).length) return;
    setCustomPanelShortcuts((current) => {
      const id = editingShortcutId || `${Date.now()}-${label}`;
      const next = { id, label, values };
      return editingShortcutId
        ? current.map((shortcut) =>
            shortcut.id === editingShortcutId ? next : shortcut,
          )
        : [...current, next];
    });
    setShortcutModalOpen(false);
  };
  const deleteShortcut = (id: string) => {
    setCustomPanelShortcuts((current) =>
      current.filter((shortcut) => shortcut.id !== id),
    );
    if (editingShortcutId === id) setShortcutModalOpen(false);
  };
  const run = () => {
    if (!hero || running || !hasCompleteMainAttributeSelection) return;
    const effectiveConstraints = Object.fromEntries(
      Object.entries(constraints).map(([rawKey, range]) => {
        const key = rawKey as PanelConstraintKey;
        const maximum = relicPanelCeiling(key, hero.baseStats[key]);
        // 上限展示为理论极限时不作为实际约束传给 Worker。
        const max =
          range?.max !== undefined && range.max < maximum
            ? range.max
            : undefined;
        return [key, { ...range, max }];
      }),
    );
    const effectiveResultLimit = fastMode ? 1 : resultLimit;
    // 纯属性指标在界面上不可编辑同名范围，但已保存的满暴等约束仍必须参与计算。
    // 否则切换到暴击指标后，暴击下限会在发给 Worker 前被错误移除。
    startCalculation({
      relicsByPosition: createCalculationRelics(relicsByPosition),
      baseStats: hero.baseStats,
      metric,
      filters: {
        quality: 6,
        level: 15,
        mainAttributes,
        selectedSuitNames,
        suitTwoPieceAttributes,
        requiredFourPiece: selectedFourPiece,
        requiredTwoPieceNames: selectedOmaTwoPieces,
        requiredTwoPieceAttributes: selectedTwoPieceAttributes,
        panelConstraints: effectiveConstraints,
        extraAttributes,
        fastMode,
      },
      resultLimit: effectiveResultLimit,
    });
  };

  const columns = createCalculatorResultColumns({
    metric,
    metricLabel,
    hero,
    results,
    panelFields,
    isActivePanelConstraint,
    onSelectResult: setSelectedResult,
  });

  // 弹窗只接收三个清晰的控制器，页面不再在 JSX 中堆叠数十个状态与回调字段。
  const calculatorConfigController: CalculatorConfigState = {
    saveOpen: saveCalculatorConfigModalOpen,
    libraryOpen: calculatorConfigLibraryOpen,
    label: calculatorConfigLabel,
    savedConfigs: savedCalculatorConfigs,
    getPreview: getCalculatorConfigPreview,
    apply: applySavedCalculatorConfig,
    remove: deleteCalculatorConfig,
    save: saveCalculatorConfig,
    setSaveOpen: setSaveCalculatorConfigModalOpen,
    setLibraryOpen: setCalculatorConfigLibraryOpen,
    setLabel: setCalculatorConfigLabel,
  };
  const mainShortcutController: MainShortcutState = {
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
  };
  const panelShortcutController: PanelShortcutState = {
    open: shortcutModalOpen,
    editingId: editingShortcutId,
    label: shortcutLabel,
    values: shortcutValues,
    baseStats: hero?.baseStats,
    fields: panelFields,
    shortcuts: customPanelShortcuts,
    setOpen: setShortcutModalOpen,
    setLabel: setShortcutLabel,
    setValues: setShortcutValues,
    save: saveShortcut,
    edit: openShortcutEditor,
    remove: deleteShortcut,
  };

  return (
    <div className="width result calculator-page">
      <CalculatorStaticUpdateModal
        report={staticUpdateReport}
        onClose={() => setStaticUpdateReport(undefined)}
      />
      <CalculatorRunningState
        state={{ running, fastMode }}
        progress={{
          calculationProgress,
          calculationStage,
          calculationProgressText,
        }}
        commands={{ onStop: stopCalculation }}
      />
      <CalculatorControls
        state={{
          running,
          heroName: hero?.name,
          metric,
          selectedSuitSummary,
          accountName: dataset.account?.name,
          serverName: dataset.account?.serverName,
          relicCount,
        }}
        options={{ metricOptions }}
        actions={{
          onOpenHeroPicker: () => setHeroModalOpen(true),
          onMetricChange: changeMetric,
          onOpenSuitPicker: () => setRelicModalOpen(true),
        }}
      />
      <CalculatorConstraints
        state={{
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
        }}
        options={{
          mainAttributePresets,
          mainAttributeOptions,
          panelShortcuts,
          panelFields,
          extraAttributeFields,
          savedCalculatorConfigs,
        }}
        actions={{
          applyMainPreset: applyMainAttributePreset,
          toggleMainAttribute,
          applyPanelShortcut,
          updateConstraintRange,
          updateExtraAttribute,
          setExtraAttributesOpen,
          setFastMode,
        }}
        commands={{
          openMainShortcut: openNewMainShortcut,
          openPanelShortcut: openNewShortcut,
          clearPanelConstraints,
          clearExtraAttributes,
          openConfigLibrary: () => {
            if (staticDataReady) setCalculatorConfigLibraryOpen(true);
          },
          openSaveConfig: () => {
            if (staticDataReady) openNewCalculatorConfig();
          },
          run,
        }}
      />
      <CalculatorConfigModals
        config={calculatorConfigController}
        mainShortcut={mainShortcutController}
        panelShortcut={panelShortcutController}
      />
      <CalculatorHeroPicker
        state={{
          open: heroModalOpen,
          search: heroSearch,
          selectedHeroId: heroId,
          disabled: running,
        }}
        options={{
          recentHeroes,
          heroGroups,
          rarityLabels,
        }}
        actions={{
          onSearchChange: setHeroSearch,
          onSelect: chooseHeroOption,
        }}
        commands={{ onClose: () => setHeroModalOpen(false) }}
      />
      <CalculatorSuitPicker
        state={{
          open: relicModalOpen,
          running,
          fourPiece: selectedFourPiece,
          twoPieceAttributes: selectedTwoPieceAttributes,
          omaTwoPieces: selectedOmaTwoPieces,
          selectedTwoPieceCount,
          selectedRelicSlots,
        }}
        options={{
          suitTypes,
          twoPieceGroups,
          omaSuits,
          recentChoices: availableRecentRelicChoices,
        }}
        actions={{
          onSelectFourPiece: selectFourPiece,
          onToggleTwoPieceAttribute: toggleTwoPieceAttribute,
          onToggleOmaTwoPiece: toggleOmaTwoPiece,
        }}
        commands={{ onClose: () => setRelicModalOpen(false) }}
      />
      <CalculatorResults
        state={{
          hero,
          metric,
          metricLabel,
          metricIsPanelField,
          results,
          selectedResult,
          running,
          elapsed,
          fastMode,
          resultLimit,
          selectedFourPiece,
          selectedTwoPieceAttributes,
          selectedOmaTwoPieces,
        }}
        options={{
          columns,
          panelFields,
          panelBadgeLabels,
        }}
        selectors={{
          isMetricPanelRelated: (key) =>
            metricPanelHighlights[metric].includes(key),
          isMetricSubAttribute,
          panelKeyForAttribute,
          isActivePanelConstraint,
        }}
        actions={{
          onResultLimitChange: setResultLimit,
          onSelectResult: setSelectedResult,
        }}
      />
      <CalculatorMethodInfo />
    </div>
  );
}
