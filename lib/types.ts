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

export type ViewState = {
  platform: Platform;
  category: MainCategory;
  range: RangeKey;
  focusPlayerId: string | null;
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
