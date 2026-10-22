import { getPlayerHistory } from "@/lib/history";
import type {
  Category,
  ChessComExtras,
  MainCategory,
  Platform,
  Player,
  RangeKey,
  RankedPlayer,
  RatingChange,
  Snapshot,
  ViewState,
} from "@/lib/types";

export const DEFAULT_VIEW_STATE: ViewState = {
  platform: "chess.com",
  category: "rapid",
  range: "7d",
  focusPlayerId: null,
};

export const MAIN_CATEGORIES: MainCategory[] = [
  "rapid",
  "classical",
  "blitz",
  "puzzle",
];

export const ALL_CATEGORIES: Category[] = [
  "rapid",
  "classical",
  "blitz",
  "bullet",
  "puzzle",
];

export const RANGES: RangeKey[] = ["7d", "30d", "90d", "all"];

const RANGE_DAYS: Record<Exclude<RangeKey, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export type ChartPoint = {
  date: string;
  value: number;
};

export type ChartSeries = {
  playerId: string;
  playerName: string;
  points: ChartPoint[];
  latestValue: number | null;
};

export type FieldChartModel = {
  dates: string[];
  series: ChartSeries[];
  leaders: ChartSeries[];
  hasData: boolean;
};

export type FocusPeer = {
  playerId: string;
  playerName: string;
  baselineRating: number;
  currentRating: number | null;
  totalChange: number | null;
  distance: number;
};

export type FocusModel = {
  playerId: string;
  playerName: string;
  missingRating: boolean;
  baselineDate: string | null;
  baselineRating: number | null;
  currentRating: number | null;
  totalChange: number | null;
  peerAverageChange: number | null;
  position: number | null;
  groupSize: number;
  peers: FocusPeer[];
  smallGroup: boolean;
  dates: string[];
  focusSeries: ChartSeries | null;
  peerSeries: ChartSeries[];
  band: Array<{ date: string; min: number; max: number }>;
};

export type ScorecardCellReason =
  | "rated"
  | "no-account"
  | "not-published"
  | "not-played"
  | "no-data";

export type ScorecardCell = {
  platform: Platform;
  category: Category;
  username: string | null;
  rating: number | null;
  reason: ScorecardCellReason;
  active: boolean;
};

export type ScorecardMatrixRow = {
  category: Category;
  cells: Record<Platform, ScorecardCell>;
};

export type ScorecardHistoryPoint = {
  date: string;
  rating: number;
};

export type PlayerScorecard = {
  playerId: string;
  playerName: string;
  player: Player;
  rank: number | null;
  currentRating: number | null;
  change: RatingChange;
  matrix: ScorecardMatrixRow[];
  activeCell: ScorecardCell;
  history: ScorecardHistoryPoint[];
  chessComExtras: ChessComExtras | null;
};

export type RatingsNotice = { kind: "chesscom-puzzle" } | null;

export type RatingsViewModel = {
  platform: Platform;
  category: MainCategory;
  range: RangeKey;
  latestDate: string;
  targetDate: string | null;
  hasSnapshots: boolean;
  ranked: RankedPlayer[];
  rated: RankedPlayer[];
  leader: RankedPlayer | null;
  average: number | null;
  top10: number | null;
  ratedCount: number;
  changesAvailable: boolean;
  field: FieldChartModel;
  focus: FocusModel | null;
  scorecards: Record<string, PlayerScorecard>;
  notice: RatingsNotice;
};

type RatedSnapshot = {
  date: string;
  rating: number;
};

function isPlatform(value: string): value is Platform {
  return value === "chess.com" || value === "lichess";
}

export function latestSnapshotDate(snapshots: Snapshot[]) {
  const dates = [
    ...new Set(snapshots.map((snapshot) => snapshot.date).filter(Boolean)),
  ].sort();
  return dates[dates.length - 1] ?? "";
}

function subtractDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function targetDateFor(latestDate: string, range: RangeKey) {
  if (!latestDate || range === "all") return null;
  return subtractDays(latestDate, RANGE_DAYS[range]);
}

/**
 * The rating entry that actually drives a member's rating on a platform.
 *
 * Matching is gated by account presence: a member with no handle on `platform`
 * has no rating there, even when the snapshot file contains a same-platform
 * entry for someone else. This is the single gate that keeps ratings from
 * being borrowed across identities.
 */
function ratingEntryFromSnapshot(
  snapshot: Snapshot | null,
  player: Player,
  platform: Platform,
  category: Category,
) {
  const handle = handleFor(player, platform);
  if (!handle) return null;

  return (
    snapshot?.ratings.find(
      (rating) =>
        rating.platform === platform &&
        rating.category === category &&
        typeof rating.rating === "number",
    ) ?? null
  );
}

