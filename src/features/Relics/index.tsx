"use client";

import "./index.scss";
import { useEffect, useMemo, useState } from "react";
import {
  ClearOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from "@ant-design/icons";
import { Button, Card, Select, Tabs } from "antd";
import { RelicList } from "@/components/RelicList";
import { useAppSelector } from "@/store";
import {
  compareAttributeLabels,
  fixedMainAttributesByPosition,
  subAttributeSortOptions,
  variableMainPositions,
} from "@/lib/relics";
import type { RelicView } from "@/types";
import { RelicSuitPickerModal } from "./RelicSuitPickerModal";
import type { RelicSortDirection, RelicSuitOption } from "./index.types";

export function RelicsPage() {
  const dataset = useAppSelector((state) => state.app.dataset);
  const [activePosition, setActivePosition] = useState("1");
  const [selectedSuitNames, setSelectedSuitNames] = useState<string[]>([]);
  const [suitModalOpen, setSuitModalOpen] = useState(false);
  const [suitSearch, setSuitSearch] = useState("");
  const [mainAttribute, setMainAttribute] = useState<string>();
  const [subAttributes, setSubAttributes] = useState<string[]>([]);
  const [sortAttribute, setSortAttribute] = useState<string>();
  const [sortDirection, setSortDirection] =
    useState<RelicSortDirection>("desc");
  const relicsByPosition = useMemo(
    () => dataset.relicsByPosition || {},
    [dataset.relicsByPosition],
  );
  const allRelics = useMemo(
    () => Object.values(relicsByPosition).flat(),
    [relicsByPosition],
  );
  const mainAttributeOptions = useMemo(
    () =>
      [
        ...new Set(
          (relicsByPosition[activePosition] || [])
            .map((relic) => relic.mainAttribute?.label)
            .filter((label): label is string => Boolean(label)),
        ),
      ]
        .sort(compareAttributeLabels)
        .map((label) => ({ label, value: label })),
    [activePosition, relicsByPosition],
  );
  const subAttributeOptions = useMemo(
    () =>
      [
        ...new Set(
          allRelics.flatMap((relic) =>
            (relic.subAttributes || []).map((attribute) => attribute.label),
          ),
        ),
      ]
        .sort(compareAttributeLabels)
        .map((label) => ({ label, value: label })),
    [allRelics],
  );
  const suitItems = useMemo<RelicSuitOption[]>(
    () =>
      [
        ...new Map(
          allRelics
            .filter((relic) => relic.suit?.name)
            .map((relic) => [relic.suit!.name, relic.suit!] as const),
        ).values(),
      ].sort((left, right) => left.name.localeCompare(right.name, "zh-CN")),
    [allRelics],
  );
  const visibleSuitItems = useMemo(() => {
    const keyword = suitSearch.trim().toLowerCase();
    if (!keyword) return suitItems;
    return suitItems.filter((suit) =>
      suit.name.toLowerCase().includes(keyword),
    );
  }, [suitItems, suitSearch]);
  const filteredByPosition = useMemo(
    () =>
      Object.fromEntries(
        [1, 2, 3, 4, 5, 6].map((position) => {
          const items = relicsByPosition[String(position)] || [];
          return [
            String(position),
            items
              .filter((relic) => {
                if (
                  variableMainPositions.has(position) &&
                  mainAttribute &&
                  relic.mainAttribute?.label !== mainAttribute
                )
                  return false;
                if (
                  selectedSuitNames.length > 0 &&
                  !selectedSuitNames.includes(relic.suit?.name || "")
                )
                  return false;
                const labels = new Set(
                  (relic.subAttributes || []).map(
                    (attribute) => attribute.label,
                  ),
                );
                return subAttributes.every((label) => labels.has(label));
              })
              .sort((left, right) => {
                if (!sortAttribute) return 0;
                const valueOf = (relic: RelicView) =>
                  (relic.subAttributes || [])
                    .filter((attribute) => attribute.label === sortAttribute)
                    .reduce((sum, attribute) => sum + attribute.value, 0);
                const delta = valueOf(left) - valueOf(right);
                return sortDirection === "desc" ? -delta : delta;
              }),
          ];
        }),
      ) as Record<string, RelicView[]>,
    [
      mainAttribute,
      relicsByPosition,
      selectedSuitNames,
      sortAttribute,
      sortDirection,
      subAttributes,
    ],
  );

  useEffect(() => {
    const position = Number(activePosition);
    if (!variableMainPositions.has(position)) {
      setMainAttribute(undefined);
      return;
    }
    if (
      mainAttribute &&
      !mainAttributeOptions.some((option) => option.value === mainAttribute)
    )
      setMainAttribute(undefined);
  }, [activePosition, mainAttribute, mainAttributeOptions]);

  useEffect(() => {
    const availableNames = new Set(suitItems.map((suit) => suit.name));
    setSelectedSuitNames((current) =>
      current.filter((name) => availableNames.has(name)),
    );
  }, [suitItems]);

  const handleSubAttributeChange = (nextAttributes: string[]) => {
    const newlySelected = nextAttributes.find(
      (attribute) => !subAttributes.includes(attribute),
    );

    setSubAttributes(nextAttributes);
    if (!sortAttribute && newlySelected) {
      setSortAttribute(newlySelected);
      setSortDirection("desc");
    }
  };

  const handleSortAttributeChange = (nextAttribute?: string) => {
    setSortAttribute(nextAttribute);
    if (nextAttribute) setSortDirection("desc");
  };

  return (
    <div className="width result relic-page">
      <div className="page-heading">
        <div>
          <span className="page-kicker">库存明细</span>
          <h1>全部御魂</h1>
        </div>
        <span>{allRelics.length.toLocaleString("zh-CN")} 件</span>
      </div>
      <Card className="relic-panel">
        <div className="relic-filters">
          <Button
            className="relic-filter relic-filter-suit relic-filter-suit-trigger"
            onClick={() => setSuitModalOpen(true)}
          >
            {selectedSuitNames.length
              ? `已选 ${selectedSuitNames.length} 种御魂`
              : "御魂种类"}
          </Button>
          {variableMainPositions.has(Number(activePosition)) ? (
            <Select
              allowClear
              showSearch={false}
              className="relic-filter"
              placeholder="主属性"
              optionFilterProp="label"
              value={mainAttribute}
              options={mainAttributeOptions}
              onChange={setMainAttribute}
            />
          ) : (
            <div className="fixed-main-attribute" aria-label="固定主属性">
              <span>主属性</span>
              <strong>
                {fixedMainAttributesByPosition[Number(activePosition)] || "-"}
              </strong>
            </div>
          )}
          <Select
            allowClear
            showSearch={false}
            mode="multiple"
            maxTagCount="responsive"
            className="relic-filter relic-filter-sub"
            placeholder="副属性（多选为同时包含）"
            optionFilterProp="label"
            value={subAttributes}
            options={subAttributeOptions}
            onChange={handleSubAttributeChange}
          />
          <Select
            allowClear
            showSearch={false}
            className="relic-filter relic-filter-sort"
            placeholder="副属性排序"
            optionFilterProp="label"
            value={sortAttribute}
            options={subAttributeSortOptions}
            onChange={handleSortAttributeChange}
          />
          <Button
            className="relic-sort-direction"
            icon={
              sortDirection === "desc" ? (
                <SortDescendingOutlined />
              ) : (
                <SortAscendingOutlined />
              )
            }
            title={sortDirection === "desc" ? "降序" : "升序"}
            disabled={!sortAttribute}
            onClick={() =>
              setSortDirection((current) =>
                current === "desc" ? "asc" : "desc",
              )
            }
          />
          <Button
            className="relic-clear"
            icon={<ClearOutlined />}
            title="清除筛选"
            disabled={
              selectedSuitNames.length === 0 &&
              !mainAttribute &&
              subAttributes.length === 0 &&
              !sortAttribute
            }
            onClick={() => {
              setSelectedSuitNames([]);
              setMainAttribute(undefined);
              setSubAttributes([]);
              setSortAttribute(undefined);
              setSortDirection("desc");
            }}
          />
        </div>
        <Tabs
          activeKey={activePosition}
          onChange={setActivePosition}
          items={[1, 2, 3, 4, 5, 6].map((position) => ({
            key: String(position),
            label: (
              <span className="position-tab-label">
                <span>{position}号位</span>
                <span className="position-tab-count">
                  {" "}
                  ({filteredByPosition[String(position)]?.length || 0}/
                  {relicsByPosition[String(position)]?.length || 0})
                </span>
              </span>
            ),
            children: (
              <RelicList
                key={`${position}-${selectedSuitNames.join("-") || "all"}-${mainAttribute || "all"}-${subAttributes.join("-")}-${sortAttribute || "default"}-${sortDirection}`}
                items={filteredByPosition[String(position)] || []}
                highlightedSubAttributes={subAttributes}
              />
            ),
          }))}
        />
      </Card>
      <RelicSuitPickerModal
        open={suitModalOpen}
        search={suitSearch}
        options={visibleSuitItems}
        selectedSuitNames={selectedSuitNames}
        onSearchChange={setSuitSearch}
        onToggleSuit={(suitName) => {
          setSelectedSuitNames((current) =>
            current.includes(suitName)
              ? current.filter((name) => name !== suitName)
              : [...current, suitName],
          );
        }}
        onClose={() => setSuitModalOpen(false)}
      />
    </div>
  );
}
