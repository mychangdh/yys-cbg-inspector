import { Tag, Typography } from "antd";
import { RelicIcon } from "../../RelicIcon";
import {
  formatAttribute,
  getStageAttributeHitCount,
  sortAttributes,
} from "@/lib/relics";
import { getSubAttributeHighlightClasses } from "../enhancementUtils";
import type { EnhancementStageCardProps } from "./index.types";
import "./index.scss";

export function EnhancementStageCard({
  item,
  stage,
  highlightedAttributes,
}: EnhancementStageCardProps) {
  return (
    <div className={`enhance-stage${stage.available ? "" : " is-unavailable"}`}>
      <RelicIcon
        item={item}
        compact
        displayLevel={stage.level}
        showLevelBadge
      />
      {stage.available ? (
        <div className="enhance-stage-attributes">
          {stage.mainAttribute && (
            <div className="enhance-main-attribute">
              <span>
                <i className="attribute-hit-count is-empty" />
                {stage.mainAttribute.label}
              </span>
              <strong>+{formatAttribute(stage.mainAttribute)}</strong>
            </div>
          )}
          {sortAttributes(stage.attributes).map((attribute) => {
            const isUpgraded = stage.upgrade?.key === attribute.key;
            const hitCount = getStageAttributeHitCount(item, attribute);
            return (
              <div
                className={`enhance-stage-attribute${isUpgraded ? " is-upgraded" : ""} ${getSubAttributeHighlightClasses(item, attribute, highlightedAttributes)}`}
                key={attribute.key}
                title={attribute.values
                  .map((value) => value.toFixed(15))
                  .join(" + ")}
              >
                <span>
                  <i
                    className={`attribute-hit-count${hitCount > 0 ? "" : " is-empty"}`}
                  >
                    {hitCount > 0 ? hitCount : ""}
                  </i>
                  <em>{attribute.label}</em>
                  {isUpgraded && stage.upgrade?.isNew && (
                    <Tag color="red">NEW</Tag>
                  )}
                </span>
                <strong>+{attribute.value.toFixed(2)}</strong>
              </div>
            );
          })}
        </div>
      ) : (
        <Typography.Text type="secondary" className="enhance-not-yet">
          未强化
        </Typography.Text>
      )}
    </div>
  );
}
