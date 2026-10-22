import type { Snapshot } from "@/lib/types";

export function getPlayerHistory(snapshots: Snapshot[], playerId: string) {
  const playerSnapshots = snapshots
    .filter((snapshot) => snapshot.playerId === playerId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const dates = [...new Set(playerSnapshots.map((snapshot) => snapshot.date))];
  const platforms = [
    ...new Set(
      playerSnapshots.flatMap((snapshot) =>
        snapshot.ratings.map((rating) => rating.platform),
      ),
    ),
  ];

  return { playerSnapshots, dates, platforms };
}
