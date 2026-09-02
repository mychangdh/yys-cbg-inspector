import { displayNumber } from "../homeFormatters";
import styles from "./index.module.scss";

type PositionCountTableProps = {
  counts: Array<{ position: number; count: number }>;
  title?: string;
  description?: string;
};

export function PositionCountTable({
  counts,
  title = "各号位满速数量",
  description = "6 星满级且副属性满速",
}: PositionCountTableProps) {
  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableHeading}>
        <span>{title}</span>
        <small>{description}</small>
      </div>
      <table className={styles.table}>
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
