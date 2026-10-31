import type {
  Category,
  ChessComExtras,
  PlayerRating,
  Platform,
  Snapshot,
  SnapshotDocument,
  StoredAccountEntry,
  StoredSnapshot,
  StoredSnapshotV2
} from "@/lib/types";

/**
 * The storage boundary: everything that knows the gist on-disk shape lives
 * here, and the rest of the app only ever sees the domain `Snapshot[]`.
 *
 * Two shapes coexist in the document during the transition:
 *   - v1 entries carry a top-level `ratings` array;
 *   - v2 entries carry an `accounts` map.
 * Detection is **per entry**, so a single document may legally mix both.
 */

const PLATFORMS: readonly Platform[] = ["chess.com", "lichess"];

const CATEGORIES: readonly Category[] = [
  "rapid",
  "classical",
  "blitz",
  "bullet",
  "puzzle"
];

/** Rejected as `[]`: an explicit version we do not understand. */
const SUPPORTED_VERSIONS = new Set([2]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORIES.includes(value as Category);
}

function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && PLATFORMS.includes(value as Platform);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function readExtras(value: unknown): ChessComExtras | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isPlainObject(value)) return undefined;

  return {
    tacticsHigh: isFiniteNumber(value.tacticsHigh) ? value.tacticsHigh : null,
    puzzleRushBest: isFiniteNumber(value.puzzleRushBest)
      ? value.puzzleRushBest
      : null
  };
}

/**
 * Decode one v2 account entry into domain ratings: one entry per numeric
 * category, one per `unplayed` category (value `null`). A category in neither
 * map emits nothing. Returns `null` when the account is malformed.
 */
function decodeAccount(
  platform: Platform,
  input: unknown
): PlayerRating[] | null {
  if (!isPlainObject(input)) return null;

  const { username, ratings, unplayed, gamesPlayed } = input;
  if (!isNonEmptyString(username)) return null;

  const rated: PlayerRating[] = [];
  const seen = new Set<Category>();

  if (ratings !== undefined) {
    if (!isPlainObject(ratings)) return null;
    for (const category of CATEGORIES) {
      const value = ratings[category];
      if (value === undefined) continue;
      // A present-but-non-numeric value is malformed, not "unplayed".
      if (!isFiniteNumber(value)) return null;

      const entry: PlayerRating = {
        username,
        platform,
        category,
        rating: value
      };

      const count = isPlainObject(gamesPlayed)
        ? gamesPlayed[category]
        : undefined;
      if (isFiniteNumber(count)) entry.gamesPlayed = count;

      rated.push(entry);
      seen.add(category);
    }
  }

  const unplayedEntries: PlayerRating[] = [];
  if (unplayed !== undefined) {
    if (!Array.isArray(unplayed)) return null;
    for (const category of unplayed) {
      if (!isCategory(category) || seen.has(category)) continue;
      unplayedEntries.push({
        username,
        platform,
        category,
        rating: null
      });
      seen.add(category);
    }
  }

  return [...rated, ...unplayedEntries];
}

function decodeV2Entry(
  entry: Record<string, unknown>
): Snapshot | null {
  const { playerId, date, accounts } = entry;
  if (!isNonEmptyString(playerId)) return null;
  if (typeof date !== "string") return null;
  if (!isPlainObject(accounts)) return null;

  const ratings: PlayerRating[] = [];
  for (const platform of PLATFORMS) {
    const account = accounts[platform];
    if (account === undefined) continue;

    const decoded = decodeAccount(platform, account);
    // Any malformed account invalidates its snapshot entry.
    if (decoded === null) return null;
    ratings.push(...decoded);
  }

  const snapshot: Snapshot = {
    playerId,
    // v2 drops playerName; display names come from data/players.json.
    playerName: "",
    date,
    ratings
  };

  const extras = readExtras(entry.chessComExtras);
  if (extras !== undefined) snapshot.chessComExtras = extras;

  return snapshot;
}

function decodeV1Rating(input: unknown): PlayerRating | null {
  if (!isPlainObject(input)) return null;

  const { username, platform, category } = input;
  if (typeof username !== "string") return null;
  if (!isPlatform(platform)) return null;
  if (!isCategory(category)) return null;

  const value = input.rating;
  // v1 keeps explicit `null` for "not played"; anything else non-numeric is bad.
  if (value !== null && !isFiniteNumber(value)) return null;

  const rating: PlayerRating = {
    username,
    platform,
    category,
    rating: value === null ? null : value
  };

  const count = input.gamesPlayed;
  if (isFiniteNumber(count)) rating.gamesPlayed = count;

  return rating;
}

