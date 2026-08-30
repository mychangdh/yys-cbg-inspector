import type { RelicView } from "@/types";

export function getSubAttributeHighlightClasses(
  item: RelicView,
  attribute: { label: string; value: number },
  highlightedAttributes: ReadonlySet<string>,
) {
  const classes: string[] = [];
  const isSpeed = attribute.label === "速度";
  const isSecondPositionSpeed =
    item.position === 2 && item.mainAttribute?.label === "速度";

  if (highlightedAttributes.has(attribute.label)) {
    classes.push("is-filter-match");
  }

  // 2 号位非主速度时，副速度不作为一速卖点展示。
  if (
    isSpeed &&
    attribute.value > 17 &&
    (item.position !== 2 || isSecondPositionSpeed)
  ) {
    classes.push("is-speed-seller-point");
    if (isSecondPositionSpeed)
      classes.push("is-second-position-speed-seller-point");
  }

  return classes.join(" ");
}
