import bundledHeroes from "../data/heroes.json";
import bundledRelicSuits from "../data/relic-suits.json";

const bundledData: Record<string, unknown> = {
  heroes: bundledHeroes,
  "relic-suits": bundledRelicSuits,
};

function applyBundledHeroFlags(data: unknown): unknown {
  const document = data as {
    heroesById?: Record<string, Record<string, unknown>>;
  };
  const bundledDocument = bundledHeroes as {
    heroesById?: Record<string, { isCollaboration?: boolean }>;
  };
  if (!document?.heroesById || !bundledDocument.heroesById) return data;

  return {
    ...document,
    heroesById: Object.fromEntries(
      Object.entries(document.heroesById).map(([id, hero]) => [
        id,
        typeof hero.isCollaboration === "boolean"
          ? hero
          : {
              ...hero,
              isCollaboration: Boolean(
                bundledDocument.heroesById?.[id]?.isCollaboration,
              ),
            },
      ]),
    ),
  };
}

/** 桌面端静态资料只通过主进程读取或更新。 */
async function loadStaticData<T>(
  name: string,
  endpoint: string,
  refresh = false,
): Promise<T> {
  const data = refresh
    ? await window.desktop!.updateStaticData(endpoint)
    : await window.desktop!.readStaticData(endpoint);
  const resolvedData = data ?? bundledData[name];
  return (name === "heroes"
    ? applyBundledHeroFlags(resolvedData)
    : resolvedData) as T;
}

export function loadHeroPanels<T = unknown>(refresh = false): Promise<T> {
  return loadStaticData<T>("heroes", "/static/heroes", refresh);
}

export function loadRelicSuits<T = unknown>(refresh = false): Promise<T> {
  return loadStaticData<T>("relic-suits", "/static/relic-suits", refresh);
}

export function saveStaticData(
  name: "heroes" | "relic-suits",
  data: unknown,
): Promise<unknown> {
  return window.desktop!.saveStaticData(`/static/${name}`, data);
}
