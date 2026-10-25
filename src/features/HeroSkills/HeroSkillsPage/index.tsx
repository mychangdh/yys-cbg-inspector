"use client";

import { SearchOutlined } from "@ant-design/icons";
import { Empty, Input, Switch } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadHeroPanels } from "@/lib/staticApi";
import { useAppSelector } from "@/store";
import type { HeroRecord, HeroStaticPayload, HeroView } from "@/types";
import { HeroSkillCard } from "../HeroSkillCard";
import { HeroPortrait } from "../HeroPortrait";
import styles from "./index.module.scss";

type HeroSkillsGroup = readonly [rarity: number, heroes: HeroView[]];

const rarityOrder = [6, 5, 4];
const yinYangShiIds = new Set([10, 11, 12, 13, 15, 16]);
const rarityLabels: Record<number, string> = {
  6: "UR",
  5: "SP",
  4: "SSR",
  3: "SR",
  2: "R",
  1: "N",
};

/** 按账号原始式神数据展示技能等级，并把静态资料用于筛选和达标判断。 */
export function HeroSkillsPage() {
  const dataset = useAppSelector((state) => state.app.dataset);
  const [search, setSearch] = useState("");
  const [isSimplified, setIsSimplified] = useState(false);
  const [staticDataReady, setStaticDataReady] = useState(false);
  const [staticHeroes, setStaticHeroes] = useState<Record<number, HeroRecord>>(
    {},
  );

  const skillValue = (hero: HeroView) =>
    hero.skillLevels.slice(0, 3).reduce((total, level) => total + level, 0);
  const skillMeetsRequirement = (hero: HeroView, requirement: number) => {
    const required = String(
      Math.max(0, Math.floor(requirement || 155)),
    ).padStart(3, "0");
    const actual = hero.skillLevels
      .slice(0, 3)
      .map((level) => Math.max(0, Math.floor(level)));
    return (
      actual.length === 3 &&
      actual.every((level, index) => level >= Number(required[index]))
    );
  };

  useEffect(() => {
    let active = true;
    void loadHeroPanels<HeroStaticPayload>()
      .then((payload) => {
        if (!active) return;
        setStaticHeroes(
          Object.fromEntries(
            Object.entries(payload.heroesById || {}).map(([id, hero]) => [
              Number(id),
              hero,
            ]),
          ),
        );
        setStaticDataReady(true);
      })
      .catch(() => {
        if (active) setStaticDataReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const matchesSearch = useCallback(
    (hero: HeroView) =>
      !normalizedSearch ||
      hero.name.toLocaleLowerCase().includes(normalizedSearch),
    [normalizedSearch],
  );
  const orderByLevel = useCallback(
    (left: HeroView, right: HeroView) =>
      right.level - left.level || right.heroId - left.heroId,
    [],
  );
  const eligibleHeroes = useMemo(
    () =>
      (dataset.heroes || []).filter(
        (hero) =>
          rarityOrder.includes(hero.rarity) &&
          hero.heroId < 900 &&
          !yinYangShiIds.has(hero.heroId) &&
          !staticHeroes[hero.heroId]?.isCollaboration,
      ),
    [dataset.heroes, staticHeroes],
  );
  const categoryHeroes = useMemo(
    () =>
      isSimplified
        ? eligibleHeroes.filter(
            (hero) => hero.rarity === 4 || hero.rarity === 5,
          )
        : eligibleHeroes,
    [eligibleHeroes, isSimplified],
  );
  const collaborationHeroes = useMemo(
    () =>
      (dataset.heroes || [])
        .filter(
          (hero) =>
            rarityOrder.includes(hero.rarity) &&
            hero.heroId < 900 &&
            !yinYangShiIds.has(hero.heroId) &&
            Boolean(staticHeroes[hero.heroId]?.isCollaboration),
        )
        .filter(matchesSearch)
        .sort(orderByLevel),
    [dataset.heroes, matchesSearch, orderByLevel, staticHeroes],
  );
  const skillDeficientHeroes = useMemo(() => {
    const grouped = new Map<string, HeroView[]>();
    categoryHeroes.forEach((hero) => {
      const group = grouped.get(hero.name) || [];
      group.push(hero);
      grouped.set(hero.name, group);
    });
    return [...grouped.values()]
      .filter(
        (sameNameHeroes) =>
          !sameNameHeroes.some((hero) =>
            skillMeetsRequirement(
              hero,
              staticHeroes[hero.heroId]?.lowestRank ?? 155,
            ),
          ),
      )
      .map(
        (sameNameHeroes) =>
          [...sameNameHeroes].sort(
            (left, right) =>
              skillValue(right) - skillValue(left) || orderByLevel(left, right),
          )[0],
      )
      .filter(matchesSearch)
      .sort(orderByLevel);
  }, [categoryHeroes, matchesSearch, orderByLevel, staticHeroes]);
  const duplicateMaxLevelHeroes = useMemo(() => {
    const grouped = new Map<string, HeroView[]>();
    categoryHeroes.forEach((hero) => {
      const group = grouped.get(hero.name) || [];
      group.push(hero);
      grouped.set(hero.name, group);
    });
    return [...grouped.values()]
      .filter(
        (sameNameHeroes) =>
          sameNameHeroes.filter((hero) =>
            skillMeetsRequirement(
              hero,
              staticHeroes[hero.heroId]?.lowestRank ?? 155,
            ),
          ).length >= 2,
      )
      .flatMap((sameNameHeroes) =>
        sameNameHeroes
          .filter((hero) =>
            skillMeetsRequirement(
              hero,
              staticHeroes[hero.heroId]?.lowestRank ?? 155,
            ),
          )
          .filter(matchesSearch)
          .sort(orderByLevel),
      )
      .sort(orderByLevel);
  }, [categoryHeroes, matchesSearch, orderByLevel, staticHeroes]);
  const groups = useMemo<HeroSkillsGroup[]>(() => {
    const visibleHeroes = eligibleHeroes.filter(matchesSearch);
    return rarityOrder.map(
      (rarity) =>
        [
          rarity,
          visibleHeroes
            .filter((hero) => hero.rarity === rarity)
            .sort(orderByLevel),
        ] as HeroSkillsGroup,
    );
  }, [eligibleHeroes, matchesSearch, orderByLevel]);

  const hasStaticHeroData = Object.keys(staticHeroes).length > 0;
  const unownedShikigami = useMemo(() => {
    if (!dataset.heroes) return null;
    const ownedIds = new Set(dataset.heroes.map((hero) => hero.heroId));
    return Object.values(staticHeroes)
      .filter(
        (hero) =>
          hero.id < 900 &&
          (hero.rarityCode === 4 || hero.rarityCode === 5) &&
          !yinYangShiIds.has(hero.id) &&
          !hero.isCollaboration &&
          !ownedIds.has(hero.id) &&
          (!normalizedSearch ||
            hero.name.toLocaleLowerCase().includes(normalizedSearch)),
      )
      .sort(
        (left, right) =>
          (right.rarityCode || 0) - (left.rarityCode || 0) ||
          left.id - right.id,
      )
      .reverse();
  }, [dataset.heroes, normalizedSearch, staticHeroes]);
  const unownedSummary =
    unownedShikigami === null
      ? "当前账号数据未包含式神信息"
      : !hasStaticHeroData
        ? staticDataReady
          ? "静态式神资料读取失败，暂无法生成列表"
          : "正在读取静态式神资料"
        : unownedShikigami.length
          ? unownedShikigami.map((hero) => hero.name).join("、")
          : "无";

  return (
    <main className={`width result ${styles.page}`}>
      <div className="page-heading">
        <div>
          <h1>式神技能</h1>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.daruma} aria-label="御行达摩数量">
          <span className={styles.darumaLabel}>御行达摩</span>
          <strong>{dataset.account?.yuxingDama ?? 0}</strong>
        </div>
        <Input
          className={styles.search}
          allowClear
          prefix={<SearchOutlined />}
          placeholder="搜索式神"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className={styles.simpleMode}>
          <span id="hero-skills-simple-mode-label">简略模式</span>
          <Switch
            aria-labelledby="hero-skills-simple-mode-label"
            checked={isSimplified}
            onChange={setIsSimplified}
          />
        </div>
      </div>

      {isSimplified ? (
        <div className={styles.groups}>
          <section className={styles.group} aria-live="polite">
            <header>
              <h2>未拥有式神（排除联动）</h2>
            </header>
            {unownedShikigami?.length ? (
              <div className={styles.grid}>
                {unownedShikigami.map((hero) => (
                  <div className={styles.unownedItem} key={hero.id}>
                    {hero.name}
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.unownedNames}>{unownedSummary}</p>
            )}
          </section>
          <section className={styles.group}>
            <header>
              <h2>存在多号机的式神</h2>
            </header>
            {dataset.heroes === undefined ? (
              <p className={styles.unownedNames}>当前账号数据未包含式神信息</p>
            ) : !hasStaticHeroData ? (
              <p className={styles.unownedNames}>
                {staticDataReady
                  ? "静态式神资料读取失败，暂无法判断"
                  : "正在读取静态式神资料"}
              </p>
            ) : duplicateMaxLevelHeroes.length ? (
              <div className={styles.grid}>
                {duplicateMaxLevelHeroes
                  .filter(
                    (hero, index, heroes) =>
                      heroes.findIndex((item) => item.name === hero.name) ===
                      index,
                  )
                  .map((hero) => (
                    <div
                      className={styles.unownedItem}
                      key={`duplicate-${hero.instanceId}`}
                    >
                      {hero.name}
                    </div>
                  ))}
              </div>
            ) : (
              <p className={styles.unownedNames}>无</p>
            )}
          </section>
          <section className={styles.group}>
            <header>
              <h2>技能未达标</h2>
            </header>
            {dataset.heroes === undefined ? (
              <p className={styles.unownedNames}>
                当前账号数据未包含式神技能信息
              </p>
            ) : !hasStaticHeroData ? (
              <p className={styles.unownedNames}>
                {staticDataReady
                  ? "静态式神资料读取失败，暂无法判断"
                  : "正在读取静态式神资料"}
              </p>
            ) : skillDeficientHeroes.length ? (
              <div className={styles.grid}>
                {skillDeficientHeroes.map((hero) => (
                  <div
                    className={styles.unownedItem}
                    key={`deficient-${hero.instanceId}`}
                  >
                    {hero.name}
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.unownedNames}>无</p>
            )}
          </section>
        </div>
      ) : dataset.heroes === undefined ? (
        <Empty
          className={styles.empty}
          description="当前账号数据未包含式神技能信息"
        />
      ) : (
        <div className={styles.groups}>
          <section className={styles.group} aria-live="polite">
            <header>
              <h2>未拥有式神（排除联动）</h2>
              {hasStaticHeroData && (
                <span>{unownedShikigami?.length ?? 0}</span>
              )}
            </header>
            {unownedShikigami?.length ? (
              <div className={styles.grid}>
                {unownedShikigami.map((hero) => (
                  <article className={styles.unownedCard} key={hero.id}>
                    <HeroPortrait heroId={hero.id} grayscale />
                    <div className={styles.unownedHeroName}>{hero.name}</div>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.unownedNames}>{unownedSummary}</p>
            )}
          </section>
          <section className={styles.group} key="duplicate-max-level">
            <header>
              <h2>存在多号机的式神</h2>
              <span>{duplicateMaxLevelHeroes.length}</span>
            </header>
            {duplicateMaxLevelHeroes.length ? (
              <div className={styles.grid}>
                {duplicateMaxLevelHeroes.map((hero) => (
                  <HeroSkillCard
                    hero={hero}
                    key={`duplicate-${hero.instanceId}`}
                  />
                ))}
              </div>
            ) : (
              <p className={styles.unownedNames}>无</p>
            )}
          </section>
          <section className={styles.group} key="skill-deficient">
            <header>
              <h2>技能未达标</h2>
              <span>{skillDeficientHeroes.length}</span>
            </header>
            <p className={styles.skillNote}>
              以下展示每种式神中最接近满技能的一只的技能等级。
            </p>
            {skillDeficientHeroes.length ? (
              <div className={styles.grid}>
                {skillDeficientHeroes.map((hero) => (
                  <HeroSkillCard
                    hero={hero}
                    showAccountLevel={false}
                    key={`deficient-${hero.instanceId}`}
                  />
                ))}
              </div>
            ) : (
              <p className={styles.unownedNames}>无</p>
            )}
          </section>
          <section className={styles.group} key="collaboration">
            <header>
              <h2>联动式神</h2>
              <span>{collaborationHeroes.length}</span>
            </header>
            {collaborationHeroes.length ? (
              <div className={styles.grid}>
                {collaborationHeroes.map((hero) => (
                  <HeroSkillCard hero={hero} key={hero.instanceId} />
                ))}
              </div>
            ) : (
              <p className={styles.unownedNames}>无</p>
            )}
          </section>
          <section className={styles.all}>
            <header>
              <h2>全部式神</h2>
            </header>
            <div className={styles.allGroups}>
              {groups.map(([rarity, heroes]) => (
                <section className={styles.group} key={rarity}>
                  <header>
                    <h2>{rarityLabels[rarity] || "其他"}</h2>
                    <span>{heroes.length}</span>
                  </header>
                  {heroes.length ? (
                    <div className={styles.grid}>
                      {heroes.map((hero) => (
                        <HeroSkillCard hero={hero} key={hero.instanceId} />
                      ))}
                    </div>
                  ) : (
                    <p className={styles.unownedNames}>无</p>
                  )}
                </section>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
