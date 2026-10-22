export type Platform = "chess.com" | "lichess";

export type Player = {
  id: string;
  name: string;
  chessCom?: string;
  lichess?: string;
};

export type PlayerRating = {
  username: string;
  platform: Platform;
  rating: number | null;
};

export type Snapshot = {
  playerId: string;
  playerName: string;
  date: string;
  ratings: PlayerRating[];
};

export type SnapshotFile = {
  snapshots: Snapshot[];
};

export type RankedPlayer = Player & {
  rank: number;
  rating: number | null;
  platforms: Platform[];
  aliasText: string;
  snapshot: Snapshot | null;
};

export type LeaderboardModel = {
  ranked: RankedPlayer[];
  latestDate: string;
  leader: RankedPlayer | null;
};

export type SnapshotStatus = "loading" | "ready" | "warning";
