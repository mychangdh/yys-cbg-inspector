import { useEffect } from "react";
import {
  customMainShortcutStorageKey,
  customShortcutStorageKey,
  recentHeroStorageKey,
  recentRelicStorageKey,
  savedCalculatorConfigStorageKey,
  type CustomMainAttributeShortcut,
  type CustomPanelShortcut,
  type RecentRelicChoice,
  type SavedCalculatorConfig,
} from "../calculatorShared";

type CalculatorPersistenceState = {
  customPanelShortcuts: CustomPanelShortcut[];
  customMainShortcuts: CustomMainAttributeShortcut[];
  savedCalculatorConfigs: SavedCalculatorConfig[];
  recentHeroIds: number[];
  recentRelicChoices: RecentRelicChoice[];
};

function persist(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 本地存储不可用时保留当前页面状态，不影响计算器功能。
  }
}

/** 将用户自定义配置和最近选择持久化，不占用工作区业务逻辑。 */
export function useCalculatorPersistence({
  customPanelShortcuts,
  customMainShortcuts,
  savedCalculatorConfigs,
  recentHeroIds,
  recentRelicChoices,
}: CalculatorPersistenceState) {
  useEffect(() => {
    persist(customShortcutStorageKey, customPanelShortcuts);
  }, [customPanelShortcuts]);

  useEffect(() => {
    persist(customMainShortcutStorageKey, customMainShortcuts);
  }, [customMainShortcuts]);

  useEffect(() => {
    persist(savedCalculatorConfigStorageKey, savedCalculatorConfigs);
  }, [savedCalculatorConfigs]);

  useEffect(() => {
    persist(recentHeroStorageKey, recentHeroIds);
  }, [recentHeroIds]);

  useEffect(() => {
    persist(recentRelicStorageKey, recentRelicChoices);
  }, [recentRelicChoices]);
}
