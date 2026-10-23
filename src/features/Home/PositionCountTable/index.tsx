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
      <dl className={styles.table}>
        {counts.map(({ position, count }) => (
          <div className={styles.position} key={position}>
            <dt>{position}号位</dt>
            <dd>{displayNumber(count)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
