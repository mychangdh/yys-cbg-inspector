import {
  DeleteOutlined,
  DownOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  Col,
  Empty,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  Progress,
} from "antd";
import { useMemo, useState } from "react";
import {
  matchAccountHistory,
  type AccountMatcherCriteria,
} from "@/lib/accountMatcher";
import { useAppSelector } from "@/store";
import "./index.scss";

const { Text, Title } = Typography;

type NumberFilter = {
  name: string;
  label: string;
  max?: number;
  precision?: number;
};

const relicFilterGroups = [
  {
    title: "满速御魂",
    fields: [
      {
        name: "minimumMaxSpeedCount",
        label: "满速御魂数 ≥",
        max: 999,
        precision: 0,
      },
    ],
  },
  {
    title: "一速",
    fields: [
      {
        name: "minimumScatteredSpeed",
        label: "散件一速 ≥",
        max: 162,
        precision: 1,
      },
      {
        name: "minimumLuckySpeed",
        label: "招财一速 ≥",
        max: 162,
        precision: 1,
      },
    ],
  },
  {
    title: "头部",
    fields: [
      { name: "minimumHeadCount", label: "头个数 ≥", max: 999, precision: 0 },
      { name: "minimumHeadSpeed", label: "头速度 ≥", max: 17.5, precision: 1 },
    ],
  },
  {
    title: "尾部",
    fields: [
      { name: "minimumTailCount", label: "尾个数 ≥", max: 999, precision: 0 },
      { name: "minimumTailSpeed", label: "尾速度 ≥", max: 17.5, precision: 1 },
    ],
  },
  {
    title: "招财头部",
    fields: [
      {
        name: "minimumLuckyHeadCount",
        label: "招财头个数 ≥",
        max: 999,
        precision: 0,
      },
      {
        name: "minimumLuckyHeadSpeed",
        label: "招财头速度 ≥",
        max: 17.5,
        precision: 1,
      },
    ],
  },
];

const assetNumberFields: NumberFilter[] = [
  { name: "jade", label: "勾玉" },
  { name: "mysteryAmulet", label: "神秘符咒" },
  { name: "stamina", label: "体力" },
  { name: "goldWan", label: "金币（万）" },
  { name: "goldenAmulet", label: "金御札" },
  { name: "jadeStone", label: "魂玉" },
  { name: "御札", label: "御札" },
  { name: "逢魔之魂", label: "逢魔之魂" },
  { name: "大蛇的逆鳞", label: "大蛇的逆鳞" },
  { name: "御行达摩", label: "御行达摩" },
  { name: "皮肤券", label: "皮肤券" },
  { name: "勋章", label: "勋章" },
  { name: "六星结界卡", label: "六星结界卡" },
  { name: "满级御魂", label: "满级御魂" },
];

const skinCountFields: NumberFilter[] = [
  { name: "式神皮肤总数", label: "式神皮肤总数" },
  { name: "典藏皮肤总数", label: "典藏皮肤总数" },
  { name: "庭院皮肤总数", label: "庭院皮肤总数" },
  { name: "召唤屋皮肤总数", label: "召唤屋皮肤总数" },
  { name: "幕间皮肤总数", label: "幕间皮肤总数" },
  { name: "战斗主题总数", label: "战斗主题总数" },
  { name: "阴阳术皮肤总数", label: "阴阳术皮肤总数" },
];

const miscellaneousNumberFields: NumberFilter[] = [
  {
    name: "minimumSixStarHeroCount",
    label: "6星式神数量 ≥",
    max: 999,
    precision: 0,
  },
  { name: "minimumStyle", label: "风姿度 ≥", max: 999999, precision: 0 },
  { name: "minimumSignInDays", label: "签到天数 ≥", max: 9999, precision: 0 },
  { name: "maximumLevel", label: "等级 ≤", max: 60, precision: 0 },
];

