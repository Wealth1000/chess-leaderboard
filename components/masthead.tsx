import { formatDate } from "@/lib/format";
import type { Platform } from "@/lib/types";
import PlatformSwitch from "./platform-switch";
import styles from "./masthead.module.css";

type MastheadProps = {
  latestDate: string;
  loading: boolean;
  platform: Platform;
  onPlatformChange: (platform: Platform) => void;
};

export default function Masthead({
  latestDate,
  loading,
  platform,
  onPlatformChange,
}: MastheadProps) {
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
        <PlatformSwitch value={platform} onChange={onPlatformChange} />

        <div className={styles.meta}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>Snapshot</span>
          <time dateTime={latestDate || undefined}>{dateLabel}</time>
        </div>
      </div>
    </header>
  );
}
