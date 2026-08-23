import type { RelicView } from "../../types";

const twoPieceAttributeCache = new Map<
  string,
  RelicView["mainAttribute"] | null
>();

/**
 * 解析静态配置中的两件套文本。
 *
 * 套装配置会在每个搜索分支反复读取，缓存解析结果避免重复正则匹配；
 * 返回值保持与御魂属性相同的结构，以便复用同一套面板累加规则。
 */
export function parseTwoPieceAttribute(
  text?: string,
): RelicView["mainAttribute"] | null {
  const cacheKey = String(text || "");
  const cached = twoPieceAttributeCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const match = cacheKey.match(
    /^(速度|暴击伤害|暴击|攻击加成|攻击|生命加成|生命|防御加成|防御|效果命中|效果抵抗)\s*\+?\s*(\d+(?:\.\d+)?)%?$/,
  );
  if (!match) {
    twoPieceAttributeCache.set(cacheKey, null);
    return null;
  }

  const parsed = {
    label: match[1],
    value: Number(match[2]),
    isPercent: cacheKey.includes("%"),
  };
  twoPieceAttributeCache.set(cacheKey, parsed);
  return parsed;
}
