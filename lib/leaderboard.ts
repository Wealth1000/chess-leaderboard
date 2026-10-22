import type { LeaderboardModel, Player, RankedPlayer, Snapshot } from "@/lib/types";

export const BOARD_SQUARES = 64;

export function ratingFor(snapshot: Snapshot | null) {
  const ratings =
    snapshot?.ratings
      .map((rating) => rating.rating)
      .filter((rating): rating is number => typeof rating === "number") ?? [];

  return ratings.length ? Math.max(...ratings) : null;
}

export function latestSnapshotDate(snapshots: Snapshot[]) {
  const dates = [
    ...new Set(snapshots.map((snapshot) => snapshot.date).filter(Boolean)),
  ].sort();
  return dates[dates.length - 1] ?? "";
}

export function buildLeaderboard(
  players: Player[],
  snapshots: Snapshot[],
): LeaderboardModel {
  const latestDate = latestSnapshotDate(snapshots);
  const latestSnapshots = latestDate
    ? snapshots.filter((snapshot) => snapshot.date === latestDate)
    : [];
  const snapshotsByPlayer = new Map(
    latestSnapshots.map((snapshot) => [snapshot.playerId, snapshot]),
  );

  const ranked: RankedPlayer[] = players
    .map((player) => {
      const snapshot = snapshotsByPlayer.get(player.id) ?? null;
      const platforms =
        snapshot?.ratings.map((rating) => rating.platform) ?? [];
      const aliasText = [
        player.id,
        player.name,
        player.chessCom,
        player.lichess,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return {
        ...player,
        snapshot,
        platforms,
        rating: ratingFor(snapshot),
        aliasText,
        rank: 0,
      };
    })
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));

  ranked.forEach((player, index) => {
    player.rank = index + 1;
  });

  return {
    ranked,
    latestDate,
    leader: ranked.find((player) => player.rating != null) ?? null,
  };
}

export function getSeatInfo(playerCount: number) {
  const openSeats = BOARD_SQUARES - playerCount;

  if (openSeats > 0) {
    return {
      openSeats,
      label: "Seats open",
      value: String(openSeats).padStart(2, "0"),
      note: `${BOARD_SQUARES} squares · ${playerCount} players · ${openSeats} open`,
    };
  }

  if (openSeats === 0) {
    return {
      openSeats,
      label: "Board status",
      value: "Full",
      note: `${BOARD_SQUARES} squares · ${playerCount} players · full board`,
    };
  }

  return {
    openSeats,
    label: "Extra players",
    value: `+${Math.abs(openSeats)}`,
    note: `${playerCount} players · board expanded`,
  };
}
