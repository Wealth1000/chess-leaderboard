import { formatDate } from "@/lib/format";
import styles from "./masthead.module.css";

type MastheadProps = {
  latestDate: string;
  loading: boolean;
};

export default function Masthead({ latestDate, loading }: MastheadProps) {
  const dateLabel = loading ? "—" : latestDate ? formatDate(latestDate) : "No snapshot";

  return (
    <header className={styles.masthead}>
      <a className={styles.brand} href="./">
        <span className={styles.brandMark} aria-hidden="true" />
        <span className={styles.brandText}>
          <span className={styles.brandName}>The Ladder</span>
          <span className={styles.brandSub}>Chess ratings for the group</span>
        </span>
      </a>

      <div className={styles.controls}>
        <div className={styles.meta}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>Snapshot</span>
          <time dateTime={latestDate || undefined}>{dateLabel}</time>
        </div>
      </div>
    </header>
  );
}
