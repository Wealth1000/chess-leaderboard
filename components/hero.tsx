import { categoryLabel, formatNumber, padRank, platformLabel } from "@/lib/format";
import { getSeatInfo } from "@/lib/leaderboard";
import type { RatingsViewModel } from "@/lib/ratings-view";
import ChangeBadge from "./change-badge";
import styles from "./hero.module.css";

type HeroProps = {
  model: RatingsViewModel;
  loading: boolean;
  warning: boolean;
};

export default function Hero({ model, loading, warning }: HeroProps) {
  const platformName = platformLabel(model.platform);
  const categoryName = categoryLabel(model.category);
  const { leader, rated, average, top10, changesAvailable } = model;
  const leaderRating = leader?.rating ?? null;
  const seats = getSeatInfo(model.ranked.length);

  let meta = "Fetching the latest snapshot…";
  if (!loading) {
    if (!leader) {
      meta = warning
        ? "Ratings did not load. Reload the page to try again."
        : `No ${platformName} ${categoryName} ratings in the latest snapshot.`;
    } else {
      const gap = rated[1]
        ? (leaderRating ?? 0) - (rated[1].rating ?? 0)
        : 0;
      const gapText = rated[1]
        ? gap > 0
          ? `${formatNumber(gap)} points clear of #2`
          : "level with #2"
        : "first rating on the board";
      const identityText =
        leader.handle ? ` · ${leader.handle} on ${platformName}` : "";
      meta = `${platformName} ${categoryName} · ${gapText}${identityText}`;
    }
  }

  return (
    <section className={styles.hero} aria-labelledby="champion-name">
      <div className={styles.champion}>
        <p className="eyebrow">
          Top of the board · {platformName} · {categoryName}
        </p>
        <div className={styles.championNameRow}>
          <span className={styles.championRank}>
            {loading ? "—" : leader ? padRank(leader.rank) : "—"}
          </span>
          <h1 className={styles.championName} id="champion-name">
            {loading ? "Reading the board" : leader?.name ?? "No ratings yet"}
          </h1>
        </div>
        <div className={styles.championScore}>
          <strong>{loading ? "—" : formatNumber(leaderRating)}</strong>
          <span>rating</span>
        </div>
        {!loading && leader ? (
          <div className={styles.championChange}>
            <ChangeBadge change={leader.change} showDate />
          </div>
        ) : null}
        <p className={styles.championMeta}>{meta}</p>
      </div>

      <div className={styles.chase}>
        <div className={styles.chaseHead}>
          <p className="eyebrow">The chase</p>
          <span className={styles.chaseNote}>points behind</span>
        </div>
        <ol className={styles.chaseList}>
          {loading ? (
            <li className={styles.chaseEmpty}>Loading…</li>
          ) : leader ? (
            rated.slice(1, 6).map((player) => (
              <li className={styles.chaseRow} key={player.id}>
                <span className={styles.chaseRank}>{padRank(player.rank)}</span>
                <span
                  className={styles.chaseName}
                  title={
                    player.handle
                      ? `${player.name} · ${platformName} ${player.handle}`
                      : `${player.name} · no ${platformName} account`
                  }
                >
                  {player.name}
                </span>
                <span className={styles.chaseScore}>
                  <span className={styles.chaseRating}>
                    {formatNumber(player.rating)}
                  </span>
                  <ChangeBadge change={player.change} compact />
                  <span className={styles.chaseGap}>
                    −{formatNumber((leaderRating ?? 0) - (player.rating ?? 0))}
                  </span>
                </span>
              </li>
            ))
          ) : (
            <li className={styles.chaseEmpty}>No ratings to chase yet.</li>
          )}
        </ol>
      </div>

      <dl className={styles.heroStats}>
        <div>
          <dt>Players</dt>
          <dd>{formatNumber(model.ranked.length)}</dd>
        </div>
        <div>
          <dt>Club average</dt>
          <dd>{loading ? "—" : formatNumber(average)}</dd>
        </div>
        <div>
          <dt>Top-10 cut</dt>
          <dd>{loading ? "—" : formatNumber(top10)}</dd>
        </div>
        <div>
          <dt>{seats.label}</dt>
          <dd>{seats.value}</dd>
        </div>
      </dl>

      {!loading && model.hasSnapshots && !changesAvailable ? (
        <p className={styles.changesNote}>
          Rating changes appear once an older snapshot exists for this range.
          Until then, neutral dashes mean “no comparison yet”, not “no change”.
        </p>
      ) : null}
    </section>
  );
}
