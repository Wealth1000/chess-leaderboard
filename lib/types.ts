export type Platform = "chess.com" | "lichess";

export type Category = "rapid" | "classical" | "blitz" | "bullet" | "puzzle";

export type MainCategory = "rapid" | "classical" | "blitz" | "puzzle";

export type RangeKey = "7d" | "30d" | "90d" | "all";

export type Player = {
  id: string;
  name: string;
  chessCom?: string;
  lichess?: string;
};

export type PlayerRating = {
  username: string;
  platform: Platform;
  category: Category;
  rating: number | null;
  /**
   * Cumulative games played for this category, when the platform reports it.
   * Omitted entirely (never defaulted to 0) when no count is known, so
   * v1-derived and pre-change snapshots stay valid.
   */
  gamesPlayed?: number;
};

export type ChessComExtras = {
  tacticsHigh: number | null;
  puzzleRushBest: number | null;
};

export type Snapshot = {
  playerId: string;
  playerName: string;
  date: string;
  ratings: PlayerRating[];
  chessComExtras?: ChessComExtras | null;
};

export type SnapshotFile = {
  snapshots: Snapshot[];
};

/**
 * How the rankings are presented. Presentation-only: the same ranking drives
 * both the board and the list, so `layout` never influences the ratings model.
 */
export type Layout = "board" | "list";

export type ViewState = {
  platform: Platform;
  category: MainCategory;
  range: RangeKey;
  focusPlayerId: string | null;
  layout: Layout;
};

export type RatingChange = {
  delta: number | null;
  direction: "up" | "down" | "flat" | "unavailable";
  comparisonDate: string | null;
  latestDate: string | null;
};

export type RankedPlayer = Player & {
  rank: number;
  rating: number | null;
  /**
   * Member handle for the active platform, or null when they have no account.
   * Used for account resolution, gating, and secondary context only; the
   * visible name is always `player.name`.
   */
  handle: string | null;
  platforms: Platform[];
  aliasText: string;
  snapshot: Snapshot | null;
  change: RatingChange;
};

export type LeaderboardModel = {
  ranked: RankedPlayer[];
  latestDate: string;
  leader: RankedPlayer | null;
};

export type SnapshotStatus = "loading" | "ready" | "warning";

/**
 * Storage-only types. These describe the compact shape written to the gist and
 * are never consumed by the UI; `decodeSnapshotDocument` maps them onto the
 * domain `Snapshot`. See `docs/specs/2026-10-31-snapshot-format-v2.md`.
 */

/** Ratings for one account in the compact v2 shape; `null` means unplayed. */
export type StoredRatingsMap = Partial<Record<Category, number>>;

/** A single account entry nested under a v2 snapshot's `accounts` map. */
export type StoredAccountEntry = {
  username: string;
  /** Categories with a real value. Categories in neither map emit no entry. */
  ratings?: StoredRatingsMap;
  /** Categories known to be unavailable, distinct from "no data". */
  unplayed?: Category[];
  /** Cumulative games per category; puzzle is never included. */
  gamesPlayed?: Partial<Record<Category, number>>;
};

/**
 * A v2 stored snapshot: identity + a map of platform accounts. Legacy v1
 * entries have a top-level `ratings` array instead and are never rewritten.
 */
export type StoredSnapshotV2 = {
  playerId: string;
  date: string;
  accounts: Partial<Record<Platform, StoredAccountEntry>>;
  chessComExtras?: ChessComExtras | null;
};

/** A legacy v1 stored snapshot, preserved verbatim. */
export type StoredSnapshotV1 = {
  playerId: string;
  playerName?: string;
  date: string;
  ratings: PlayerRating[];
  chessComExtras?: ChessComExtras | null;
};

export type StoredSnapshot = StoredSnapshotV1 | StoredSnapshotV2;

/**
 * The versioned document as it lives on disk. `version` is optional: a missing
 * version means v1. Unknown future versions are rejected by the decoder.
 */
export type SnapshotDocument = {
  version?: number;
  snapshots: StoredSnapshot[];
};
