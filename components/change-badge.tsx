import { formatDate } from "@/lib/format";
import type { RatingChange } from "@/lib/types";
import styles from "./change-badge.module.css";

type ChangeBadgeProps = {
  change: RatingChange;
  compact?: boolean;
  showDate?: boolean;
  className?: string;
};

function hasDelta(change: RatingChange): change is RatingChange & {
  delta: number;
} {
  return change.delta != null && Number.isFinite(change.delta);
}

/**
 * A textual direction and point value for assistive technology. Exported so
 * surfaces that wrap a badge inside an interactive element can repeat the
 * information in their own accessible name.
 */
export function changeLabel(change: RatingChange): string {
  const since = change.comparisonDate
    ? ` since ${formatDate(change.comparisonDate)}`
    : "";

  if (!hasDelta(change)) return "Rating change unavailable";

  const points = Math.abs(change.delta);
  const pointText = `${points} ${points === 1 ? "point" : "points"}`;

  if (change.delta > 0) return `Up ${pointText}${since}`;
  if (change.delta < 0) return `Down ${pointText}${since}`;
  return `No change${since}`;
}

export default function ChangeBadge({
  change,
  compact = false,
  showDate = false,
  className,
}: ChangeBadgeProps) {
  const delta = hasDelta(change) ? change.delta : null;
  const direction =
    delta == null ? "unavailable" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  let visual = "—";
  if (delta != null && delta > 0) {
    visual = `↑ +${Math.abs(delta)}`;
  } else if (delta != null && delta < 0) {
    visual = `↓ −${Math.abs(delta)}`;
  }

  const classes = [
    styles.badge,
    styles[direction],
    compact ? styles.compact : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} role="img" aria-label={changeLabel(change)}>
      <span className={styles.value} aria-hidden="true">
        {visual}
      </span>
      {showDate && change.comparisonDate ? (
        <span className={styles.date} aria-hidden="true">
          since {formatDate(change.comparisonDate)}
        </span>
      ) : null}
    </span>
  );
}
