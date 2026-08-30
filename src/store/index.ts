import {
  configureStore,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import {
  useDispatch,
  useSelector,
  type TypedUseSelectorHook,
} from "react-redux";
import type { DatasetHistoryRecord } from "./persistence";
import type { RelicDataset } from "@/types";

export * from "./persistence";

export type StaticAssetPreview = {
  heroIcons: number;
  suitIcons: number;
  failed: number;
  heroIds: number[];
  suitIds: number[];
};

export type AppState = {
  dataset: RelicDataset;
  productUrl: string;
  cacheReady: boolean;
  updating: boolean;
  history: DatasetHistoryRecord[];
  historyOpen: boolean;
  mobileMenuOpen: boolean;
  staticDataLoading: boolean;
  calculatorStaticRefreshRequestId: number;
  restoreNotice: string | null;
  maintenanceOpen: boolean;
  staticAssetPreview: StaticAssetPreview | null;
};

export const emptyDataset: RelicDataset = { relicsByPosition: {} };

const initialState: AppState = {
  dataset: emptyDataset,
  productUrl: "",
  cacheReady: false,
  updating: false,
  history: [],
  historyOpen: false,
  mobileMenuOpen: false,
  staticDataLoading: false,
  calculatorStaticRefreshRequestId: 0,
  restoreNotice: null,
  maintenanceOpen: false,
  staticAssetPreview: null,
};

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    setDataset(state, action: PayloadAction<RelicDataset>) {
      state.dataset = action.payload;
    },
    setProductUrl(state, action: PayloadAction<string>) {
      state.productUrl = action.payload;
    },
    setCacheReady(state, action: PayloadAction<boolean>) {
      state.cacheReady = action.payload;
    },
    setUpdating(state, action: PayloadAction<boolean>) {
      state.updating = action.payload;
    },
    setHistory(state, action: PayloadAction<DatasetHistoryRecord[]>) {
      state.history = action.payload;
    },
    setHistoryOpen(state, action: PayloadAction<boolean>) {
      state.historyOpen = action.payload;
    },
    setMobileMenuOpen(state, action: PayloadAction<boolean>) {
      state.mobileMenuOpen = action.payload;
    },
    setStaticDataLoading(state, action: PayloadAction<boolean>) {
      state.staticDataLoading = action.payload;
    },
    incrementCalculatorStaticRefreshRequestId(state) {
      state.calculatorStaticRefreshRequestId += 1;
    },
    setRestoreNotice(state, action: PayloadAction<string | null>) {
      state.restoreNotice = action.payload;
    },
    setMaintenanceOpen(state, action: PayloadAction<boolean>) {
      state.maintenanceOpen = action.payload;
    },
    setStaticAssetPreview(
      state,
      action: PayloadAction<StaticAssetPreview | null>,
    ) {
      state.staticAssetPreview = action.payload;
    },
    resetDataset(state) {
      state.dataset = emptyDataset;
      state.productUrl = "";
    },
  },
});

export const {
  incrementCalculatorStaticRefreshRequestId,
  resetDataset,
  setCacheReady,
  setDataset,
  setHistory,
  setHistoryOpen,
  setMaintenanceOpen,
  setMobileMenuOpen,
  setProductUrl,
  setRestoreNotice,
  setStaticAssetPreview,
  setStaticDataLoading,
  setUpdating,
} = appSlice.actions;

/**
 * 商品详情和历史记录包含大量御魂明细，数据进入 Store 前已经完成结构归一化。
 * 开发环境仍保留 Redux 的常规检查，但跳过这两块大对象的重复深度遍历，避免
 * 每次切换加载态或页面状态时触发数百毫秒的无效检查。
 */
const largeStatePaths = ["app.dataset", "app.history"];

export const store = configureStore({
  reducer: {
    app: appSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      immutableCheck: {
        ignoredPaths: largeStatePaths,
      },
      serializableCheck: {
        ignoredActions: [setDataset.type, setHistory.type],
        ignoredPaths: largeStatePaths,
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
