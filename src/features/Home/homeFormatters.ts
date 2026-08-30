export function displayNumber(value: number | undefined) {
  return value === undefined ? "-" : value.toLocaleString("zh-CN");
}

export function displayUsageStatus(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return value > 0 ? "未使用" : "已使用";
}

export function displayGold(value: number | undefined) {
  if (value === undefined) return "-";
  const units = ["", "万", "亿", "兆"];
  let amount = Math.abs(value);
  let unitIndex = 0;
  while (amount >= 10000 && unitIndex < units.length - 1) {
    amount /= 10000;
    unitIndex += 1;
  }
  const truncated = Math.floor(amount * 10) / 10;
  const formatted =
    unitIndex === 0
      ? String(amount)
      : unitIndex === 1 && Number.isInteger(truncated)
        ? String(truncated)
        : truncated.toFixed(1);
  return `${value < 0 ? "-" : ""}${formatted}${units[unitIndex]}`;
}

export function displayRelicSpeed(value: number | undefined) {
  return value === undefined ? "-" : `+${value.toFixed(2)}`;
}

export function displayHeadAndTail(
  head: number | undefined,
  tail: number | undefined,
) {
  if (head === undefined && tail === undefined) return "-";
  return `${head ?? "-"}头 ${tail ?? "-"}尾`;
}
