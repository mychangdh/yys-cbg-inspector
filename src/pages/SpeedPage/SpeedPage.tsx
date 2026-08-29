import "./SpeedPage.scss";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  CalculatorOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Empty,
  Modal,
  Select,
  Spin,
  Switch,
  Table,
  Tabs,
  Tooltip,
} from "antd";
import { RelicList } from "../../components/RelicList/RelicList";
import { assetUrl } from "../../lib/assetUrl";
import {
  getBestSpeedCombinationForSuit,
  getFullSpeedRelics,
  getRelicSubAttributeTotals,
  type RelicEvidence,
} from "../../lib/accountAnalysis";
import type { RelicDataset, RelicView } from "../../types";

const pvpSuitNames = [
  "招财猫",
  "火灵",
  "蚌精",
  "返魂香",
  "魅妖",
  "钟灵",
  "共潜",
  "遗念火",
  "雪幽魂",
  "油赤子",
  "木魅",
];

const pvpSuitSelectionStoragePrefix =
  "yys-cbg-inspector.speed.pvp-suit-selection:";

function getPvpSuitSelectionStorageKey(dataset: RelicDataset) {
  const accountKey =
    dataset.account.sourceUrl ||
    dataset.account.name ||
    dataset.account.title ||
    "default";
  return pvpSuitSelectionStoragePrefix + accountKey;
}

function loadPvpSuitSelection(storageKey: string) {
  if (typeof window === "undefined") return pvpSuitNames;

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(storageKey) || "null",
    );
    return Array.isArray(stored)
      ? stored.filter((name): name is string => typeof name === "string")
      : pvpSuitNames;
  } catch {
    return pvpSuitNames;
  }
}

function speedOf(relic: RelicView) {
  return getRelicSubAttributeTotals(relic).speed || 0;
}

function displayMainAttribute(position: number, mainAttribute?: string) {
  if (position !== 4 && position !== 6) return "";
  return mainAttribute ? " · " + mainAttribute : "";
}

function displayPvpDetailLabel(relic: RelicEvidence, suitName: string) {
  const mainAttribute = displayMainAttribute(
    relic.position,
    relic.mainAttribute,
  );
  if (relic.suitName === suitName) return mainAttribute;
  return mainAttribute
    ? mainAttribute + " · " + relic.suitName
    : " · " + relic.suitName;
}

type SpeedCombinationPreview = {
  relics: RelicView[];
  speed: number;
};

type SpeedCombinationOptions = {
  fourthMainAttributes?: readonly string[];
  sixthMainAttributes?: readonly string[];
};

const fourthMainAttributeOptions = [
  ...["攻击加成", "生命加成", "防御加成", "效果命中", "效果抵抗"].map(
    (value) => ({ label: value, value }),
  ),
];

const sixthMainAttributeOptions = [
  ...["攻击加成", "生命加成", "防御加成", "暴击", "暴击伤害"].map((value) => ({
    label: value,
    value,
  })),
];

function getTopSpeedCombinations(
  dataset: RelicDataset,
  { fourthMainAttributes, sixthMainAttributes }: SpeedCombinationOptions = {},
): SpeedCombinationPreview[] {
  const candidatesByPosition = [1, 2, 3, 4, 5, 6].map((position) =>
    (dataset.relicsByPosition[String(position)] || [])
      .filter((relic) => relic.quality === 6 && relic.level === 15)
      .filter(
        (relic) => position !== 2 || relic.mainAttribute?.label === "速度",
      )
      .filter(
        (relic) =>
          !fourthMainAttributes?.length ||
          position !== 4 ||
          fourthMainAttributes.includes(relic.mainAttribute?.label || ""),
      )
      .filter(
        (relic) =>
          !sixthMainAttributes?.length ||
          position !== 6 ||
          sixthMainAttributes.includes(relic.mainAttribute?.label || ""),
      )
      .sort((left, right) => speedOf(right) - speedOf(left))
      .slice(0, 5),
  );

  if (candidatesByPosition.some((candidates) => !candidates.length)) return [];

  const usedRelics = new Set<RelicView>();
  const combinations: SpeedCombinationPreview[] = [];

  for (let rank = 0; rank < 5; rank += 1) {
    const relics = candidatesByPosition.map((candidates) =>
      candidates.find((relic) => !usedRelics.has(relic)),
    );
    if (relics.some((relic) => !relic)) break;

    const selectedRelics = relics as RelicView[];
    selectedRelics.forEach((relic) => usedRelics.add(relic));
    combinations.push({
      relics: selectedRelics,
      speed: selectedRelics.reduce(
        (total, relic) => total + speedOf(relic),
        57,
      ),
    });
  }

  return combinations;
}

