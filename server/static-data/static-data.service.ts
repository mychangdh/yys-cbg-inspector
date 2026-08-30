import { Inject, Injectable } from "@nestjs/common";
import type { RowDataPacket } from "mysql2/promise";
import { DatabaseService } from "../database/database.service";

type HeroRow = RowDataPacket & {
  id: number;
  name: string;
  slug: string;
  level: "UR" | "SP" | "SSR" | "SR" | "R" | "N";
  lowest_rank: number;
  is_collaboration: number;
  attack: number;
  health: number;
  defense: number;
  speed: number;
  crit_rate: number;
  crit_damage: number;
  effect_hit: number;
  effect_resistance: number;
};

type RelicSuitRow = RowDataPacket & {
  id: number;
  name: string;
  slug: string;
  two_piece_attribute: string;
  two_piece_effect: string;
  is_oma: number;
};

const rarityCodes = {
  UR: 6,
  SP: 5,
  SSR: 4,
  SR: 3,
  R: 2,
  N: 1,
} as const;

@Injectable()
export class StaticDataService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async getHeroes() {
    const rows = await this.databaseService.queryRows<HeroRow[]>(
      `SELECT id, name, slug, level, lowest_rank, is_collaboration, attack, health, defense, speed,
        crit_rate, crit_damage, effect_hit, effect_resistance
       FROM heroes
       ORDER BY id ASC`,
    );
    const heroesById = Object.fromEntries(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          name: row.name,
          slug: row.slug,
          level: row.level,
          rarityCode: rarityCodes[row.level],
          lowestRank: Number(row.lowest_rank) || 0,
          isCollaboration: Boolean(row.is_collaboration),
          baseStats: {
            attack: Number(row.attack),
            health: Number(row.health),
            defense: Number(row.defense),
            speed: Number(row.speed),
            critRate: Number(row.crit_rate),
            critDamage: Number(row.crit_damage),
            effectHit: Number(row.effect_hit),
            effectResistance: Number(row.effect_resistance),
          },
        },
      ]),
    );

    return { schemaVersion: 1, heroCount: rows.length, heroesById };
  }

  async getRelicSuits() {
    const rows = await this.databaseService.queryRows<RelicSuitRow[]>(
      `SELECT id, name, slug, two_piece_attribute, two_piece_effect, is_oma
       FROM relic_suits
       ORDER BY id ASC`,
    );

    return {
      yuhun_list: rows.map((row) => [
        row.id,
        row.name,
        row.slug,
        row.is_oma ? row.two_piece_effect : row.two_piece_attribute,
        row.is_oma ? "" : row.two_piece_effect,
      ]),
      two_suit_yuhun: Object.fromEntries(
        rows
          .filter((row) => Boolean(row.is_oma))
          .map((row) => [row.id, row.name]),
      ),
    };
  }
}
