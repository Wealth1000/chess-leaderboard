import type { Category, Platform, Snapshot } from "@/lib/types";

export type PlayerHistoryOptions = {
  /**
   * The member's handle for `platform`, or null when they have no account
   * there. When the key is present and null the history is empty: a member
   * with no account on the active platform must never inherit another
   * account's ratings. Omit the key entirely to search without an account
   * filter.
   */
  username?: string | null;
};

/**
 * Rated snapshots for one member, one platform, one category.
 *
 * When `options.username` is supplied, only rating entries whose `username`
 * matches are counted. A `null` username means the member has no account on
 * the active platform, so the history is empty regardless of what the snapshot
 * file contains.
 */
export function getPlayerHistory(
  snapshots: Snapshot[],
  playerId: string,
  platform: Platform,
  category: Category = "rapid",
  options: PlayerHistoryOptions = {},
) {
  const hasAccountFilter = Object.prototype.hasOwnProperty.call(
    options,
    "username",
  );
  const { username } = options;

  const playerSnapshots = snapshots
    .filter((snapshot) => snapshot.playerId === playerId)
    .map((snapshot) => ({
      ...snapshot,
      ratings: snapshot.ratings.filter(
        (rating) =>
          rating.platform === platform &&
          rating.category === category &&
          typeof rating.rating === "number" &&
          (!hasAccountFilter || rating.username === username),
      ),
    }))
    .filter((snapshot) => snapshot.ratings.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const dates = [...new Set(playerSnapshots.map((snapshot) => snapshot.date))];

  return { playerSnapshots, dates };
}
