import "./index.scss";
import {
  Button,
  Dropdown,
  Input,
  Modal,
  Segmented,
  Select,
  Switch,
  Table,
  message,
} from "antd";
import { useNavigate } from "react-router-dom";
import {
  CloudDownloadOutlined,
  DownloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import * as XLSX from "xlsx";
import bundledHeroes from "@/data/heroes.json";
import bundledRelicSuits from "@/data/relic-suits.json";
import { assetUrl } from "@/lib/assetUrl";
import {
  getStaticRefreshRemaining,
  markStaticRefresh,
} from "@/lib/staticRefresh";
import {
  loadHeroPanels,
  loadRelicSuits,
  saveStaticData,
} from "@/lib/staticApi";
import {
  incrementCalculatorStaticRefreshRequestId,
  setStaticAssetPreview,
  setStaticDataLoading,
  useAppDispatch,
  useAppSelector,
} from "@/store";

type FileKey = "heroes" | "relic-suits";
type CellValue = string | number | boolean;
type SheetRow = Record<string, CellValue> & { __key: string };
type HeroRecord = Record<string, unknown>;
type PendingConfirmation =
  | { action: "reset" }
  | { action: "delete"; rowKey: string; rowName: string }
  | null;
type RelicSuitsDocument = {
  yuhun_list?: unknown[][];
  two_suit_yuhun?: Record<string, string>;
  [key: string]: unknown;
};
type HeroStaticPayload = {
  heroesById?: Record<string, { id?: number }>;
};
type RelicSuitStaticPayload = {
  yuhun_list?: Array<[number, ...unknown[]]>;
};

const heroBaseFields = [
  "attack",
  "health",
  "defense",
  "speed",
  "critRate",
  "critDamage",
  "effectHit",
  "effectResistance",
] as const;
const normalTwoPieceOptions = [
  "攻击加成15%",
  "生命加成15%",
  "防御加成30%",
  "暴击15%",
  "暴击伤害20%",
  "效果命中15%",
  "效果抵抗15%",
];
const fieldLabels: Record<string, string> = {
  id: "编号",
  name: "名称",
  level: "稀有度",
  lowestRank: "最低技能要求",
  isCollaboration: "联动式神",
  isOma: "逢魔御魂",
  twoPieceText: "两件套效果",
  fourPieceEffect: "四件套效果",
  onePieceEffect: "一件套效果",
  attack: "攻击",
  health: "生命",
  defense: "防御",
  speed: "速度",
  critRate: "暴击",
  critDamage: "暴击伤害",
  effectHit: "效果命中",
  effectResistance: "效果抵抗",
};
const fileOptions: Array<{ value: FileKey; label: string }> = [
  { value: "heroes", label: "式神录" },
  { value: "relic-suits", label: "御魂列表" },
];

function stringify(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatLowestRank(value: unknown): string {
  return String(value ?? "155").padStart(3, "0");
}

function isValidLowestRank(value: unknown): boolean {
  return /^[1-6]{3}$/.test(String(value));
}

function createHeroRow(key: string, value: HeroRecord): SheetRow {
  const baseStats = asRecord(value.baseStats);
  return {
    __key: key,
    id: Number(value.id ?? key),
    name: String(value.name ?? ""),
    level: String(value.level ?? ""),
    lowestRank: formatLowestRank(value.lowestRank),
    isCollaboration: Boolean(value.isCollaboration),
    attack: Number(baseStats.attack ?? 0),
    health: Number(baseStats.health ?? 0),
    defense: Number(baseStats.defense ?? 0),
    speed: Number(baseStats.speed ?? 0),
    critRate: Number(baseStats.critRate ?? 0),
    critDamage: Number(baseStats.critDamage ?? 150),
    effectHit: Number(baseStats.effectHit ?? 0),
    effectResistance: Number(baseStats.effectResistance ?? 0),
  };
}

/**
 * 静态 JSON 的数组结构：普通御魂为 [ID, 名称, 标识, 两件套属性, 四件套效果]；
 * 逢魔御魂为 [ID, 名称, 标识, 一件套效果, 两件套效果]。
 * 一件套效果在维护页只读保留，避免误改现有逢魔机制。
 */
function createRelicRows(data: RelicSuitsDocument): SheetRow[] {
  const omaIds = new Set(Object.keys(data.two_suit_yuhun || {}));
  return (data.yuhun_list || [])
    .map((row, index) => {
      const id = Number(row[0] ?? 0);
      const isOma = omaIds.has(String(id));
      return {
        __key: String(index),
        id,
        name: String(row[1] ?? ""),
        slug: String(row[2] ?? ""),
        isOma,
        onePieceEffect: isOma ? String(row[3] ?? "") : "",
        twoPieceText: isOma
          ? String(row[4] ?? "").trim() || String(row[3] ?? "")
          : String(row[3] ?? ""),
        fourPieceEffect: isOma ? "" : String(row[4] ?? ""),
      };
    })
    .reverse();
}
function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function openDownloadsFolder(): void {
  window.setTimeout(() => {
    void window.desktop?.openDownloadsFolder();
  }, 300);
}

function isExcelFile(file: File): boolean {
  return /\.(xlsx|xls)$/i.test(file.name);
}

function toBoolean(value: unknown): boolean {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "是" ||
    value === "true"
  );
}

export function MaintenancePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { staticDataLoading: remoteUpdating, calculatorStaticRefreshRequestId: staticDataRevision } =
    useAppSelector((state) => state.app);
  const [activeFile, setActiveFile] = useState<FileKey>("heroes");
  const [documents, setDocuments] = useState<Record<FileKey, string>>({
    heroes: "",
    "relic-suits": "",
  });
  const [sheets, setSheets] = useState<Record<FileKey, SheetRow[]>>({
    heroes: [],
    "relic-suits": [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRow, setEditingRow] = useState<SheetRow | null>(null);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation>(null);
  const [dirty, setDirty] = useState(false);
  const [api, holder] = message.useMessage();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const refreshStaticData = async (): Promise<void> => {
    if (remoteUpdating) return;
    if (getStaticRefreshRemaining() > 0) {
      api.info("静态数据仍在冷却中，请稍后再试");
      return;
    }

    dispatch(setStaticDataLoading(true));
    try {
      const [heroData, suitData] = await Promise.all([
        loadHeroPanels<HeroStaticPayload>(true),
        loadRelicSuits<RelicSuitStaticPayload>(true),
      ]);
      const heroIds = Object.values(heroData.heroesById || {})
        .map((hero) => hero.id)
        .filter((id): id is number => Number.isInteger(id) && id > 0);
      const suitIds = (suitData.yuhun_list || [])
        .map(([id]) => id)
        .filter((id): id is number => Number.isInteger(id) && id > 0);
      const assetResult = await window.desktop!.updateStaticAssets({
        heroIds,
        suitIds,
      });
      dispatch(setStaticAssetPreview({
        ...assetResult,
        heroIds: heroIds.slice(0, 5),
        suitIds: suitIds.slice(0, 5),
      }));
      markStaticRefresh();
      dispatch(incrementCalculatorStaticRefreshRequestId());
      api.success(
        `静态数据已更新：${assetResult.heroIcons} 个式神图标、${assetResult.suitIcons} 个御魂图标`,
      );
    } catch {
      api.error("静态数据更新失败，请稍后重试");
    } finally {
      dispatch(setStaticDataLoading(false));
    }
  };
  const activeLabel = useMemo(
    () =>
      fileOptions.find((item) => item.value === activeFile)?.label || "数据",
    [activeFile],
  );

  const loadIntoEditor = (heroes: unknown, relicSuits: unknown): void => {
    const heroMap = asRecord(asRecord(heroes).heroesById);
    setDocuments({
      heroes: stringify(heroes),
      "relic-suits": stringify(relicSuits),
    });
    setSheets({
      heroes: Object.entries(heroMap)
        .map(([key, value]) => createHeroRow(key, asRecord(value)))
        .reverse(),
      "relic-suits": createRelicRows(relicSuits as RelicSuitsDocument),
    });
  };
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([loadHeroPanels(), loadRelicSuits()])
      .then(([heroes, relicSuits]) => {
        if (cancelled) return;
        loadIntoEditor(heroes, relicSuits);
        setDirty(false);
        setEditingRow(null);
      })
      .catch(() => api.error("读取本地静态资料失败"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, staticDataRevision]);

  const sheetColumns =
    activeFile === "heroes"
      ? [
          "id",
          "name",
          "level",
          "lowestRank",
          "attack",
          "health",
          "defense",
          "speed",
        ]
      : ["id", "name", "twoPieceText", "fourPieceEffect"];
  const updateCell = (key: string, field: string, value: CellValue): void => {
    setDirty(true);
    setSheets((current) => ({
      ...current,
      [activeFile]: current[activeFile].map((row) =>
        row.__key === key ? { ...row, [field]: value } : row,
      ),
    }));
  };
  const updateEditingRow = (field: string, value: CellValue): void => {
    if (!editingRow) return;
    setEditingRow({ ...editingRow, [field]: value });
    updateCell(editingRow.__key, field, value);
  };
  const updateNumber = (field: string, value: string): void =>
    updateEditingRow(field, Number(value));
  const addRow = (): void => {
    const key = `new-${Date.now()}`;
    const nextId =
      Math.max(0, ...sheets[activeFile].map((item) => Number(item.id) || 0)) +
      1;
    const row: SheetRow =
      activeFile === "heroes"
        ? {
            __key: key,
            id: nextId,
            name: "新式神",
            level: "SSR",
            lowestRank: "155",
            isCollaboration: false,
            attack: 0,
            health: 0,
            defense: 0,
            speed: 0,
            critRate: 0,
            critDamage: 150,
            effectHit: 0,
            effectResistance: 0,
          }
        : {
            __key: key,
            id: nextId,
            name: "新御魂",
            slug: "",
            isOma: false,
            onePieceEffect: "",
            twoPieceText: normalTwoPieceOptions[0],
            fourPieceEffect: "",
          };
    setDirty(true);
    setSheets((current) => ({
      ...current,
      [activeFile]: [row, ...current[activeFile]],
    }));
    setEditingRow(row);
  };
  const applyDefaultData = async (): Promise<void> => {
    try {
      setSaving(true);
      await Promise.all([
        saveStaticData("heroes", bundledHeroes),
        saveStaticData("relic-suits", bundledRelicSuits),
      ]);
      loadIntoEditor(bundledHeroes, bundledRelicSuits);
      setDirty(false);
      setEditingRow(null);
      api.success("已恢复默认配置并写入本地");
    } catch {
      api.error("恢复默认配置失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };
  const resetDefaults = (): void => {
    setPendingConfirmation({ action: "reset" });
  };
  const deleteEditingRow = (): void => {
    if (!editingRow) return;
    setPendingConfirmation({
      action: "delete",
      rowKey: editingRow.__key,
      rowName: String(editingRow.name || editingRow.id),
    });
  };
  const confirmPendingAction = async (): Promise<void> => {
    if (!pendingConfirmation) return;

    if (pendingConfirmation.action === "reset") {
      setPendingConfirmation(null);
      await applyDefaultData();
      return;
    }

    const { rowKey } = pendingConfirmation;
    setSheets((current) => ({
      ...current,
      [activeFile]: current[activeFile].filter((row) => row.__key !== rowKey),
    }));
    setDirty(true);
    setEditingRow(null);
    setPendingConfirmation(null);
    api.success("已删除当前数据，保存后生效");
  };
  const validateImportedData = (data: unknown): string | null => {
    if (!data || typeof data !== "object") return "JSON 根节点必须是对象";
    if (activeFile === "heroes") {
      const heroMap = asRecord(asRecord(data).heroesById);
      if (!Object.keys(heroMap).length)
        return "式神文件必须包含 heroesById 对象";
      const invalid = Object.entries(heroMap).find(([, hero]) => {
        const item = asRecord(hero);
        return (
          typeof item.name !== "string" ||
          typeof item.level !== "string" ||
          !item.baseStats ||
          !isValidLowestRank(formatLowestRank(item.lowestRank))
        );
      });
      return invalid
        ? `式神 ${invalid[0]} 的资料不完整，最低技能要求必须为三位且每位为 1-6`
        : null;
    }
    const document = data as RelicSuitsDocument;
    if (!Array.isArray(document.yuhun_list))
      return "御魂文件必须包含 yuhun_list 数组";
    const invalidIndex = document.yuhun_list.findIndex(
      (row) =>
        !Array.isArray(row) ||
        typeof row[0] !== "number" ||
        typeof row[1] !== "string",
    );
    return invalidIndex >= 0
      ? `御魂第 ${invalidIndex + 1} 行缺少数字 ID 或名称`
      : null;
  };
  const applyImportedData = (data: unknown): void => {
    const error = validateImportedData(data);
    if (error) {
      api.error(`导入失败：${error}`);
      return;
    }
    if (activeFile === "heroes") {
      const heroMap = asRecord(asRecord(data).heroesById);
      setSheets((current) => ({
        ...current,
        heroes: Object.entries(heroMap)
          .map(([key, value]) => createHeroRow(key, asRecord(value)))
          .reverse(),
      }));
    } else {
      setSheets((current) => ({
        ...current,
        "relic-suits": createRelicRows(data as RelicSuitsDocument),
      }));
    }
    setDocuments((current) => ({ ...current, [activeFile]: stringify(data) }));
    setDirty(true);
    api.success("文件格式校验通过，已载入编辑区；请保存后生效");
  };
  const importJsonFile = (file: File | undefined): void => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json") && !isExcelFile(file)) {
      api.error("只能导入 JSON 或 Excel 文件");
      return;
    }
    if (isExcelFile(file)) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const workbook = XLSX.read(reader.result, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
            sheet,
            { defval: "" },
          );
          if (!rows.length) throw new Error("empty");
          if (activeFile === "heroes") {
            const heroesById = Object.fromEntries(
              rows.map((row) => {
                const id = Number(row[fieldLabels.id]);
                return [
                  String(id),
                  {
                    id,
                    name: String(row[fieldLabels.name] ?? ""),
                    level: String(row[fieldLabels.level] ?? "SSR"),
                    lowestRank: formatLowestRank(
                      row[fieldLabels.lowestRank] ?? 155,
                    ),
                    isCollaboration: toBoolean(
                      row[fieldLabels.isCollaboration],
                    ),
                    baseStats: Object.fromEntries(
                      heroBaseFields.map((field) => [
                        field,
                        Number(
                          row[fieldLabels[field]] ??
                            (field === "critDamage" ? 150 : 0),
                        ),
                      ]),
                    ),
                  },
                ];
              }),
            );
            applyImportedData({ heroesById });
          } else {
            const yuhun_list = rows.map((row) => {
              const isOma = toBoolean(row[fieldLabels.isOma]);
              const id = Number(row[fieldLabels.id]);
              return isOma
                ? [
                    id,
                    String(row[fieldLabels.name] ?? ""),
                    "",
                    "",
                    String(row[fieldLabels.twoPieceText] ?? ""),
                  ]
                : [
                    id,
                    String(row[fieldLabels.name] ?? ""),
                    "",
                    String(row[fieldLabels.twoPieceText] ?? ""),
                    String(row[fieldLabels.fourPieceEffect] ?? ""),
                  ];
            });
            const two_suit_yuhun = Object.fromEntries(
              rows
                .filter((row) => toBoolean(row[fieldLabels.isOma]))
                .map((row) => [
                  String(Number(row[fieldLabels.id])),
                  String(row[fieldLabels.name] ?? ""),
                ]),
            );
            applyImportedData({ yuhun_list, two_suit_yuhun });
          }
        } catch {
          api.error(
            "导入失败：请使用本页面导出的 Excel 文件，或检查表头与数据格式",
          );
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        applyImportedData(JSON.parse(String(reader.result)));
      } catch {
        api.error("导入失败：文件不是有效的 JSON");
      }
    };
    reader.readAsText(file, "utf-8");
  };
  const serializeCurrentSheet = (): unknown => {
    const original = JSON.parse(documents[activeFile]) as Record<
      string,
      unknown
    >;
    if (activeFile === "heroes") {
      const sourceHeroes = asRecord(original.heroesById);
      const heroesById = Object.fromEntries(
        sheets.heroes.map((row) => {
          const source = asRecord(sourceHeroes[row.__key]);
          return [
            String(row.id),
            {
              ...source,
              id: Number(row.id),
              name: String(row.name),
              level: String(row.level),
              lowestRank: Number(row.lowestRank),
              isCollaboration: Boolean(row.isCollaboration),
              baseStats: {
                ...asRecord(source.baseStats),
                ...Object.fromEntries(
                  heroBaseFields.map((field) => [field, Number(row[field])]),
                ),
              },
            },
          ];
        }),
      );
      return { ...original, heroCount: sheets.heroes.length, heroesById };
    }
    const rows = sheets["relic-suits"];
    return {
      ...original,
      two_suit_yuhun: Object.fromEntries(
        rows
          .filter((row) => Boolean(row.isOma))
          .map((row) => [String(row.id), String(row.name)]),
      ),
      yuhun_list: rows.map((row) =>
        row.isOma
          ? [
              Number(row.id),
              String(row.name),
              String(row.slug),
              String(row.onePieceEffect),
              String(row.twoPieceText),
            ]
          : [
              Number(row.id),
              String(row.name),
              String(row.slug),
              String(row.twoPieceText),
              String(row.fourPieceEffect),
            ],
      ),
    };
  };
  const validateCurrentSheet = (): string | null => {
    if (activeFile !== "heroes") return null;
    const invalidHero = sheets.heroes.find(
      (hero) => !isValidLowestRank(hero.lowestRank),
    );
    return invalidHero
      ? `式神「${String(invalidHero.name)}」的最低技能要求必须为三位，且每一位为 1-6`
      : null;
  };
  const saveCurrent = async (): Promise<void> => {
    const validationError = validateCurrentSheet();
    if (validationError) {
      api.error(validationError);
      return;
    }
    try {
      const value = serializeCurrentSheet();
      setSaving(true);
      await saveStaticData(activeFile, value);
      setDocuments((current) => ({
        ...current,
        [activeFile]: stringify(value),
      }));
      setDirty(false);
      api.success(`${activeLabel}已保存到本地`);
    } catch {
      api.error("保存失败：请检查数据格式");
    } finally {
      setSaving(false);
    }
  };
  const exportCurrent = (): void => {
    try {
      downloadJson(
        activeFile === "heroes" ? "式神录.json" : "御魂列表.json",
        serializeCurrentSheet(),
      );
      openDownloadsFolder();
      api.success("已导出当前维护数据");
    } catch {
      api.error("导出失败：请检查数据格式");
    }
  };
  const exportExcel = (): void => {
    const fields =
      activeFile === "heroes"
        ? [
            "id",
            "name",
            "level",
            "lowestRank",
            "isCollaboration",
            ...heroBaseFields,
          ]
        : ["id", "name", "isOma", "twoPieceText", "fourPieceEffect"];
    const rows = sheets[activeFile].map((row) =>
      Object.fromEntries(
        fields.map((field) => [
          fieldLabels[field],
          field === "isOma" || field === "isCollaboration"
            ? row[field]
              ? "是"
              : "否"
            : row[field],
        ]),
      ),
    );
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeLabel);
    XLSX.writeFile(
      workbook,
      activeFile === "heroes" ? "式神录.xlsx" : "御魂列表.xlsx",
    );
    openDownloadsFolder();
    api.success("已导出 Excel 维护表");
  };
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);
  const requestBack = (): void => {
    if (!dirty) {
      navigate("/home");
      return;
    }
    Modal.confirm({
      title: "有未保存的修改",
      content: "离开数据维护页面后，当前修改会丢失。确定离开吗？",
      okText: "放弃修改并离开",
      cancelText: "继续编辑",
      okButtonProps: { danger: true },
      onOk: () => navigate("/home"),
    });
  };
  const renderIcon = (row: SheetRow): ReactElement => (
    <img
      className="maintenance-page__record-icon"
      src={assetUrl(
        `${activeFile === "heroes" ? "heroes" : "suits"}/${row.id}.png`,
      )}
      alt=""
    />
  );

  return (
    <div className="width maintenance-page">
      {holder}
      <header className="maintenance-page__header">
        <div>
          <span className="page-kicker">本地数据</span>
          <h1>数据维护</h1>
          <p>
            维护应用本地使用的式神与御魂资料。点击任意行可编辑详细数据，保存后立即写入本地。
          </p>
        </div>
        <Button onClick={requestBack}>返回账号</Button>
      </header>
      <section className="maintenance-page__toolbar">
        <Segmented
          value={activeFile}
          options={fileOptions.map(({ value, label }) => ({ value, label }))}
          onChange={(value) => {
            setActiveFile(value as FileKey);
            setEditingRow(null);
          }}
        />
        <div className="maintenance-page__actions">
          <span className="maintenance-page__hint">
            点击任意一行编辑详细数据
          </span>
          <Button onClick={addRow} disabled={loading}>
            新增一行
          </Button>
          <Button onClick={resetDefaults} disabled={loading}>
            恢复默认配置
          </Button>
          <Button
            onClick={() => uploadInputRef.current?.click()}
            disabled={loading}
          >
            导入
          </Button>
          <Dropdown
            disabled={loading}
            menu={{
              items: [
                { key: "json", label: "导出 JSON", onClick: exportCurrent },
                { key: "excel", label: "导出 Excel", onClick: exportExcel },
              ],
            }}
          >
            <Button
              icon={<DownloadOutlined />}
              onClick={undefined}
              disabled={loading}
            >
              导出
            </Button>
          </Dropdown>
          <input
            ref={uploadInputRef}
            className="maintenance-page__file-input"
            type="file"
            accept="application/json,.json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,.xlsx"
            onChange={(event) => {
              importJsonFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={loading}
            onClick={() => void saveCurrent()}
          >
            保存本地数据
          </Button>
          <Button
            icon={<CloudDownloadOutlined />}
            loading={remoteUpdating}
            onClick={() => void refreshStaticData()}
          >
            远程更新并下载图标
          </Button>
        </div>
      </section>
      <Table<SheetRow>
        className="maintenance-page__table"
        rowKey="__key"
        dataSource={sheets[activeFile]}
        loading={loading}
        pagination={{ pageSize: 5, showSizeChanger: false }}
        onRow={(row) => ({
          onClick: () => setEditingRow(row),
          className: "maintenance-page__clickable-row",
        })}
        columns={[
          {
            title: "图标",
            key: "icon",
            width: 64,
            render: (_, row) => renderIcon(row),
          },
          ...sheetColumns.map((field) => ({
            title: fieldLabels[field] || field,
            dataIndex: field,
            key: field,
            render: (value: CellValue) =>
              field === "isOma" || field === "isCollaboration"
                ? value
                  ? "是"
                  : "否"
                : String(value ?? "-"),
          })),
        ]}
      />
      <Modal
        className="maintenance-page__edit-modal"
        open={Boolean(editingRow)}
        title={`编辑${activeLabel}`}
        width={760}
        footer={[
          <Button key="delete" danger onClick={deleteEditingRow}>
            删除此条数据
          </Button>,
          <Button key="cancel" onClick={() => setEditingRow(null)}>
            关闭
          </Button>,
        ]}
        onCancel={() => setEditingRow(null)}
      >
        {editingRow && activeFile === "heroes" && (
          <div className="maintenance-page__edit-sections">
            <section>
              <div className="maintenance-page__record-heading">
                {renderIcon(editingRow)}
                <div>
                  <h3>基础资料</h3>
                  <span>式神图标和基础资料会一同保存。</span>
                </div>
              </div>
              <div className="maintenance-page__edit-grid maintenance-page__edit-grid--info">
                {[
                  "id",
                  "name",
                  "level",
                  "lowestRank",
                ].map((field) => (
                  <label key={field}>
                    <span>{fieldLabels[field]}</span>
                    {field === "level" ? (
                      <Select
                        value={String(editingRow[field] ?? "SSR")}
                        options={["UR", "SP", "SSR", "SR", "R", "N"].map(
                          (value) => ({ value, label: value }),
                        )}
                        onChange={(value) => updateEditingRow(field, value)}
                      />
                    ) : field === "isCollaboration" ? (
                      <Switch
                        size="small"
                        checked={Boolean(editingRow[field])}
                        onChange={(checked) =>
                          updateEditingRow(field, checked)
                        }
                      />
                    ) : (
                      <Input
                        inputMode={field === "lowestRank" ? "numeric" : undefined}
                        maxLength={field === "lowestRank" ? 3 : undefined}
                        value={String(editingRow[field] ?? "")}
                        onChange={(event) => {
                          if (field === "id") {
                            updateNumber(field, event.target.value);
                            return;
                          }
                          if (field === "lowestRank") {
                            const nextValue = event.target.value.replace(/\D/g, "").slice(0, 3);
                            if (
                              [...nextValue].every(
                                (digit) => digit >= "1" && digit <= "6",
                              )
                            ) {
                              updateEditingRow(field, nextValue);
                            }
                            return;
                          }
                          updateEditingRow(field, event.target.value);
                        }}
                      />
                    )}
                  </label>
                ))}
              </div>
            </section>
            <section className="maintenance-page__panel-section">
              <div className="maintenance-page__section-heading">
                <div>
                  <h3>基础面板</h3>
                  <span>满级觉醒后的基础属性。</span>
                </div>
              </div>
              <div className="maintenance-page__edit-grid maintenance-page__edit-grid--panel">
                {heroBaseFields.map((field) => (
                  <label key={field}>
                    <span>{fieldLabels[field]}</span>
                    <Input
                      value={String(editingRow[field] ?? "")}
                      onChange={(event) =>
                        updateNumber(field, event.target.value)
                      }
                    />
                  </label>
                ))}
              </div>
            </section>
          </div>
        )}
        {editingRow && activeFile === "relic-suits" && (
          <div className="maintenance-page__edit-sections maintenance-page__edit-sections--relic">
            <section>
              <div className="maintenance-page__record-heading">
                {renderIcon(editingRow)}
                <div>
                  <h3>御魂资料</h3>
                  <span>
                    普通御魂维护两件套与四件套；逢魔御魂的一件套效果仅保留。
                  </span>
                </div>
              </div>
              <div className="maintenance-page__edit-grid maintenance-page__edit-grid--info">
                {["id", "name"].map((field) => (
                  <label key={field}>
                    <span>{fieldLabels[field]}</span>
                    <Input
                      value={String(editingRow[field] ?? "")}
                      onChange={(event) =>
                        field === "id"
                          ? updateNumber(field, event.target.value)
                          : updateEditingRow(field, event.target.value)
                      }
                    />
                  </label>
                ))}
                <label>
                  <span>逢魔御魂</span>
                  <Switch
                    size="small"
                    checked={Boolean(editingRow.isOma)}
                    onChange={(checked) => updateEditingRow("isOma", checked)}
                  />
                </label>
              </div>
            </section>
            <section className="maintenance-page__panel-section">
              <div className="maintenance-page__section-heading">
                <div>
                  <h3>{editingRow.isOma ? "逢魔套装效果" : "套装效果"}</h3>
                  <span>
                    {editingRow.isOma
                      ? "逢魔两件套可自由维护；一件套效果不需要编辑。"
                      : "两件套使用固定属性；四件套支持完整效果说明。"}
                  </span>
                </div>
              </div>
              <div className="maintenance-page__edit-grid">
                {editingRow.isOma ? (
                  <>
                    <label className="maintenance-page__edit-field--wide">
                      <span>两件套效果</span>
                      <Input.TextArea
                        rows={3}
                        value={String(editingRow.twoPieceText ?? "")}
                        onChange={(event) =>
                          updateEditingRow("twoPieceText", event.target.value)
                        }
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      <span>两件套属性</span>
                      <Select
                        value={String(
                          editingRow.twoPieceText ?? normalTwoPieceOptions[0],
                        )}
                        options={normalTwoPieceOptions.map((value) => ({
                          value,
                          label: value,
                        }))}
                        onChange={(value) =>
                          updateEditingRow("twoPieceText", value)
                        }
                      />
                    </label>
                    <label className="maintenance-page__edit-field--wide">
                      <span>四件套效果</span>
                      <Input.TextArea
                        rows={4}
                        value={String(editingRow.fourPieceEffect ?? "")}
                        onChange={(event) =>
                          updateEditingRow(
                            "fourPieceEffect",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </Modal>
      <Modal
        className="maintenance-page__confirmation-modal"
        destroyOnHidden
        open={pendingConfirmation !== null}
        title={
          pendingConfirmation?.action === "delete"
            ? "删除当前数据"
            : "恢复默认配置"
        }
        width={420}
        zIndex={1100}
        okText={pendingConfirmation?.action === "delete" ? "删除" : "恢复默认"}
        cancelText="取消"
        okButtonProps={{ danger: true, loading: saving }}
        onCancel={() => setPendingConfirmation(null)}
        onOk={() => void confirmPendingAction()}
      >
        <p>
          {pendingConfirmation?.action === "delete"
            ? `确定删除“${pendingConfirmation.rowName}”吗？保存后才会写入本地。`
            : "这会放弃当前尚未保存的修改，并立即恢复安装包内置数据。"}
        </p>
      </Modal>
    </div>
  );
}