const assetSwitchOptions = ["曜之阁开启", "永久勾玉卡", "心易徽记"];
const skinOptions = [
  "黑晴明",
  "赤之流火",
  "花颜骁姬",
  "稚子之忆",
  "青莲蜕梦",
  "花引冥烛",
  "龙胆霖心",
  "侍怨神婚",
  "银阙极光",
  "浮生若梦",
  "鹤栖遥夕",
  "胧月",
  "汐澜珠冕",
  "朔野·芒",
  "烬夜韶阁",
  "织梦莲庭",
  "天穹之境",
  "结缘神社",
  "缘结之庭",
  "望月幽庭",
  "琼月华宫",
  "走影之灯",
  "弦之律",
  "万事皆灵",
  "天机幕行",
  "故梦雅苑",
  "食之味",
  "鱼影金荷",
  "冥夜游火",
  "霞染游鱼",
  "今宵胧明",
  "月下火舞",
  "契光水境",
  "静栖回廊",
  "雪意晴峦",
  "穹宇垂帘",
  "童梦基地",
  "拾光之窗",
  "妙音空境",
  "缘台樱垂",
  "赤溟幽界",
  "启程之刻",
  "花札幕台",
  "眠鹿之森",
  "祥夜幽芳",
  "桂馥金秋",
  "蝶寻花踪",
  "简约主题",
  "凛霜寒雪",
  "怀旧主题",
  "春缕含青",
  "茶室小憩",
  "跃灯明阁",
  "森罗谧境",
].map((name) => ({ label: name, value: name }));

const avatarFrameOptions = [
  "百鬼之主",
  "大阴阳师",
  "京都名士",
  "战·百鬼之主",
  "战·大阴阳师",
  "战·京都名士",
  "鲤跃金松",
  "京都之主",
  "久相伴",
  "日月同辉",
  "大触觉醒",
  "笔墨意",
  "月见黑",
  "晴帆渡·初空",
  "月姬之眷",
  "穹月之蚀",
  "屡变星霜·长相伴",
  "巅峰翘楚",
].map((name) => ({ label: name, value: name }));

const badgeOptions = ["秘闻·天下一", "地域·天下一", "馆主·博", "终极之巅"].map(
  (name) => ({ label: name, value: name }),
);
const achievementOptions = [
  "征服世界",
  "非洲·大阴阳师",
  "阴阳师·大神",
  "对弈竞猜·卓见",
].map((name) => ({ label: name, value: name }));

