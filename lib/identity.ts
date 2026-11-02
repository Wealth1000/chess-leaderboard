/**
 * Converts a WhatsApp group tag into a stable player id.
 *
 * The id is the member's tag, not a chess handle: people are tagged in the
 * group as `Wealth`, `Beeba`, `DA_KVNG`, and that is the name the leaderboard
 * keys its history on. Tags arrive with capitals, spaces, punctuation, and
 * emoji, so they are folded to `[a-z0-9_]`: lowercase, every run of other
 * characters becomes one underscore, and leading/trailing underscores are
 * trimmed. Diacritics are stripped rather than dropped, so `Kwèsí` becomes
 * `kwesi` instead of `kw_s`.
 *
 * This is the only place the rule lives on the site. `scripts/add-player.js`
 * mirrors it because the dispatch action runs plain Node, and
 * `tests/player-id-contract.test.ts` fails if the two ever disagree.
 *
 * Returns an empty string when the tag has no usable characters; callers treat
 * that as "not entered" and reject the submission.
 */
export function normalizePlayerId(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
