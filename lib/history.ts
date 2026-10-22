import type { Platform, Snapshot } from "@/lib/types";

export function getPlayerHistory(
  snapshots: Snapshot[],
  playerId: string,
  platform: Platform,
) {
  const playerSnapshots = snapshots
    .filter((snapshot) => snapshot.playerId === playerId)
    .map((snapshot) => ({
      ...snapshot,
      ratings: snapshot.ratings.filter(
        (rating) => rating.platform === platform && rating.rating != null,
      ),
    }))
    .filter((snapshot) => snapshot.ratings.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const dates = [...new Set(playerSnapshots.map((snapshot) => snapshot.date))];

  return { playerSnapshots, dates };
}