const serverOptions = [
  {
    label: "中国区-iOS",
    options: [
      "春之樱",
      "桂之馥",
      "兰之雅",
      "莲之净",
      "雀之羽",
      "松之苍",
      "夏之蝉",
      "云之遏",
      "夜之月",
      "竹之幽",
    ].map((name) => ({ label: name, value: `中国区-iOS/${name}` })),
  },
  {
    label: "网易-双平台",
    options: [
      "携手同心",
      "相伴相随",
      "情比金坚",
      "形影不离",
      "同心一意",
      "相知相依",
      "心意相通",
      "永生之谜",
      "缥缈之旅",
      "遥远之忆",
      "孤高之心",
      "风雨同行",
      "两情相悦",
      "春樱共赏",
      "谜之暗影",
      "结伴同游",
    ].map((name) => ({ label: `网易-${name}`, value: `网易-双平台/${name}` })),
  },
  {
    label: "联运-双平台",
    options: [
      "B站-两心无间",
      "B站-亲密无间",
      "B站-情深谊长",
      "B站-情意相投",
    ].map((name) => ({ label: name, value: `联运-双平台/${name}` })),
  },
  {
    label: "国际区",
    options: ["海外加速区", "全球国际区"].map((name) => ({
      label: name,
      value: `国际区/${name}`,
    })),
  },
  {
    label: "全平台互通新区",
    options: [
      "八岐魅影",
      "彼世之花",
      "百鬼夜行",
      "白玉银阙",
      "初心未改",
      "赤夜降临",
      "春告之雪",
      "渡世之风",
      "枫之舞",
      "浮梦之境",
      "鬼灭之刃",
      "高天原",
      "鬼灯的冷彻",
      "鬼王之宴",
      "欢庆鼓舞",
      "狐之宴",
      "绘世之卷",
      "黄金爪",
      "花札物语",
      "花火之夏",
      "旧友新朋",
      "今时月",
      "举手相庆",
      "瀞灵廷",
      "旧时童梦",
      "镜如明心",
      "经霜之枫",
      "结世缘",
      "鲛人之歌",
      "立秋夕烛",
      "轮回之庭",
      "铃心踏焰",
      "灵狐愿",
      "麓海为王",
      "鸣麓逐浪",
      "猫川别馆",
      "暖风春穗",
      "念山行",
      "破晓之樱",
      "犬夜叉",
      "晴空日和",
      "祈世之舞",
      "乾坤行",
      "千山醉",
      "人间千年",
      "日轮之城",
      "深情厚谊",
      "少时之约",
      "森之王",
      "四载平安",
      "四季生",
      "森遥乡",
      "神鲤生财",
      "神之晚宴",
      "时海曜光",
      "三途烽烬",
      "守山谣",
      "天上天下",
      "桃映春馨",
      "天罗地网",
      "庭中酌",
      "踏雪行",
      "唯吾独尊",
      "万事屋",
      "雾山隐",
      "相伴同行",
      "相伴长情",
      "夏之风铃",
      "携手共度",
      "雪之萤",
      "相闻秋歌",
      "循光世",
      "夏目友人帐",
      "依偎相守",
      "樱之忆",
      "游梦迷蝶",
      "夜火离歌",
      "一叶禅心",
      "永生之海",
      "雅乐之邦",
      "愿予必成",
      "御香归",
      "樱月相邀",
      "夜摩天殿",
      "音起时",
      "有龙则灵",
      "夜影之谜",
      "音巡夜",
      "竹风夏意",
      "朝夕相伴",
      "追月逐兔",
      "稚羽萌心",
      "真味如初",
      "真言之塔",
      "奏世之宴",
    ].map((name) => ({ label: name, value: `全平台互通新区/${name}` })),
  },
];

const priceRanges = [
  { label: "100–499 元", value: "100-499", minimum: 100, maximum: 499 },
  { label: "500–1,999 元", value: "500-1999", minimum: 500, maximum: 1999 },
  {
    label: "2,000–4,999 元",
    value: "2000-4999",
    minimum: 2000,
    maximum: 4999,
  },
  {
    label: "5,000 元以上",
    value: "5000-plus",
    minimum: 5000,
    maximum: null,
  },
];

