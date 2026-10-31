"use client";

import { Fragment } from "react";
import {
  categoryLabel,
  formatNumber,
  padRank,
  platformLabel,
  rangeLabel,
} from "@/lib/format";
import type {
  MainCategory,
  Platform,
  RangeKey,
  RankedPlayer,
} from "@/lib/types";
import ChangeBadge, { changeLabel } from "./change-badge";
import styles from "./player-table.module.css";

type PlayerTableProps = {
  players: RankedPlayer[];
  platform: Platform;
  category: MainCategory;
  range: RangeKey;
  query: string;
  onSelect: (playerId: string) => void;
};

/**
 * The list presentation of the club ranking.
 *
 * Presentational only: it renders the array it is handed, in the order it is
 * handed, and never re-filters, re-sorts, or re-ranks. The board and the list
 * therefore cannot disagree about the standings.
 */
export default function PlayerTable({
  players,
  platform,
  category,
  range,
  query,
  onSelect,
}: PlayerTableProps) {
  const platformName = platformLabel(platform);
  const categoryName = categoryLabel(category);
  const rangeName = rangeLabel(range);

  const firstUnratedIndex = players.findIndex(
    (player) => player.rating == null,
  );
  const empty = players.length === 0;

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className="sr-only">
          {platformName} {categoryName} ratings, ranked, with {rangeName}{" "}
          rating changes.
        </caption>
        <thead>
          <tr>
            <th scope="col" className={styles.rankHead}>
              Rank
            </th>
            <th scope="col">Player</th>
            <th scope="col" className={styles.numHead}>
              Rating
            </th>
            <th scope="col" className={styles.numHead}>
              {rangeName} change
            </th>
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td className={styles.empty} colSpan={4}>
                <strong>No player matches “{query}”.</strong>
                Try a name or username from the group.
              </td>
            </tr>
          ) : (
            players.map((player, index) => {
              const positionLabel = player.handle
                ? `${platformName} handle ${player.handle}`
                : `no ${platformName} account`;

              const ariaLabel =
                player.rating == null
                  ? `${player.name}, ${positionLabel}, unrated in ${categoryName} on ${platformName}. Open scorecard.`
                  : `Number ${player.rank}: ${player.name}, ${positionLabel}, ${player.rating} ${platformName} ${categoryName} rating. ${changeLabel(player.change)}. Open scorecard.`;

              return (
                <Fragment key={player.id}>
                  {index === firstUnratedIndex ? (
                    <tr className={styles.dividerRow}>
                      <th
                        scope="colgroup"
                        colSpan={4}
                        className={styles.divider}
                      >
                        Unrated in this view
                      </th>
                    </tr>
                  ) : null}

                  <tr
                    className={styles.row}
                    onClick={() => onSelect(player.id)}
                  >
                    <td
                      className={`${styles.rank} ${
                        player.rating != null && player.rank <= 3
                          ? styles.rankPodium
                          : ""
                      }`}
                    >
                      {player.rating == null ? "—" : padRank(player.rank)}
                    </td>
                    <td className={styles.playerCell}>
                      <button
                        type="button"
                        className={styles.nameButton}
                        aria-label={ariaLabel}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(player.id);
                        }}
                      >
                        <span className={styles.name}>{player.name}</span>
                        <span className={styles.handle}>
                          {player.handle ?? `No ${platformName} account`}
                        </span>
                      </button>
                    </td>
                    <td className={styles.rating}>
                      {formatNumber(player.rating)}
                    </td>
                    <td className={styles.change}>
                      {player.rating != null ? (
                        <ChangeBadge change={player.change} compact />
                      ) : (
                        <>
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">
                            Rating change unavailable
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
