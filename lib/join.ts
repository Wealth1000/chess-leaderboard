import { normalizePlayerId } from "@/lib/identity";
import { platformLabel } from "@/lib/format";
import type { Platform, Player } from "@/lib/types";

/**
 * The join form's decision layer.
 *
 * Everything here is pure except `resolveHandle`, which is injected into
 * `validateSubmission` so the rules can be tested without a network: the form
 * supplies the real resolver, the tests supply fixtures. A submission is only
 * accepted when the tag is unused, at least one handle resolves, neither
 * handle belongs to an existing member, and no check failed for an unknown
 * reason.
 */

export type HandleCheck =
  | { status: "ok"; username: string; rating: number | null }
  | { status: "missing" }
  | { status: "unverified" };

export type HandleResolver = (
  platform: Platform,
  username: string,
) => Promise<HandleCheck>;

export type Submission = {
  /** The WhatsApp group tag, exactly as typed. */
  whatsappTag: string;
  /** Display name. Empty means "use the tag". */
  name: string;
  chessCom: string;
  lichess: string;
};

export type SubmissionField = "whatsappTag" | "chessCom" | "lichess" | "form";

export type SubmissionError = {
  field: SubmissionField;
  message: string;
};

export type SubmissionChecks = {
  "chess.com": HandleCheck | null;
  lichess: HandleCheck | null;
};

export type SubmissionResult =
  | {
      ok: true;
      player: Player;
      checks: SubmissionChecks;
    }
  | { ok: false; errors: SubmissionError[] };

/**
 * Deliberately the same sentence in every duplicate case, because the answer is
 * the same: this is already somebody's entry, and edits are the maintainer's.
 * The DM is described in words, never linked — the maintainer's number is not
 * published on the site.
 */
export const DUPLICATE_MESSAGE =
  "Already on the leaderboard — DM ME (Wealth in the group) to change your details.";

export const TAG_REQUIRED_MESSAGE =
  "Enter the name people tag you with in the group chat.";

export const HANDLE_REQUIRED_MESSAGE =
  "Add at least one Chess.com or Lichess username.";

function fieldFor(platform: Platform): SubmissionField {
  return platform === "chess.com" ? "chessCom" : "lichess";
}

function sameHandle(
  player: Player,
  platform: Platform,
  username: string,
): boolean {
  const existing =
    platform === "chess.com" ? player.chessCom : player.lichess;
  return (
    typeof existing === "string" &&
    existing.toLowerCase() === username.toLowerCase()
  );
}

export async function validateSubmission(
  submission: Submission,
  players: readonly Player[],
  resolve: HandleResolver,
): Promise<SubmissionResult> {
  const errors: SubmissionError[] = [];
  const id = normalizePlayerId(submission.whatsappTag);
  const rawTag = submission.whatsappTag.trim();
  const displayName = submission.name.trim() || rawTag;

  if (!id) {
    errors.push({ field: "whatsappTag", message: TAG_REQUIRED_MESSAGE });
  } else if (players.some((player) => player.id === id)) {
    errors.push({ field: "whatsappTag", message: DUPLICATE_MESSAGE });
  }

  const typed: Record<Platform, string> = {
    "chess.com": submission.chessCom.trim(),
    lichess: submission.lichess.trim(),
  };

  if (!typed["chess.com"] && !typed.lichess) {
    errors.push({ field: "form", message: HANDLE_REQUIRED_MESSAGE });
  }

  const checks: SubmissionChecks = { "chess.com": null, lichess: null };
  const platforms: Platform[] = ["chess.com", "lichess"];

  for (const platform of platforms) {
    const username = typed[platform];
    if (!username) continue;

    const check = await resolve(platform, username);
    checks[platform] = check;

    if (check.status === "missing") {
      errors.push({
        field: fieldFor(platform),
        message: `No ${platformLabel(platform)} account with that username.`,
      });
      continue;
    }

    if (check.status === "unverified") {
      errors.push({
        field: fieldFor(platform),
        message: "Couldn't verify that account right now — try again.",
      });
      continue;
    }

    if (players.some((player) => sameHandle(player, platform, check.username))) {
      errors.push({
        field: fieldFor(platform),
        message: DUPLICATE_MESSAGE,
      });
    }
  }

  if (errors.length) return { ok: false, errors };

  const player: Player = { id, name: displayName || id };

  const chessCom = checks["chess.com"];
  if (chessCom?.status === "ok") player.chessCom = chessCom.username;

  const lichess = checks.lichess;
  if (lichess?.status === "ok") player.lichess = lichess.username;

  return { ok: true, player, checks };
}

/**
 * The real resolver. Both endpoints send `Access-Control-Allow-Origin: *`, so
 * the browser can verify handles without any backend.
 *
 * A 404 means the account does not exist. Every other failure - Chess.com's
 * Cloudflare 403, a 429, an offline phone - is "couldn't verify", never
 * "not found", because telling someone their account is gone when the network
 * merely blinked is the worse error.
 */
export const resolveHandle: HandleResolver = async (platform, username) => {
  const url =
    platform === "chess.com"
      ? `https://api.chess.com/pub/player/${encodeURIComponent(username)}`
      : `https://lichess.org/api/user/${encodeURIComponent(username)}`;

  let response: Response;

  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    return { status: "unverified" };
  }

  if (response.status === 404) return { status: "missing" };
  if (!response.ok) return { status: "unverified" };

  try {
    const body = (await response.json()) as {
      username?: unknown;
      perfs?: { rapid?: { rating?: unknown } };
    };

    if (typeof body.username !== "string" || !body.username) {
      return { status: "unverified" };
    }

    const rapid = body.perfs?.rapid?.rating;

    return {
      status: "ok",
      username: body.username,
      rating: typeof rapid === "number" ? rapid : null,
    };
  } catch {
    return { status: "unverified" };
  }
};
