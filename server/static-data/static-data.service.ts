import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

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
      const rows = await this.databaseService.hero.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          level: true,
          lowestRank: true,
          isCollaboration: true,
          attack: true,
          health: true,
          defense: true,
          speed: true,
          critRate: true,
          critDamage: true,
          effectHit: true,
          effectResistance: true,
        },
        orderBy: { id: "asc" },
      });
      const heroesById = Object.fromEntries(
        rows.map((row) => [
          row.id,
          {
            id: row.id,
            name: row.name,
            slug: row.slug,
            level: row.level,
            rarityCode: rarityCodes[row.level],
            lowestRank: Number(row.lowestRank) || 0,
            isCollaboration: Boolean(row.isCollaboration),
            baseStats: {
              attack: Number(row.attack),
              health: Number(row.health),
              defense: Number(row.defense),
              speed: Number(row.speed),
              critRate: Number(row.critRate),
              critDamage: Number(row.critDamage),
              effectHit: Number(row.effectHit),
              effectResistance: Number(row.effectResistance),
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
      const rows = await this.databaseService.relicSuit.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          twoPieceAttribute: true,
          twoPieceEffect: true,
          isOma: true,
        },
        orderBy: { id: "asc" },
      });

      return {
        yuhun_list: rows.map((row) => [
          row.id,
          row.name,
          row.slug,
          row.isOma ? row.twoPieceEffect : row.twoPieceAttribute,
          row.isOma ? "" : row.twoPieceEffect,
        ]),
        two_suit_yuhun: Object.fromEntries(
          rows
            .filter((row) => Boolean(row.isOma))
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