function decodeV1Entry(entry: Record<string, unknown>): Snapshot | null {
  const { playerId, date, ratings } = entry;
  if (!isNonEmptyString(playerId)) return null;
  if (typeof date !== "string") return null;
  if (!Array.isArray(ratings)) return null;

  const decoded: PlayerRating[] = [];
  for (const raw of ratings) {
    const rating = decodeV1Rating(raw);
    if (rating === null) return null;
    decoded.push(rating);
  }

  const snapshot: Snapshot = {
    playerId,
    playerName: typeof entry.playerName === "string" ? entry.playerName : "",
    date,
    ratings: decoded
  };

  const extras = readExtras(entry.chessComExtras);
  if (extras !== undefined) snapshot.chessComExtras = extras;

  return snapshot;
}

function decodeEntry(input: unknown): Snapshot | null {
  if (!isPlainObject(input)) return null;

  // Per-entry detection: `accounts` object means v2, `ratings` array means v1.
  if (isPlainObject(input.accounts)) return decodeV2Entry(input);
  if (Array.isArray(input.ratings)) return decodeV1Entry(input);
  return null;
}

/**
 * Decode a stored document into the domain model. Accepts a v2 document, a v1
 * document (missing `version` means v1), or a mix of entries. Any malformed
 * input, or an unknown future version, yields `[]` — this never throws.
 */
export function decodeSnapshotDocument(input: unknown): Snapshot[] {
  if (!isPlainObject(input)) return [];

  const version = input.version;
  if (version !== undefined) {
    if (typeof version !== "number" || !SUPPORTED_VERSIONS.has(version)) {
      return [];
    }
  }

  const rawSnapshots = input.snapshots;
  if (!Array.isArray(rawSnapshots)) return [];

  const snapshots: Snapshot[] = [];
  for (const raw of rawSnapshots) {
    const snapshot = decodeEntry(raw);
    if (snapshot !== null) snapshots.push(snapshot);
  }

  return snapshots;
}

function encodeAccount(
  entries: PlayerRating[]
): StoredAccountEntry | null {
  if (entries.length === 0) return null;

  const { username } = entries[0];
  const ratings: StoredAccountEntry["ratings"] = {};
  const unplayed: Category[] = [];
  const gamesPlayed: NonNullable<StoredAccountEntry["gamesPlayed"]> = {};

  for (const entry of entries) {
    if (entry.rating === null) {
      unplayed.push(entry.category);
      continue;
    }
    ratings[entry.category] = entry.rating;
    if (isFiniteNumber(entry.gamesPlayed)) {
      gamesPlayed[entry.category] = entry.gamesPlayed;
    }
  }

  const account: StoredAccountEntry = { username };
  if (Object.keys(ratings).length > 0) account.ratings = ratings;
  if (unplayed.length > 0) account.unplayed = unplayed;
  if (Object.keys(gamesPlayed).length > 0) account.gamesPlayed = gamesPlayed;

  return account;
}

/**
 * Encode the domain model back to a minified v2 document. Pure, and the
 * inverse of `decodeSnapshotDocument` for ratings, unplayed-ness,
 * `gamesPlayed`, extras, ids, and dates (`playerName` is intentionally dropped).
 */
export function encodeSnapshotDocument(snapshots: Snapshot[]): string {
  const stored: StoredSnapshotV2[] = [];

  for (const snapshot of snapshots) {
    const byAccount = new Map<string, PlayerRating[]>();

    for (const rating of snapshot.ratings) {
      const key = `${rating.platform}\u0000${rating.username}`;
      const bucket = byAccount.get(key);
      if (bucket) bucket.push(rating);
      else byAccount.set(key, [rating]);
    }

    const accounts: StoredSnapshotV2["accounts"] = {};
    for (const entries of byAccount.values()) {
      const account = encodeAccount(entries);
      if (account === null) continue;
      const platform = entries[0].platform;
      accounts[platform] = account;
    }

    const storedSnapshot: StoredSnapshotV2 = {
      playerId: snapshot.playerId,
      date: snapshot.date,
      accounts
    };
    if (snapshot.chessComExtras != null) {
      storedSnapshot.chessComExtras = snapshot.chessComExtras;
    }

    stored.push(storedSnapshot);
  }

  const document: SnapshotDocument = { version: 2, snapshots: stored };
  return JSON.stringify(document);
}

/** Narrow an arbitrary stored entry to the v2 shape by its `accounts` object. */
export function isStoredSnapshotV2(
  entry: StoredSnapshot
): entry is StoredSnapshotV2 {
  return isPlainObject((entry as StoredSnapshotV2).accounts);
}