export function AccountMatcherPage() {
  const history = useAppSelector((state) => state.app.history);
  const cacheReady = useAppSelector((state) => state.app.cacheReady);
  const [hasSearched, setHasSearched] = useState(false);
  const [applyingCbgSearch, setApplyingCbgSearch] = useState(false);
  const [cbgSearchNotice, setCbgSearchNotice] = useState<{
    type: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const [minimumPrice, setMinimumPrice] = useState<number | null>(null);
  const [maximumPrice, setMaximumPrice] = useState<number | null>(null);
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [draftServers, setDraftServers] = useState<string[]>([]);
  const [serverPickerOpen, setServerPickerOpen] = useState(false);
  const [activeServerGroup, setActiveServerGroup] = useState(
    serverOptions[0].label,
  );
  const [publication, setPublication] =
    useState<AccountMatcherCriteria["publication"]>("any");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [priceBucket, setPriceBucket] = useState("");
  const [priority, setPriority] =
    useState<AccountMatcherCriteria["priority"]>("balanced");
  const [dexRequirements, setDexRequirements] = useState<string[]>([]);
  const [numberFilters, setNumberFilters] = useState<
    Record<string, number | null>
  >({});
  const [assetFlags, setAssetFlags] = useState<string[]>([]);
  const [skinNames, setSkinNames] = useState<string[]>([]);
  const [avatarFrames, setAvatarFrames] = useState<string[]>([]);
  const [goldenAvatarFrame, setGoldenAvatarFrame] = useState(false);
  const [badges, setBadges] = useState<string[]>([]);
  const [achievements, setAchievements] = useState<string[]>([]);

  const criteria = useMemo<AccountMatcherCriteria>(
    () => ({
      minimumPrice,
      maximumPrice,
      selectedServers,
      publication,
      platforms,
      priority,
      dexRequirements,
      numberFilters,
      assetFlags,
      skinNames,
      avatarFrames,
      goldenAvatarFrame,
      badges,
      achievements,
    }),
    [
      minimumPrice,
      maximumPrice,
      selectedServers,
      publication,
      platforms,
      priority,
      dexRequirements,
      numberFilters,
      assetFlags,
      skinNames,
      avatarFrames,
      goldenAvatarFrame,
      badges,
      achievements,
    ],
  );
  const results = useMemo(
    () => (hasSearched ? matchAccountHistory(history, criteria) : []),
    [criteria, hasSearched, history],
  );

  const updateNumber = (name: string, value: number | null) => {
    setNumberFilters((current) => ({ ...current, [name]: value }));
  };

  const updateBudget = (minimum: number | null, maximum: number | null) => {
    setMinimumPrice(minimum);
    setMaximumPrice(maximum);
    setPriceBucket(
      priceRanges.find(
        (range) => range.minimum === minimum && range.maximum === maximum,
      )?.value ?? "",
    );
  };

  const applyCbgSearch = async () => {
    setHasSearched(true);
    setApplyingCbgSearch(true);
    setCbgSearchNotice({
      type: "info",
      message: "正在打开并聚焦藏宝阁窗口，然后应用筛选条件…",
    });
    try {
      const result = await window.desktop?.applyCbgRoleSearch(criteria);
      if (!result) throw new Error("藏宝阁桌面窗口当前不可用");
      setCbgSearchNotice({
        type: "success",
        message: `已在藏宝阁应用条件（${result.applied.join("、")}）。官方结果显示在藏宝阁窗口，本地候选仍显示在下方。`,
      });
    } catch (reason) {
      setCbgSearchNotice({
        type: "error",
        message:
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "自动筛选失败",
      });
    } finally {
      setApplyingCbgSearch(false);
    }
  };

  const renderNumberFields = (fields: NumberFilter[], compact = false) => (
    <Row gutter={[14, 12]}>
      {fields.map((field) => (
        <Col
          {...(compact ? { xs: 24 } : { xs: 24, sm: 12, xxl: 8 })}
          key={field.name}
        >
          <label
            className="account-matcher-label"
            htmlFor={`filter-${field.name}`}
          >
            {field.label}
          </label>
          <InputNumber
            id={`filter-${field.name}`}
            className="account-matcher-number"
            min={0}
            max={field.max}
            precision={field.precision ?? 0}
            placeholder="不限"
            value={numberFilters[field.name] ?? null}
            onChange={(value) =>
              updateNumber(field.name, value === null ? null : Number(value))
            }
          />
        </Col>
      ))}
    </Row>
  );

  const clearConditions = () => {
    setHasSearched(false);
    setCbgSearchNotice(null);
    setSelectedServers([]);
    setPublication("any");
    setPlatforms([]);
    updateBudget(null, null);
    setDexRequirements([]);
    setNumberFilters({});
    setAssetFlags([]);
    setSkinNames([]);
    setAvatarFrames([]);
    setGoldenAvatarFrame(false);
    setBadges([]);
    setAchievements([]);
    setPriority("balanced");
  };

  const currentServerGroup = serverOptions.find(
    (group) => group.label === activeServerGroup,
  )!;
  const currentServerValues = currentServerGroup.options.map(
    (option) => option.value,
  );
  const allCurrentServersSelected = currentServerValues.every((value) =>
    draftServers.includes(value),
  );
  const someCurrentServersSelected = currentServerValues.some((value) =>
    draftServers.includes(value),
  );

  const toggleCurrentServerGroup = (checked: boolean) => {
    setDraftServers((current) => {
      const next = new Set(current);
      currentServerValues.forEach((value) =>
        checked ? next.add(value) : next.delete(value),
      );
      return [...next];
    });
  };

  const sectionLabel = (title: string, description: string, count: string) => (
    <div className="account-matcher-collapse-title">
      <div>
        <Text strong>{title}</Text>
        <Text type="secondary">{description}</Text>
      </div>
      <Tag>{count}</Tag>
    </div>
  );

  const collapseItems = [
    {
      key: "listing",
      label: sectionLabel("商品条件", "区服、公示状态、平台与预算", "4 类"),
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xxl={6}>
            <span className="account-matcher-label">区服</span>
            <Button
              id="match-server"
              className="account-matcher-server-picker-trigger"
              aria-haspopup="dialog"
              onClick={() => {
                setDraftServers(selectedServers);
                setServerPickerOpen(true);
              }}
            >
              <span>
                {selectedServers.length
                  ? `已选 ${selectedServers.length} 个区服`
                  : "不限区服"}
              </span>
              <DownOutlined />
            </Button>
          </Col>
          <Col xs={24} sm={12} xxl={6}>
            <span className="account-matcher-label">公示期</span>
            <Radio.Group
              value={publication}
              onChange={(event) => setPublication(event.target.value)}
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: "不限", value: "any" },
                { label: "只看公示期", value: "only" },
                { label: "不看公示期", value: "exclude" },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} xxl={6}>
            <span className="account-matcher-label">操作系统</span>
            <Checkbox.Group
              options={["iOS", "Android"]}
              value={platforms}
              onChange={(value) => setPlatforms(value as string[])}
            />
          </Col>
          <Col xs={24} sm={12} xxl={6}>
            <span className="account-matcher-label">预算范围（元）</span>
            <Space.Compact className="account-matcher-price-range">
              <InputNumber
                min={0}
                precision={0}
                placeholder="最低价"
                value={minimumPrice}
                onChange={(value) =>
                  updateBudget(
                    value === null ? null : Number(value),
                    maximumPrice,
                  )
                }
                aria-label="最低价格，元"
              />
              <span className="account-matcher-range-separator">至</span>
              <InputNumber
                min={0}
                precision={0}
                placeholder="最高价"
                value={maximumPrice}
                onChange={(value) =>
                  updateBudget(
                    minimumPrice,
                    value === null ? null : Number(value),
                  )
                }
                aria-label="最高价格，元"
              />
            </Space.Compact>
          </Col>
          <Col xs={24}>
            <span className="account-matcher-label">常用价格区间</span>
            <Radio.Group
              options={priceRanges.map(({ label, value }) => ({
                label,
                value,
              }))}
              value={priceBucket}
              onChange={(event) => {
                const range = priceRanges.find(
                  (option) => option.value === event.target.value,
                );
                if (range) updateBudget(range.minimum, range.maximum);
              }}
            />
          </Col>
        </Row>
      ),
    },
    {
      key: "heroes",
      label: sectionLabel("图鉴与式神", "图鉴完成度与 6 星式神数量", "2 类"),
      children: (
        <div className="account-matcher-panel-content">
          <div className="account-matcher-filter-block">
            <span className="account-matcher-label">图鉴要求</span>
            <Checkbox.Group
              options={[
                { label: "SSR 全图鉴", value: "ssr" },
                { label: "SP 全图鉴", value: "sp" },
                { label: "UR 全图鉴", value: "ur" },
                { label: "联动全图鉴", value: "collaboration" },
              ]}
              value={dexRequirements}
              onChange={(value) => setDexRequirements(value as string[])}
            />
          </div>
          <Row gutter={[16, 14]}>
            <Col xs={24} lg={12}>
              <label
                className="account-matcher-label"
                htmlFor="filter-minimumSixStarHeroCount"
              >
                6 星式神数量 ≥
              </label>
              <InputNumber
                id="filter-minimumSixStarHeroCount"
                className="account-matcher-number"
                min={0}
                max={999}
                precision={0}
                placeholder="不限"
                value={numberFilters.minimumSixStarHeroCount ?? null}
                onChange={(value) =>
                  updateNumber(
                    "minimumSixStarHeroCount",
                    value === null ? null : Number(value),
                  )
                }
              />
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: "style",
      label: sectionLabel("风姿度", "账号风姿度下限", "1 项"),
      children: renderNumberFields([miscellaneousNumberFields[1]]),
    },
    {
      key: "relics",
      label: sectionLabel("御魂速度", "散件、招财、满速数量及头尾速度", "5 组"),
      children: (
        <Row gutter={[12, 12]}>
          {relicFilterGroups.map((group) => (
            <Col xs={24} md={12} xxl={8} key={group.title}>
              <section className="account-matcher-relic-group">
                <Text strong>{group.title}</Text>
                {renderNumberFields(group.fields, true)}
              </section>
            </Col>
          ))}
        </Row>
      ),
    },
    {
      key: "assets",
      label: sectionLabel("资产", "14 项资源数量与账户特征", "17 项"),
      children: (
        <div className="account-matcher-panel-content">
          {renderNumberFields(assetNumberFields)}
          <div className="account-matcher-switch-grid">
            {assetSwitchOptions.map((name) => (
              <div className="account-matcher-inline-control" key={name}>
                <Text>{name}</Text>
                <Switch
                  checked={assetFlags.includes(name)}
                  onChange={(checked) =>
                    setAssetFlags((current) =>
                      checked
                        ? [...current, name]
                        : current.filter((item) => item !== name),
                    )
                  }
                  aria-label={name}
                />
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: "collection",
      label: sectionLabel("外观与收藏", "皮肤分类、头像框和徽章", "3 类"),
      children: (
        <div className="account-matcher-panel-content">
          <div className="account-matcher-subsection">
            <Text strong>皮肤</Text>
            {renderNumberFields(skinCountFields)}
            <div>
              <label className="account-matcher-label" htmlFor="match-skins">
                指定皮肤
              </label>
              <Select
                id="match-skins"
                mode="tags"
                showSearch
                options={skinOptions}
                value={skinNames}
                onChange={setSkinNames}
                tokenSeparators={[",", "，"]}
                placeholder="搜索已列出的皮肤，或输入名称后回车"
              />
              <Text type="secondary" className="account-matcher-help">
                常见选项可直接选择；未列出的皮肤名称也可以手动输入。
              </Text>
            </div>
          </div>
          <div className="account-matcher-subsection">
            <Text strong>头像框</Text>
            <Checkbox.Group
              className="account-matcher-option-grid"
              options={avatarFrameOptions}
              value={avatarFrames}
              onChange={(value) => setAvatarFrames(value as string[])}
            />
            <div className="account-matcher-inline-control">
              <Text>京都之主（金达摩）</Text>
              <Switch
                checked={goldenAvatarFrame}
                onChange={setGoldenAvatarFrame}
              />
            </div>
          </div>
          <div className="account-matcher-subsection">
            <Text strong>徽章</Text>
            <Checkbox.Group
              className="account-matcher-option-grid"
              options={badgeOptions}
              value={badges}
              onChange={(value) => setBadges(value as string[])}
            />
          </div>
        </div>
      ),
    },
    {
      key: "achievements",
      label: sectionLabel("成就与签到", "指定成就、签到天数和等级上限", "6 项"),
      children: (
        <div className="account-matcher-panel-content">
          <div className="account-matcher-filter-block">
            <span className="account-matcher-label">指定成就</span>
            <Checkbox.Group
              options={achievementOptions}
              value={achievements}
              onChange={(value) => setAchievements(value as string[])}
            />
          </div>
          {renderNumberFields([
            miscellaneousNumberFields[2],
            miscellaneousNumberFields[3],
          ])}
        </div>
      ),
    },
  ];

  return (
    <main className="account-matcher-page">
      <header className="account-matcher-heading">
        <div>
          <Title level={1}>账号匹配</Title>
          <Text className="account-matcher-subtitle">
            按藏宝阁筛选条件描述理想账号，略有差距的候选也会保留说明。
          </Text>
        </div>
        <Tag color="blue" icon={<ThunderboltOutlined />}>
          本地匹配
        </Tag>
      </header>

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} xl={16}>
          <Card className="account-matcher-card" title="筛选条件">
            <Collapse
              className="account-matcher-collapse"
              bordered={false}
              defaultActiveKey={["listing", "heroes"]}
              items={collapseItems}
            />
            <div className="account-matcher-priority">
              <label className="account-matcher-label">匹配倾向</label>
              <Radio.Group
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                optionType="button"
                buttonStyle="solid"
                options={[
                  { label: "均衡", value: "balanced" },
                  { label: "价格优先", value: "price" },
                  { label: "速度优先", value: "speed" },
                ]}
              />
            </div>
            <div className="account-matcher-actions">
              <div className="account-matcher-condition-preview">
                <Text strong>筛选提示</Text>
                <Text type="secondary">
                  留空表示不限；接近匹配也会保留并说明差距。
                </Text>
              </div>
              <Space>
                <Button icon={<DeleteOutlined />} onClick={clearConditions}>
                  清空条件
                </Button>
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  loading={applyingCbgSearch}
                  title="将条件自动填入藏宝阁角色筛选并提交，同时匹配本地历史"
                  onClick={() => void applyCbgSearch()}
                >
                  打开藏宝阁并筛选
                </Button>
              </Space>
            </div>
            {cbgSearchNotice && (
              <Alert
                showIcon
                type={cbgSearchNotice.type}
                message={cbgSearchNotice.message}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card className="account-matcher-guide" title="匹配说明">
            <div className="account-matcher-guide-step">
              <span>01</span>
              <div>
                <Text strong>条件按藏宝阁分类整理</Text>
                <Text type="secondary">
                  商品、式神、御魂、资产和收藏项目都可单独展开。
                </Text>
              </div>
            </div>
            <div className="account-matcher-guide-step">
              <span>02</span>
              <div>
                <Text strong>允许接近匹配</Text>
                <Text type="secondary">
                  略有差距的账号也纳入候选，并标出未满足项。
                </Text>
              </div>
            </div>
            <Alert
              showIcon
              type="info"
              message="候选来自本机商品历史"
              description="本地候选最多匹配最近 10 条已读取账号；藏宝阁官方商品结果会显示在独立藏宝阁窗口。"
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            className="account-matcher-results"
            title="匹配结果"
            extra={
              <Text type="secondary">
                {hasSearched
                  ? `${results.length} 条本地候选`
                  : `${history.length} 条本地历史`}
              </Text>
            }
          >
            {!cacheReady ? (
              <div className="account-matcher-results-loading" role="status">
                正在读取本机账号历史…
              </div>
            ) : !hasSearched ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  history.length
                    ? "设置条件后点击“自动筛选并匹配”，接近候选也会保留"
                    : "本机还没有账号历史；先读取商品，账号会保存到本地历史"
                }
              />
            ) : history.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="本机还没有可匹配的账号历史"
              />
            ) : (
              <div className="account-matcher-result-list">
                {results.map((result) => {
                  const { record } = result;
                  const account = record.dataset.account || {};
                  const hasCriteria =
                    result.evaluatedCount + result.unknownCount > 0;
                  const isUnverified =
                    result.evaluatedCount === 0 && result.unknownCount > 0;
                  const isExact =
                    result.evaluatedCount > 0 &&
                    result.differences.length === 0 &&
                    result.unknownCount === 0;
                  const resultLabel = !hasCriteria
                    ? "未设置条件"
                    : isUnverified
                      ? "待核实"
                      : isExact
                        ? "完全符合"
                        : result.differences.length
                          ? "接近匹配"
                          : "已验证条件符合";
                  const savedDate = new Intl.DateTimeFormat("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                  }).format(new Date(record.savedAt));

                  return (
                    <article
                      className="account-matcher-result-card"
                      key={record.id}
                    >
                      <div className="account-matcher-result-summary">
                        <div className="account-matcher-result-heading">
                          <div>
                            <Text strong>{record.accountName}</Text>
                            <Text type="secondary">
                              {record.serverName} ·{" "}
                              {account.listingStatus || "状态未知"}
                            </Text>
                          </div>
                          <Tag
                            color={
                              isExact ? "green" : isUnverified ? "gold" : "blue"
                            }
                          >
                            {resultLabel}
                          </Tag>
                        </div>
                        <div className="account-matcher-result-facts">
                          <span>
                            {account.price === undefined
                              ? "价格未知"
                              : `¥${account.price.toLocaleString("zh-CN")}`}
                          </span>
                          <span>
                            {account.level ? `${account.level} 级` : "等级未知"}
                          </span>
                          <span>
                            {account.scatteredFirstSpeed === undefined
                              ? "散件一速未知"
                              : `散件一速 ${account.scatteredFirstSpeed.toFixed(2)}`}
                          </span>
                          <span>
                            {record.relicCount.toLocaleString("zh-CN")} 件御魂
                          </span>
                        </div>
                        <Text
                          type="secondary"
                          className="account-matcher-result-date"
                        >
                          本地历史 · {savedDate} 读取
                        </Text>
                      </div>

                      <div className="account-matcher-result-score">
                        {result.score === null ? (
                          <Text strong>暂无可评分项</Text>
                        ) : (
                          <>
                            <Text strong>{result.score}% 可验证匹配度</Text>
                            <Progress
                              percent={result.score}
                              showInfo={false}
                              size="small"
                            />
                            <Text type="secondary">
                              满足 {result.matchedCount}/{result.evaluatedCount}{" "}
                              项可验证条件
                            </Text>
                          </>
                        )}
                        {result.unknownCount > 0 && (
                          <Tag color="gold">
                            待核实 {result.unknownCount} 项
                          </Tag>
                        )}
                      </div>

                      {result.differences.length > 0 && (
                        <Text
                          type="secondary"
                          className="account-matcher-result-note"
                        >
                          差距：
                          {result.differences
                            .slice(0, 4)
                            .map(
                              ({ label, expected, actual }) =>
                                `${label} ${expected}（当前 ${actual}）`,
                            )
                            .join("；")}
                          {result.differences.length > 4
                            ? `；另有 ${result.differences.length - 4} 项差距`
                            : ""}
                        </Text>
                      )}
                      {result.unavailable.length > 0 && (
                        <Text
                          type="secondary"
                          className="account-matcher-result-note"
                        >
                          待核实：
                          {result.unavailable
                            .slice(0, 4)
                            .map(
                              ({ label, expected }) =>
                                `${label}（${expected}）`,
                            )
                            .join("、")}
                          {result.unavailable.length > 4
                            ? ` 等 ${result.unavailable.length} 项`
                            : ""}
                        </Text>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="区服选择"
        open={serverPickerOpen}
        width={760}
        onCancel={() => setServerPickerOpen(false)}
        footer={
          <div className="account-matcher-server-picker-footer">
            <Button onClick={() => setDraftServers([])}>重置</Button>
            <Space>
              <Button onClick={() => setServerPickerOpen(false)}>取消</Button>
              <Button
                type="primary"
                onClick={() => {
                  setSelectedServers(draftServers);
                  setServerPickerOpen(false);
                }}
              >
                完成
              </Button>
            </Space>
          </div>
        }
      >
        <div className="account-matcher-server-picker">
          <nav
            className="account-matcher-server-groups"
            aria-label="区服平台分组"
          >
            {serverOptions.map((group) => (
              <Button
                key={group.label}
                type={activeServerGroup === group.label ? "primary" : "text"}
                className="account-matcher-server-group"
                onClick={() => setActiveServerGroup(group.label)}
              >
                {group.label}
              </Button>
            ))}
          </nav>
          <section className="account-matcher-server-options">
            <Checkbox
              checked={allCurrentServersSelected}
              indeterminate={
                someCurrentServersSelected && !allCurrentServersSelected
              }
              onChange={(event) =>
                toggleCurrentServerGroup(event.target.checked)
              }
            >
              全选
            </Checkbox>
            <Checkbox.Group
              className="account-matcher-server-options-list"
              options={currentServerGroup.options}
              value={draftServers}
              onChange={(values) =>
                setDraftServers((current) => [
                  ...current.filter(
                    (value) => !currentServerValues.includes(value),
                  ),
                  ...(values as string[]),
                ])
              }
            />
          </section>
        </div>
      </Modal>
    </main>
  );
}
