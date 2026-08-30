import { displayNumber } from "../homeFormatters";
import type { PositionCountTableProps } from "./index.types";
import "./index.scss";

export function PositionCountTable({
  counts,
  title = "各号位满速数量",
  description = "6 星满级且副属性满速",
}: PositionCountTableProps) {
  return (
    <div className="overview-full-speed-table-wrap">
      <div className="overview-full-speed-table-heading">
        <span>{title}</span>
        <small>{description}</small>
      </div>
      <table className="overview-full-speed-table">
        <thead>
          <tr>
            {counts.map(({ position }) => (
              <th key={position} scope="col">
                {position}号位
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {counts.map(({ position, count }) => (
              <td key={position}>{displayNumber(count)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
