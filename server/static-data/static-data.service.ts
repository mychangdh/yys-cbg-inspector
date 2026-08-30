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
    try {
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
    } catch (error) {
      return this.createFallback("heroes", error);
    }
  }

  async getRelicSuits() {
    try {
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
    } catch (error) {
      return this.createFallback("relic-suits", error);
    }
  }

  /**
   * 临时排查用的降级响应：保留前端所需的数据形状，但明确标记数据库不可用。
   * 真实错误只写入服务终端，并且只返回错误码，避免泄露连接地址或凭据。
   * 数据库修复后应删除该降级逻辑，恢复为让异常过滤器返回失败响应。
   */
  private createFallback(type: "heroes" | "relic-suits", error: unknown) {
    const errorCode = this.getErrorCode(error);
    console.error(`[静态资料] ${type} 查询失败，已返回临时降级数据`, {
      errorCode,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    const diagnostic = {
      source: "temporary-fallback",
      database: "unavailable",
      errorCode,
    } as const;

    if (type === "heroes") {
      return {
        schemaVersion: 1,
        heroCount: 0,
        heroesById: {},
        diagnostic,
      };
    }

    return {
      yuhun_list: [],
      two_suit_yuhun: {},
      diagnostic,
    };
  }

  private getErrorCode(error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (typeof error.code === "string" || typeof error.code === "number")
    ) {
      return String(error.code);
    }

    return error instanceof Error ? error.name : "UNKNOWN_ERROR";
  }
}
