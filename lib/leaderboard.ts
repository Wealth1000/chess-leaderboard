import { buildRatingsView } from "@/lib/ratings-view";
import type {
  Category,
  LeaderboardModel,
  MainCategory,
  Platform,
  Player,
  Snapshot,
} from "@/lib/types";

export const BOARD_SQUARES = 64;

export { latestSnapshotDate } from "@/lib/ratings-view";

export function ratingFor(
  snapshot: Snapshot | null,
  platform: Platform,
  category: Category = "rapid",
) {
  return (
    snapshot?.ratings.find(
      (rating) =>
        rating.platform === platform &&
        rating.category === category &&
        typeof rating.rating === "number",
    )?.rating ?? null
  );
}

export function buildLeaderboard(
  players: Player[],
  snapshots: Snapshot[],
  platform: Platform,
  category: MainCategory = "rapid",
): LeaderboardModel {
  const view = buildRatingsView(players, snapshots, {
    platform,
    category,
    range: "7d",
    focusPlayerId: null,
  });

  return {
    ranked: view.ranked,
    latestDate: view.latestDate,
    leader: view.leader,
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
