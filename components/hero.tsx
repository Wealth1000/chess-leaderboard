import { formatNumber, padRank } from "@/lib/format";
import { getSeatInfo } from "@/lib/leaderboard";
import type { RankedPlayer } from "@/lib/types";
import styles from "./hero.module.css";

type HeroProps = {
  ranked: RankedPlayer[];
  playerCount: number;
  loading: boolean;
  warning: boolean;
};

export default function Hero({ ranked, playerCount, loading, warning }: HeroProps) {
  const ratedPlayers = ranked.filter((player) => player.rating != null);
  const leader = ratedPlayers[0] ?? null;
  const leaderRating = leader?.rating ?? null;
  const seats = getSeatInfo(playerCount);

  const average = ratedPlayers.length
    ? Math.round(
        ratedPlayers.reduce((total, player) => total + (player.rating ?? 0), 0) /
          ratedPlayers.length,
      )
    : null;
  const top10 = ratedPlayers.length
    ? ratedPlayers[Math.min(9, ratedPlayers.length - 1)].rating
    : null;

  let meta = "Fetching the latest snapshot…";
  if (!loading) {
    if (!leader) {
      meta = warning
        ? "Ratings did not load. Reload the page to try again."
        : "The first daily snapshot will fill the board.";
    } else {
      const gap = ratedPlayers[1]
        ? (leaderRating ?? 0) - (ratedPlayers[1].rating ?? 0)
        : 0;
      const platformText =
        [...new Set(leader.platforms)].join(" + ") || "rating logged";
      const gapText = ratedPlayers[1]
        ? gap > 0
          ? `${formatNumber(gap)} points clear of #2`
          : "level with #2"
        : "first rating on the board";
      meta = `${platformText} · ${gapText}`;
    }
  }

  return (
    <section className={styles.hero} aria-labelledby="champion-name">
      <div className={styles.champion}>
        <p className="eyebrow">Top of the board</p>
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
            ratedPlayers.slice(1, 6).map((player) => (
              <li className={styles.chaseRow} key={player.id}>
                <span className={styles.chaseRank}>{padRank(player.rank)}</span>
                <span className={styles.chaseName} title={player.name}>
                  {player.name}
                </span>
                <span className={styles.chaseScore}>
                  <span className={styles.chaseRating}>
                    {formatNumber(player.rating)}
                  </span>
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
          <dd>{formatNumber(playerCount)}</dd>
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
    </section>
  );
}