function ratingFromSnapshot(
  snapshot: Snapshot | null,
  player: Player,
  platform: Platform,
  category: Category,
) {
  return ratingEntryFromSnapshot(snapshot, player, platform, category)?.rating ?? null;
}

function aliasTextFor(player: Player) {
  return [player.id, player.name, player.chessCom, player.lichess]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * The member's handle for a platform, or null when they have no account there.
 */
export function handleFor(player: Player, platform: Platform) {
  return (platform === "chess.com" ? player.chessCom : player.lichess) ?? null;
}

/**
 * The name to show for a member, on every platform.
 *
 * The member alias is always the primary visible name: a dual-account member
 * such as Wealth renders as "Wealth" on both Chess.com and Lichess, never as
 * their platform handle. The per-platform handle stays available through
 * `handleFor` for account resolution, gating, and secondary context.
 */
export function displayNameFor(player: Player, _platform: Platform) {
  return player.name;
}

export function buildRatingsView(
  players: Player[],
  snapshots: Snapshot[],
  view: ViewState,
): RatingsViewModel {
  const { platform, category, range } = view;
  const latestDate = latestSnapshotDate(snapshots);
  const targetDate = targetDateFor(latestDate, range);
  const inRange = (date: string) => targetDate == null || date >= targetDate;

  const snapshotsByPlayerDate = new Map<string, Map<string, Snapshot>>();
  for (const snapshot of snapshots) {
    if (!snapshot?.playerId || !snapshot.date) continue;
    let byDate = snapshotsByPlayerDate.get(snapshot.playerId);
    if (!byDate) {
      byDate = new Map<string, Snapshot>();
      snapshotsByPlayerDate.set(snapshot.playerId, byDate);
    }
    byDate.set(snapshot.date, snapshot);
  }

  const snapshotAt = (playerId: string, date: string) =>
    snapshotsByPlayerDate.get(playerId)?.get(date) ?? null;

  const latestSnapshotFor = (playerId: string) =>
    latestDate ? snapshotAt(playerId, latestDate) : null;

  const ratedHistory = (player: Player): RatedSnapshot[] =>
    getPlayerHistory(snapshots, player.id, platform, category, {
      username: handleFor(player, platform),
    }).playerSnapshots.map((snapshot) => ({
      date: snapshot.date,
      rating: snapshot.ratings[0].rating as number,
    }));

  const changeFor = (
    player: Player,
    latestRating: number | null,
  ): RatingChange => {
    const latestChangeDate = latestDate || null;

    if (!latestDate || latestRating == null) {
      return {
        delta: null,
        direction: "unavailable",
        comparisonDate: null,
        latestDate: latestChangeDate,
      };
    }

    const history = ratedHistory(player);
    let comparison: RatedSnapshot | null = null;

    if (range === "all") {
      const first = history[0];
      if (first && first.date < latestDate) comparison = first;
    } else if (targetDate) {
      // Prefer the closest snapshot on or before the target date. When the
      // range reaches back further than any stored snapshot, fall back to the
      // earliest snapshot we have so the change still reflects the widest
      // available window instead of reporting "unavailable".
      for (const entry of history) {
        if (entry.date <= targetDate && entry.date < latestDate) {
          comparison = entry;
        }
      }

      if (!comparison) {
        const earliest = history.find((entry) => entry.date < latestDate);
        if (earliest) comparison = earliest;
      }
    }

    if (!comparison) {
      return {
        delta: null,
        direction: "unavailable",
        comparisonDate: null,
        latestDate: latestChangeDate,
      };
    }

    const delta = latestRating - comparison.rating;

    return {
      delta,
      direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
      comparisonDate: comparison.date,
      latestDate: latestChangeDate,
    };
  };

  const ranked: RankedPlayer[] = players
    .map((player) => {
      const snapshot = latestSnapshotFor(player.id);
      const rating = ratingFromSnapshot(snapshot, player, platform, category);
      const platforms = snapshot
        ? [
            ...new Set(
              snapshot.ratings
                .map((entry) => entry.platform)
                .filter(isPlatform),
            ),
          ]
        : [];

      return {
        ...player,
        snapshot,
        platforms,
        handle: handleFor(player, platform),
        rating,
        aliasText: aliasTextFor(player),
        rank: 0,
        change: changeFor(player, rating),
      };
    })
    .sort((a, b) => {
      if (a.rating == null && b.rating == null) {
        return a.name.localeCompare(b.name);
      }
      if (a.rating == null) return 1;
      if (b.rating == null) return -1;
      return b.rating - a.rating || a.name.localeCompare(b.name);
    });

  let rank = 0;
  for (const player of ranked) {
    if (player.rating != null) {
      rank += 1;
      player.rank = rank;
    }
  }

  const rankedById = new Map(ranked.map((player) => [player.id, player]));
  const rated = ranked.filter((player) => player.rating != null);
  const average = rated.length
    ? Math.round(
        rated.reduce((total, player) => total + (player.rating ?? 0), 0) /
          rated.length,
      )
    : null;
  const top10 = rated.length
    ? rated[Math.min(9, rated.length - 1)].rating
    : null;

  const fieldSeries: ChartSeries[] = [];
  for (const player of players) {
    const points = ratedHistory(player)
      .filter((entry) => inRange(entry.date))
      .map((entry) => ({ date: entry.date, value: entry.rating }));

    if (!points.length) continue;

    fieldSeries.push({
      playerId: player.id,
      playerName: displayNameFor(player, platform),
      points,
      latestValue: points[points.length - 1]?.value ?? null,
    });
  }

  fieldSeries.sort((a, b) => {
    const aValue = a.latestValue ?? Number.NEGATIVE_INFINITY;
    const bValue = b.latestValue ?? Number.NEGATIVE_INFINITY;
    return bValue - aValue || a.playerName.localeCompare(b.playerName);
  });

  const field: FieldChartModel = {
    dates: [...new Set(fieldSeries.flatMap((series) => series.points.map((point) => point.date)))].sort(),
    series: fieldSeries,
    leaders: fieldSeries.slice(0, 5),
    hasData: fieldSeries.length > 0,
  };

  const scorecards: Record<string, PlayerScorecard> = {};
  for (const player of players) {
    const ranking = rankedById.get(player.id);
    if (!ranking) continue;

    const matrix: ScorecardMatrixRow[] = ALL_CATEGORIES.map((entry) => ({
      category: entry,
      cells: {
        "chess.com": buildCell(player, "chess.com", entry, ranking.snapshot, view),
        lichess: buildCell(player, "lichess", entry, ranking.snapshot, view),
      },
    }));

    const history = ratedHistory(player)
      .filter((entry) => inRange(entry.date))
      .map((entry) => ({ date: entry.date, rating: entry.rating }));

    scorecards[player.id] = {
      playerId: player.id,
      playerName: player.name,
      player,
      rank: ranking.rating == null ? null : ranking.rank,
      currentRating: ranking.rating,
      change: ranking.change,
      matrix,
      activeCell: {
        platform,
        category,
        username: handleFor(player, platform),
        rating: ranking.rating,
        reason: cellReasonFor(
          player,
          platform,
          category,
          ranking.snapshot,
          ranking.rating,
        ),
        active: true,
      },
      history,
      chessComExtras: ranking.snapshot?.chessComExtras ?? null,
    };
  }

  const focus = buildFocus({
    players,
    view,
    rankedById,
    snapshotAt,
    ratedHistory,
    inRange,
  });

  return {
    platform,
    category,
    range,
    latestDate,
    targetDate,
    hasSnapshots: latestDate !== "",
    ranked,
    rated,
    leader: rated[0] ?? null,
    average,
    top10,
    ratedCount: rated.length,
    changesAvailable: ranked.some(
      (player) => player.change.comparisonDate != null,
    ),
    field,
    focus,
    scorecards,
    notice:
      platform === "chess.com" && category === "puzzle"
        ? { kind: "chesscom-puzzle" }
        : null,
  };
}

function cellReasonFor(
  player: Player,
  platform: Platform,
  category: Category,
  snapshot: Snapshot | null,
  rating: number | null,
): ScorecardCellReason {
  if (!handleFor(player, platform)) return "no-account";
  if (platform === "chess.com" && category === "puzzle") {
    return "not-published";
  }
  if (!snapshot) return "no-data";

  const entry = snapshot.ratings.find(
    (value) =>
      value.platform === platform &&
      value.category === category &&
      value.username === handleFor(player, platform),
  );

  if (!entry) return "no-data";
  if (entry.rating == null) return "not-played";
  return rating == null ? "no-data" : "rated";
}

function buildCell(
  player: Player,
  platform: Platform,
  category: Category,
  snapshot: Snapshot | null,
  view: ViewState,
): ScorecardCell {
  const username = handleFor(player, platform);
  const rating = ratingFromSnapshot(snapshot, player, platform, category);
  const reason = cellReasonFor(
    player,
    platform,
    category,
    snapshot,
    rating,
  );

  return {
    platform,
    category,
    username,
    rating: reason === "rated" ? rating : null,
    reason,
    active: view.platform === platform && view.category === category,
  };
}

type FocusInput = {
  players: Player[];
  view: ViewState;
  rankedById: Map<string, RankedPlayer>;
  snapshotAt: (playerId: string, date: string) => Snapshot | null;
  ratedHistory: (player: Player) => RatedSnapshot[];
  inRange: (date: string) => boolean;
};

function buildFocus({
  players,
  view,
  rankedById,
  snapshotAt,
  ratedHistory,
  inRange,
}: FocusInput): FocusModel | null {
  const focusId = view.focusPlayerId;
  if (!focusId) return null;

  const player = players.find((entry) => entry.id === focusId);
  if (!player) return null;

  const displayName = displayNameFor(player, view.platform);
  const focusRanking = rankedById.get(focusId);
  const currentRating = focusRanking?.rating ?? null;

  if (currentRating == null) {
    return {
      playerId: player.id,
      playerName: displayName,
      missingRating: true,
      baselineDate: null,
      baselineRating: null,
      currentRating: null,
      totalChange: null,
      peerAverageChange: null,
      position: null,
      groupSize: 1,
      peers: [],
      smallGroup: true,
      dates: [],
      focusSeries: null,
      peerSeries: [],
      band: [],
    };
  }

  const history = ratedHistory(player).filter((entry) =>
    inRange(entry.date),
  );
  const baseline = history[0];
  if (!baseline) {
    return {
      playerId: player.id,
      playerName: displayName,
      missingRating: true,
      baselineDate: null,
      baselineRating: null,
      currentRating,
      totalChange: null,
      peerAverageChange: null,
      position: null,
      groupSize: 1,
      peers: [],
      smallGroup: true,
      dates: [],
      focusSeries: null,
      peerSeries: [],
      band: [],
    };
  }

  const focusPoints = history.map((entry) => ({
    date: entry.date,
    value: entry.rating - baseline.rating,
  }));
  const focusSeries: ChartSeries = {
    playerId: player.id,
    playerName: displayName,
    points: focusPoints,
    latestValue: focusPoints[focusPoints.length - 1]?.value ?? null,
  };

  const candidates = players
    .filter((entry) => entry.id !== player.id)
    .map((entry) => {
      const snapshot = snapshotAt(entry.id, baseline.date);
      const rating = snapshot
        ? ratingFromSnapshot(snapshot, entry, view.platform, view.category)
        : null;
      return { player: entry, rating };
    })
    .filter(
      (entry): entry is { player: Player; rating: number } =>
        entry.rating != null && Math.abs(entry.rating - baseline.rating) <= 200,
    )
    .map((entry) => ({
      player: entry.player,
      rating: entry.rating,
      distance: Math.abs(entry.rating - baseline.rating),
    }))
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        displayNameFor(a.player, view.platform).localeCompare(
          displayNameFor(b.player, view.platform),
        ) ||
        a.player.id.localeCompare(b.player.id),
    )
    .slice(0, 8);

  const peers: FocusPeer[] = [];
  const peerSeries: ChartSeries[] = [];

  for (const candidate of candidates) {
    const peerCurrent = rankedById.get(candidate.player.id)?.rating ?? null;
    const peerDisplayName = displayNameFor(candidate.player, view.platform);
    const totalChange =
      peerCurrent == null ? null : peerCurrent - candidate.rating;
    const points = ratedHistory(candidate.player)
      .filter((entry) => entry.date >= baseline.date)
      .map((entry) => ({
        date: entry.date,
        value: entry.rating - candidate.rating,
      }));

    peers.push({
      playerId: candidate.player.id,
      playerName: peerDisplayName,
      baselineRating: candidate.rating,
      currentRating: peerCurrent,
      totalChange,
      distance: candidate.distance,
    });

    if (points.length) {
      peerSeries.push({
        playerId: candidate.player.id,
        playerName: peerDisplayName,
        points,
        latestValue: points[points.length - 1]?.value ?? null,
      });
    }
  }

  const totalChange = currentRating - baseline.rating;
  const peerChanges = peers
    .map((peer) => peer.totalChange)
    .filter((value): value is number => value != null);
  const peerAverageChange = peerChanges.length
    ? Math.round(
        peerChanges.reduce((total, value) => total + value, 0) /
          peerChanges.length,
      )
    : null;
  const position =
    1 + peers.filter((peer) => peer.totalChange != null && peer.totalChange > totalChange).length;

  const dates = [
    ...new Set([
      ...focusPoints.map((point) => point.date),
      ...peerSeries.flatMap((series) => series.points.map((point) => point.date)),
    ]),
  ].sort();

  const valuesByDate = new Map<string, number[]>();
  for (const series of peerSeries) {
    for (const point of series.points) {
      const values = valuesByDate.get(point.date) ?? [];
      values.push(point.value);
      valuesByDate.set(point.date, values);
    }
  }

  const band = [...valuesByDate.entries()]
    .map(([date, values]) => ({
      date,
      min: Math.min(...values),
      max: Math.max(...values),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    playerId: player.id,
    playerName: displayName,
    missingRating: false,
    baselineDate: baseline.date,
    baselineRating: baseline.rating,
    currentRating,
    totalChange,
    peerAverageChange,
    position,
    groupSize: peers.length + 1,
    peers,
    smallGroup: peers.length < 5,
    dates,
    focusSeries,
    peerSeries,
    band,
  };
}
