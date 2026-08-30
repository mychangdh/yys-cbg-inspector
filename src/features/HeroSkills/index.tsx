"use client";

import { SearchOutlined } from "@ant-design/icons";
import { Empty, Input } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadHeroPanels } from "@/lib/staticApi";
import type { HeroRecord } from "../Calculator/calculatorShared";
import { HeroSkillCard } from "./HeroSkillCard";
import type { HeroView } from "@/types";
import "./index.scss";
import { useAppSelector } from "@/store";
import type { HeroSkillsGroup } from "./index.types";

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

function skillValue(hero: HeroView) {
  return hero.skillLevels
    .slice(0, 3)
    .reduce((total, level) => total + level, 0);
}

function skillMeetsRequirement(hero: HeroView, requirement: number) {
  const required = String(Math.max(0, Math.floor(requirement || 155))).padStart(
    3,
    "0",
  );
  const actual = hero.skillLevels
    .slice(0, 3)
    .map((level) => Math.max(0, Math.floor(level)));
  return (
    actual.length === 3 &&
    actual.every((level, index) => level >= Number(required[index]))
  );
}

/** 按账号原始式神数据展示三个技能等级。 */
export function HeroSkillsPage() {
  const dataset = useAppSelector((state) => state.app.dataset);
  const [search, setSearch] = useState("");
  const [staticHeroes, setStaticHeroes] = useState<Record<number, HeroRecord>>(
    {},
  );
  useEffect(() => {
    let active = true;
    void loadHeroPanels<{ heroesById?: Record<string, HeroRecord> }>()
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
      })
      .catch(() => undefined);
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
    eligibleHeroes.forEach((hero) => {
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
  }, [eligibleHeroes, matchesSearch, orderByLevel, staticHeroes]);
  const duplicateMaxLevelHeroes = useMemo(() => {
    const grouped = new Map<string, HeroView[]>();
    eligibleHeroes.forEach((hero) => {
      const group = grouped.get(hero.name) || [];
      group.push(hero);
      grouped.set(hero.name, group);
    });
    return [...grouped.values()]
      .filter((sameNameHeroes) => {
        return (
          sameNameHeroes.filter((hero) =>
            skillMeetsRequirement(
              hero,
              staticHeroes[hero.heroId]?.lowestRank ?? 155,
            ),
          ).length >= 2
        );
      })
      .map((sameNameHeroes) => {
        const qualifiedHeroes = sameNameHeroes.filter((hero) =>
          skillMeetsRequirement(
            hero,
            staticHeroes[hero.heroId]?.lowestRank ?? 155,
          ),
        );
        return qualifiedHeroes;
      })
      .flatMap((heroes) =>
        heroes
          .filter(matchesSearch)
          .sort(orderByLevel)
          .map((hero) => hero),
      )
      .sort(orderByLevel);
  }, [eligibleHeroes, matchesSearch, orderByLevel, staticHeroes]);
  const groups = useMemo<HeroSkillsGroup[]>(() => {
    const visibleHeroes = eligibleHeroes.filter(matchesSearch);

    return rarityOrder
      .map(
        (rarity) =>
          [
            rarity,
            visibleHeroes
              .filter((hero) => hero.rarity === rarity)
              .sort(orderByLevel),
          ] as HeroSkillsGroup,
      )
      .filter(([, heroes]) => heroes.length > 0);
  }, [eligibleHeroes, matchesSearch, orderByLevel]);

  const hasVisibleContent =
    groups.length > 0 ||
    skillDeficientHeroes.length > 0 ||
    duplicateMaxLevelHeroes.length > 0 ||
    collaborationHeroes.length > 0;
  return (
    <main className="width result hero-skills-page">
      <div className="page-heading">
        <div>
          <div className="page-kicker">式神信息</div>
          <h1>式神技能</h1>
        </div>
      </div>

      <div className="hero-skills-page__daruma" aria-label="御行达摩数量">
        <span className="hero-skills-page__daruma-label">御行达摩</span>
        <strong>{dataset.account?.yuxingDama ?? 0}</strong>
      </div>

      <Input
        className="hero-skills-page__search"
        allowClear
        prefix={<SearchOutlined />}
        placeholder="搜索式神"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {!hasVisibleContent ? (
        <Empty
          className="hero-skills-page__empty"
          description={
            dataset.heroes?.length
              ? "没有匹配的式神"
              : "当前账号数据未包含式神技能信息"
          }
        />
      ) : (
        <div className="hero-skills-page__groups">
          {duplicateMaxLevelHeroes.length > 0 && (
            <section
              className="hero-skills-page__group"
              key="duplicate-max-level"
            >
              <header>
                <h2>存在多号机的能式神</h2>
                <span>{duplicateMaxLevelHeroes.length}</span>
              </header>
              <div className="hero-skills-page__grid">
                {duplicateMaxLevelHeroes.map((hero) => (
                  <HeroSkillCard
                    hero={hero}
                    key={`duplicate-${hero.instanceId}`}
                  />
                ))}
              </div>
            </section>
          )}
          {skillDeficientHeroes.length > 0 && (
            <section className="hero-skills-page__group" key="skill-deficient">
              <header>
                <h2>技能未达标</h2>
                <span>{skillDeficientHeroes.length}</span>
              </header>
              <div className="hero-skills-page__grid">
                {skillDeficientHeroes.map((hero) => (
                  <HeroSkillCard
                    hero={hero}
                    showAccountLevel={false}
                    key={`deficient-${hero.instanceId}`}
                  />
                ))}
              </div>
            </section>
          )}
          {collaborationHeroes.length > 0 && (
            <section className="hero-skills-page__group" key="collaboration">
              <header>
                <h2>联动式神</h2>
                <span>{collaborationHeroes.length}</span>
              </header>
              <div className="hero-skills-page__grid">
                {collaborationHeroes.map((hero) => (
                  <HeroSkillCard hero={hero} key={hero.instanceId} />
                ))}
              </div>
            </section>
          )}
          {groups.length > 0 && (
            <section className="hero-skills-page__all">
              <header>
                <h2>全部式神</h2>
              </header>
              <div className="hero-skills-page__all-groups">
                {groups.map(([rarity, heroes]) => (
                  <section className="hero-skills-page__group" key={rarity}>
                    <header>
                      <h2>{rarityLabels[rarity] || "其他"}</h2>
                      <span>{heroes.length}</span>
                    </header>
                    <div className="hero-skills-page__grid">
                      {heroes.map((hero) => (
                        <HeroSkillCard hero={hero} key={hero.instanceId} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
