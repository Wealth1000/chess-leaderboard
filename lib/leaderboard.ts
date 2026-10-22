import type {
  LeaderboardModel,
  Platform,
  Player,
  RankedPlayer,
  Snapshot,
} from "@/lib/types";

export const BOARD_SQUARES = 64;

export function ratingFor(snapshot: Snapshot | null, platform: Platform) {
  return (
    snapshot?.ratings.find(
      (rating) =>
        rating.platform === platform && typeof rating.rating === "number",
    )?.rating ?? null
  );
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
  platform: Platform,
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
        snapshot?.ratings
          .map((rating) => rating.platform)
          .filter(
            (entry, index, all) =>
              all.indexOf(entry) === index &&
              (entry === "chess.com" || entry === "lichess"),
          ) ?? [];
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
        rating: ratingFor(snapshot, platform),
        aliasText,
        rank: 0,
      };
    })
    .sort((a, b) => {
      if (a.rating == null && b.rating == null) {
        return a.name.localeCompare(b.name);
      }
      if (a.rating == null) return 1;
      if (b.rating == null) return -1;
      return b.rating - a.rating;
    });

  let rank = 0;
  ranked.forEach((player) => {
    if (player.rating != null) {
      rank += 1;
      player.rank = rank;
    }
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