function PositionSpeedDetails({
  relics,
  highlightedMainAttributes = {},
}: {
  relics: RelicView[];
  highlightedMainAttributes?: Record<number, readonly string[] | undefined>;
}) {
  return (
    <div className="speed-combination-positions">
      {relics.map((relic) => (
        <span
          className={
            highlightedMainAttributes[relic.position || 0]?.includes(
              relic.mainAttribute?.label || "",
            )
              ? "is-tail"
              : ""
          }
          key={relic.id || String(relic.position)}
        >
          {speedOf(relic).toFixed(2)}
          {displayMainAttribute(
            relic.position || 0,
            relic.mainAttribute?.label,
          )}
        </span>
      ))}
    </div>
  );
}

function PvpPositionSpeedDetails({
  relics,
  suitName,
}: {
  relics: RelicEvidence[];
  suitName: string;
}) {
  return (
    <div className="speed-combination-positions">
      {relics.map((relic) => (
        <span
          className={relic.suitName === suitName ? "is-target-suit" : ""}
          key={relic.relicId || String(relic.position)}
        >
          {relic.value.toFixed(2)}
          {displayPvpDetailLabel(relic, suitName)}
        </span>
      ))}
    </div>
  );
}

function FullSpeedCompactList({
  items,
  highlightedSuitNames,
}: {
  items: RelicView[];
  highlightedSuitNames: string[];
}) {
  const highlightedSuitNameSet = new Set(highlightedSuitNames);

  return (
    <div className="full-speed-compact-list">
      {items.map((relic) => {
        const mainAttributeLabel = relic.mainAttribute?.label;
        return (
          <div
            className={
              "full-speed-compact-row" +
              (highlightedSuitNameSet.has(relic.suit?.name || "")
                ? " is-highlighted-suit"
                : "")
            }
            key={relic.id}
          >
            <span>
              <strong>{relic.suit?.name || "未知御魂"}</strong>
              {mainAttributeLabel && <small>[{mainAttributeLabel}]</small>}
            </span>
            <b>{speedOf(relic).toFixed(2)}</b>
          </div>
        );
      })}
    </div>
  );
}

function CollapseControl({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip title={collapsed ? "展开" : "收起"}>
      <Button
        aria-label={collapsed ? "展开" : "收起"}
        className="speed-collapse-control"
        icon={collapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
        size="small"
        type="text"
        onClick={onToggle}
      />
    </Tooltip>
  );
}

function DetailToggle({
  checked,
  className,
  onChange,
}: {
  checked: boolean;
  className: string;
  onChange: (checked: boolean) => void;
}) {
  const toggle = () => onChange(!checked);

  return (
    <div
      aria-checked={checked}
      className={`${className} speed-detail-toggle-trigger`}
      role="switch"
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggle();
      }}
    >
      <Switch
        checked={checked}
        size="small"
        onClick={(_, event) => event.stopPropagation()}
        onChange={onChange}
      />
      <span className="speed-detail-toggle-label">详细信息</span>
    </div>
  );
}

function CollapsiblePanelTitle({
  title,
  collapsed,
  onToggle,
  onPointerDown,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  onPointerDown?: () => void;
}) {
  return (
    <button
      aria-expanded={!collapsed}
      className="speed-panel-title-trigger"
      type="button"
      onPointerDown={onPointerDown}
      onClick={onToggle}
    >
      <span>{title}</span>
    </button>
  );
}

function CollapsiblePanelContent({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={
        "speed-collapsible-content" + (collapsed ? " is-collapsed" : "")
      }
    >
      <div>{children}</div>
    </div>
  );
}

export function SpeedPage({
  dataset,
  onOpenCalculator,
}: {
  dataset: RelicDataset;
  onOpenCalculator: () => void;
}) {
  const [showFullSpeedDetails, setShowFullSpeedDetails] = useState(false);
  const [showPvpDetails, setShowPvpDetails] = useState(false);
  const [showCustomSpeedDetails, setShowCustomSpeedDetails] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({
    combinations: false,
    pvp: false,
    fullSpeed: false,
  });
  const [customFourthMainAttributes, setCustomFourthMainAttributes] =
    useState<string[]>([]);
  const [customSixthMainAttributes, setCustomSixthMainAttributes] =
    useState<string[]>([]);
  const pvpSuitSelectionStorageKey = useMemo(
    () => getPvpSuitSelectionStorageKey(dataset),
    [dataset],
  );
  const [selectedPvpSuitNames, setSelectedPvpSuitNames] = useState<string[]>(
    () => loadPvpSuitSelection(getPvpSuitSelectionStorageKey(dataset)),
  );
  const [pvpSuitModalOpen, setPvpSuitModalOpen] = useState(false);
  const [pvpFourthMainAttributes, setPvpFourthMainAttributes] =
    useState<string[]>([]);
  const [pvpSixthMainAttributes, setPvpSixthMainAttributes] =
    useState<string[]>([]);
  const [openMainAttributeSelect, setOpenMainAttributeSelect] = useState<
    string | null
  >(null);
  const openMainAttributeSelectRef = useRef<string | null>(null);
  const suppressNextPanelToggleRef = useRef(false);
  const [fullSpeedRelics, setFullSpeedRelics] = useState<RelicView[]>([]);
  const [pvpSpeedCombinations, setPvpSpeedCombinations] = useState<
    Array<{
      suitName: string;
      combination: NonNullable<
        ReturnType<typeof getBestSpeedCombinationForSuit>
      >;
    }>
  >([]);
  const [customSpeedCombinations, setCustomSpeedCombinations] = useState<
    SpeedCombinationPreview[]
  >([]);
  const [speedCalculating, setSpeedCalculating] = useState(false);
  const speedCalculationRunRef = useRef(0);
  const pvpSuitOptions = useMemo(() => {
    const suitsByName = new Map<string, NonNullable<RelicView["suit"]>>();

    Object.values(dataset.relicsByPosition || {})
      .flat()
      .forEach((relic) => {
        const suit = relic.suit;
        if (!suit || suit.isTwoPieceSet || relic.setBonusAttribute) return;
        suitsByName.set(suit.name, suit);
      });

    return [...suitsByName.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "zh-CN"),
    );
  }, [dataset]);
  useEffect(() => {
    setSelectedPvpSuitNames(loadPvpSuitSelection(pvpSuitSelectionStorageKey));
  }, [pvpSuitSelectionStorageKey]);
  useEffect(() => {
    const availableSuitNames = new Set(pvpSuitOptions.map((suit) => suit.name));
    setSelectedPvpSuitNames((current) =>
      current.filter((suitName) => availableSuitNames.has(suitName)),
    );
  }, [pvpSuitOptions]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        pvpSuitSelectionStorageKey,
        JSON.stringify(selectedPvpSuitNames),
      );
    } catch {
      // 本地存储不可用时，当前页面内的选择仍然有效。
    }
  }, [pvpSuitSelectionStorageKey, selectedPvpSuitNames]);
  useEffect(() => {
    const requestId = speedCalculationRunRef.current + 1;
    speedCalculationRunRef.current = requestId;
    setSpeedCalculating(true);

    const timer = window.setTimeout(() => {
      try {
        const relicById = new Map(
          Object.values(dataset.relicsByPosition || {})
            .flat()
            .map((relic) => [relic.id, relic]),
        );
        const nextFullSpeedRelics = getFullSpeedRelics(dataset)
          .map((evidence) => relicById.get(evidence.relicId))
          .filter((relic): relic is RelicView => Boolean(relic))
          .sort((left, right) => speedOf(right) - speedOf(left));
        const nextPvpSpeedCombinations = selectedPvpSuitNames
          .flatMap((suitName) => {
            const combination = getBestSpeedCombinationForSuit(
              dataset,
              suitName,
              {
                fourthMainAttributes: pvpFourthMainAttributes,
                sixthMainAttributes: pvpSixthMainAttributes,
              },
            );
            return combination ? [{ suitName, combination }] : [];
          })
          .sort(
            (left, right) => right.combination.value - left.combination.value,
          );
        const nextCustomSpeedCombinations = getTopSpeedCombinations(dataset, {
          fourthMainAttributes: customFourthMainAttributes,
          sixthMainAttributes: customSixthMainAttributes,
        });

        if (speedCalculationRunRef.current !== requestId) return;
        setFullSpeedRelics(nextFullSpeedRelics);
        setPvpSpeedCombinations(nextPvpSpeedCombinations);
        setCustomSpeedCombinations(nextCustomSpeedCombinations);
      } catch {
        if (speedCalculationRunRef.current !== requestId) return;
        setFullSpeedRelics([]);
        setPvpSpeedCombinations([]);
        setCustomSpeedCombinations([]);
      } finally {
        if (speedCalculationRunRef.current === requestId)
          setSpeedCalculating(false);
      }
    }, 16);

    return () => window.clearTimeout(timer);
  }, [
    customFourthMainAttributes,
    customSixthMainAttributes,
    dataset,
    pvpFourthMainAttributes,
    pvpSixthMainAttributes,
    selectedPvpSuitNames,
  ]);
  const fullSpeedRelicsByPosition = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6]
        .map((position) => ({
          position,
          relics: fullSpeedRelics.filter(
            (relic) =>
              relic.position === position &&
              (position !== 2 || relic.mainAttribute?.label === "速度"),
          ),
        }))
        .filter((group) => group.relics.length > 0),
    [fullSpeedRelics],
  );
  const customCombinationColumns = [
    {
      title: "套装类型",
      render: (_: unknown, _record: SpeedCombinationPreview, index: number) =>
        ["一", "二", "三", "四", "五"][index] + "速",
    },
    {
      title: "一速",
      dataIndex: "speed",
      render: (speed: number) => speed.toFixed(2),
    },
    {
      title: "各位置最高速，橙色为已选主属性",
      render: (_: unknown, record: SpeedCombinationPreview) => (
        <PositionSpeedDetails
          relics={record.relics}
          highlightedMainAttributes={{
            4: customFourthMainAttributes,
            6: customSixthMainAttributes,
          }}
        />
      ),
    },
  ];
  const pvpCombinationColumns = [
    {
      title: "套装类型",
      dataIndex: "suitName",
    },
    {
      title: "一速",
      render: (_: unknown, record: (typeof pvpSpeedCombinations)[number]) =>
        (record.combination.value + 57).toFixed(2),
    },
    {
      title: "各位置最高速，橙色为套装",
      render: (_: unknown, record: (typeof pvpSpeedCombinations)[number]) => (
        <PvpPositionSpeedDetails
          relics={record.combination.relics}
          suitName={record.suitName}
        />
      ),
    },
  ];
  const setMainAttributeSelectOpen = (selectId: string | null) => {
    openMainAttributeSelectRef.current = selectId;
    setOpenMainAttributeSelect(selectId);
  };
  const handlePanelTitlePointerDown = () => {
    if (!openMainAttributeSelectRef.current) return;
    // 下拉在点击标题栏时会先关闭；在按下阶段记录本次点击，阻止后续 click 折叠面板。
    suppressNextPanelToggleRef.current = true;
    setMainAttributeSelectOpen(null);
  };
  const toggleSection = (section: keyof typeof collapsedSections) => {
    if (suppressNextPanelToggleRef.current) {
      suppressNextPanelToggleRef.current = false;
      return;
    }
    if (openMainAttributeSelectRef.current) {
      setMainAttributeSelectOpen(null);
      return;
    }
    setCollapsedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  return (
    <div className="width result speed-page">
      {speedCalculating ? (
        <div
          className="speed-calculation-loading"
          role="status"
          aria-live="polite"
        >
          <Spin size="large" />
          <span>正在计算速度组合</span>
        </div>
      ) : null}
      <div className="page-heading">
        <div>
          <span className="page-kicker">PVP 速度资产</span>
          <h1>速度盘点</h1>
        </div>
        <span>{fullSpeedRelics.length} 件满速御魂</span>
      </div>

      <div className="speed-display-content">
        <Card
          className={
            "speed-panel speed-pvp-panel" +
            (collapsedSections.pvp ? " is-collapsed" : "")
          }
          title={
            <CollapsiblePanelTitle
              collapsed={collapsedSections.pvp}
              title="常用 PVP 套件速度"
              onPointerDown={handlePanelTitlePointerDown}
              onToggle={() => toggleSection("pvp")}
            />
          }
          extra={
            <div className="speed-pvp-panel-extra">
              <DetailToggle
                checked={showPvpDetails}
                className="speed-pvp-detail-toggle"
                onChange={setShowPvpDetails}
              />
              <CollapseControl
                collapsed={collapsedSections.pvp}
                onToggle={() => toggleSection("pvp")}
              />
            </div>
          }
        >
          <CollapsiblePanelContent collapsed={collapsedSections.pvp}>
            <>
              <div className="speed-pvp-controls">
                <Button
                  className="speed-pvp-suit-trigger"
                  type="default"
                  onClick={() => setPvpSuitModalOpen(true)}
                >
                  {selectedPvpSuitNames.length
                    ? `已选 ${selectedPvpSuitNames.length} 个四件套`
                    : "选择四件套"}
                </Button>
                <Select
                  allowClear
                  maxTagCount="responsive"
                  mode="multiple"
                  options={fourthMainAttributeOptions}
                  placeholder="4号位主属性"
                  showSearch={false}
                  value={pvpFourthMainAttributes}
                  open={openMainAttributeSelect === "pvp-fourth"}
                  onOpenChange={(open) =>
                    setMainAttributeSelectOpen(open ? "pvp-fourth" : null)
                  }
                  onChange={setPvpFourthMainAttributes}
                />
                <Select
                  allowClear
                  maxTagCount="responsive"
                  mode="multiple"
                  options={sixthMainAttributeOptions}
                  placeholder="6号位主属性"
                  showSearch={false}
                  value={pvpSixthMainAttributes}
                  open={openMainAttributeSelect === "pvp-sixth"}
                  onOpenChange={(open) =>
                    setMainAttributeSelectOpen(open ? "pvp-sixth" : null)
                  }
                  onChange={setPvpSixthMainAttributes}
                />
              </div>
              {pvpSpeedCombinations.length ? (
                <>
                  <Table
                    className="speed-suit-table"
                    columns={pvpCombinationColumns}
                    dataSource={pvpSpeedCombinations}
                    pagination={false}
                    rowKey="suitName"
                    size="small"
                  />
                  <div
                    className={
                      "speed-suit-mobile-list" +
                      (showPvpDetails ? " is-detailed" : "")
                    }
                  >
                    {pvpSpeedCombinations.map(({ suitName, combination }) => (
                      <div className="speed-suit-mobile-row" key={suitName}>
                        <div className="speed-suit-mobile-row-heading">
                          <strong>{suitName}</strong>
                          <span>{(combination.value + 57).toFixed(2)}</span>
                        </div>
                        <div
                          aria-hidden={!showPvpDetails}
                          className={
                            "speed-suit-mobile-details" +
                            (showPvpDetails ? " is-visible" : "")
                          }
                        >
                          {combination.relics.map((relic) => (
                            <span
                              className={
                                relic.suitName === suitName
                                  ? "is-target-suit"
                                  : ""
                              }
                              key={relic.relicId || String(relic.position)}
                            >
                              <span className="speed-mobile-detail-heading">
                                <small>{relic.position}号位</small>
                                <b>{relic.value.toFixed(2)}</b>
                              </span>
                              {(relic.position === 4 ||
                                relic.position === 6) && (
                                <em>{relic.mainAttribute || "主属性未知"}</em>
                              )}
                              <i>{relic.suitName}</i>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <Empty description="没有可凑成四件套的六星 +15 御魂" />
              )}
            </>
          </CollapsiblePanelContent>
        </Card>
        <Modal
          className="speed-pvp-suit-modal"
          footer={
            <Button type="primary" onClick={() => setPvpSuitModalOpen(false)}>
              完成
            </Button>
          }
          open={pvpSuitModalOpen}
          rootClassName="speed-page-modal"
          title="选择四件套"
          width={760}
          onCancel={() => setPvpSuitModalOpen(false)}
        >
          <div className="speed-pvp-suit-picker" aria-label="选择御魂套件">
            {pvpSuitOptions.map((suit) => {
              const selected = selectedPvpSuitNames.includes(suit.name);

              return (
                <button
                  aria-pressed={selected}
                  className={selected ? "is-selected" : ""}
                  key={suit.id}
                  type="button"
                  onClick={() => {
                    setSelectedPvpSuitNames((current) =>
                      current.includes(suit.name)
                        ? current.filter((name) => name !== suit.name)
                        : [...current, suit.name],
                    );
                  }}
                >
                  <img alt="" src={assetUrl(`suits/${suit.id}.png`)} />
                  <span>{suit.name}</span>
                </button>
              );
            })}
          </div>
        </Modal>
        <Card
          className={
            "speed-panel speed-combination-panel" +
            (collapsedSections.combinations ? " is-collapsed" : "")
          }
          title={
            <CollapsiblePanelTitle
              collapsed={collapsedSections.combinations}
              title="一速组合"
              onPointerDown={handlePanelTitlePointerDown}
              onToggle={() => toggleSection("combinations")}
            />
          }
          extra={
            <div className="speed-combination-panel-extra">
              <DetailToggle
                checked={showCustomSpeedDetails}
                className="speed-combination-detail-toggle"
                onChange={setShowCustomSpeedDetails}
              />
              <CollapseControl
                collapsed={collapsedSections.combinations}
                onToggle={() => toggleSection("combinations")}
              />
            </div>
          }
        >
          <CollapsiblePanelContent collapsed={collapsedSections.combinations}>
            <>
              <section>
                <div className="speed-custom-heading">
                  <h2>主属性一速</h2>
                  <div className="speed-custom-controls">
                    <Select
                      allowClear
                      maxTagCount="responsive"
                      mode="multiple"
                      options={fourthMainAttributeOptions}
                      placeholder="4号位主属性"
                      showSearch={false}
                      value={customFourthMainAttributes}
                      open={openMainAttributeSelect === "custom-fourth"}
                      onOpenChange={(open) =>
                        setMainAttributeSelectOpen(
                          open ? "custom-fourth" : null,
                        )
                      }
                      onChange={setCustomFourthMainAttributes}
                    />
                    <Select
                      allowClear
                      maxTagCount="responsive"
                      mode="multiple"
                      options={sixthMainAttributeOptions}
                      placeholder="6号位主属性"
                      showSearch={false}
                      value={customSixthMainAttributes}
                      open={openMainAttributeSelect === "custom-sixth"}
                      onOpenChange={(open) =>
                        setMainAttributeSelectOpen(
                          open ? "custom-sixth" : null,
                        )
                      }
                      onChange={setCustomSixthMainAttributes}
                    />
                  </div>
                </div>
                <Table
                  className="speed-custom-table"
                  columns={customCombinationColumns}
                  dataSource={customSpeedCombinations}
                  pagination={false}
                  rowKey={(record) =>
                    record.relics
                      .map((relic) => relic.id || relic.position)
                      .join("-")
                  }
                  size="small"
                />
                <div
                  className={
                    "speed-custom-mobile-list" +
                    (showCustomSpeedDetails ? " is-detailed" : "")
                  }
                >
                  {customSpeedCombinations.map((combination, index) => (
                    <div
                      className="speed-custom-mobile-row"
                      key={combination.relics
                        .map((relic) => relic.id || relic.position)
                        .join("-")}
                    >
                      <div className="speed-custom-mobile-row-heading">
                        <strong>{index + 1 + "速"}</strong>
                        <span>{combination.speed.toFixed(2)}</span>
                      </div>
                      <div
                        aria-hidden={!showCustomSpeedDetails}
                        className={
                          "speed-custom-mobile-details" +
                          (showCustomSpeedDetails ? " is-visible" : "")
                        }
                      >
                        {combination.relics.map((relic) => (
                          <span
                            className={
                              (customFourthMainAttributes.length > 0 &&
                                relic.position === 4 &&
                                customFourthMainAttributes.includes(
                                  relic.mainAttribute?.label || "",
                                )) ||
                              (customSixthMainAttributes.length > 0 &&
                                relic.position === 6 &&
                                customSixthMainAttributes.includes(
                                  relic.mainAttribute?.label || "",
                                ))
                                ? "is-tail"
                                : ""
                            }
                            key={relic.id || String(relic.position)}
                          >
                            <span className="speed-mobile-detail-heading">
                              <small>{relic.position}号位</small>
                              <b>{speedOf(relic).toFixed(2)}</b>
                            </span>
                            {(relic.position === 4 || relic.position === 6) && (
                              <em>
                                {relic.mainAttribute?.label || "主属性未知"}
                              </em>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          </CollapsiblePanelContent>
        </Card>

        <Card
          className={
            "speed-panel speed-full-panel" +
            (collapsedSections.fullSpeed ? " is-collapsed" : "")
          }
          title={
            <CollapsiblePanelTitle
              collapsed={collapsedSections.fullSpeed}
              title={"全部满速御魂（" + fullSpeedRelics.length + "）"}
              onPointerDown={handlePanelTitlePointerDown}
              onToggle={() => toggleSection("fullSpeed")}
            />
          }
          extra={
            <div className="speed-detail-toggle">
              <DetailToggle
                checked={showFullSpeedDetails}
                className="speed-full-detail-toggle"
                onChange={setShowFullSpeedDetails}
              />
              <CollapseControl
                collapsed={collapsedSections.fullSpeed}
                onToggle={() => toggleSection("fullSpeed")}
              />
            </div>
          }
        >
          <CollapsiblePanelContent collapsed={collapsedSections.fullSpeed}>
            {fullSpeedRelics.length ? (
              <Tabs
                className="speed-full-relic-tabs"
                items={fullSpeedRelicsByPosition.map(
                  ({ position, relics }) => ({
                    key: String(position),
                    label: (
                      <span className="speed-position-tab-label">
                        <span>{position}号位</span>
                        <small>（{relics.length}）</small>
                      </span>
                    ),
                    children: showFullSpeedDetails ? (
                      <RelicList
                        items={relics}
                        highlightedSubAttributes={["速度"]}
                        highlightedSuitNames={selectedPvpSuitNames}
                        hiddenMainAttributePositions={[2]}
                        desktopColumns={3}
                        desktopRows={5}
                      />
                    ) : (
                      <FullSpeedCompactList
                        highlightedSuitNames={selectedPvpSuitNames}
                        items={relics}
                      />
                    ),
                  }),
                )}
              />
            ) : (
              <Empty description="当前账号没有符合满速条件的御魂" />
            )}
          </CollapsiblePanelContent>
        </Card>
      </div>
      <div className="speed-calculator-footer">
        <span>需要更详细的御魂计算可以</span>
        <Button type="link" onClick={onOpenCalculator}>
          前往御魂计算器
        </Button>
      </div>
    </div>
  );
}
