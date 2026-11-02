# Join Form, Hidden Players, and a Readable Chart

**Status:** Ready for implementation, pending maintainer approval
**Date:** 2026-11-02
**Repository state:** `main` at `478b8ba`
**Issue tracker:** Not published; this file is the working spec.

## Problem Statement

Four problems, one release, because they all touch the same small surface: who is on the leaderboard, and how much of them you have to look at.

**1. Adding a member is a source edit.** The player list is `data/players.json`, imported at build time, hand-maintained, and currently 63 members in join order. There is no way for a member to submit their own details. The only form on the site — the closed-site suggestion box — builds a `github.com/.../issues/new` URL, which requires a GitHub account; anyone without one is redirected to a sign-in page and the suggestion is lost.

**2. The Lichess view is mostly absence.** 56 of 63 members have no Lichess account. They already have full identity gating — null handle, `reason: "no-account"`, empty history, no focus peers — but they still render as unrated tiles and rows at the bottom. A seven-person view is sixty-three entries long.

**3. The field chart is compressed by its tail.** At the latest snapshot, Chess.com rapid has 58 rated members: min 330, median 1056, p90 1930, max 2308, with 8 members at or above 1800. The axis spans the outliers, so the dense 700–1500 band occupies roughly the bottom third of the plot.

**4. Two members point at accounts that do not exist.** `walker5379` and `enko_hn2` both return 404 from `api.chess.com` ("User not found"), have no Lichess account, and have accumulated ten days of all-null snapshots. The fetcher writes the nulls silently.

## Solution

- A **`/join/` page** with an add-only form. Handles are validated in the browser against both platform APIs, the WhatsApp group tag becomes the member's `id`, and the submission goes to **Formspree**. The maintainer reviews it and **dispatches a GitHub Action** that writes `players.json`, fetches ratings, commits, and lets the existing deploy run.
- **Cosmetic hiding** of members with no account on the active platform, with a persistent **"Show hidden"** toggle. The view model is untouched.
- **Axis clamping** on the field chart at the 90th percentile, with a **"Show full range"** toggle. No member is ever removed from the chart.
- **Data cleanup**: remove the two dead members and their snapshots, and make the fetcher say "account not found" instead of writing nulls.
- The closed-site suggestion form is repointed at a second Formspree form, so it stops dead-ending non-GitHub users.

## User Stories

1. As a member who wants to join, I want to submit my own display name and handles from the site, so that I do not have to message someone and wait for a source edit.
2. As a member without a GitHub account, I want the form to work for me, so that joining does not require creating an account somewhere else.
3. As a member, I want the form to tell me immediately if a username is wrong, so that I do not submit a typo and discover it days later.
4. As a member, I want to see exactly what name I will be listed under before I submit, so that there is no surprise after approval.

5. As a Lichess player, I want the Lichess view to show Lichess players, so that I can read the standings instead of scrolling past 56 rows that say "No Lichess account".
6. As a member, I want one visible control that reveals the hidden members, so that nobody is silently invisible.
7. As a member, I want a search for a hidden member to find them anyway, so that a deliberate lookup is never blocked by a display rule.
8. As a member, I want the board and the list to hide the same people, so that switching presentation does not change who is on the leaderboard.

9. As a member reading the field chart, I want the dense rating band to fill the plot, so that I can see how the middle of the club is moving.
10. As a member, I want the chart to admit when it is not showing the full range, so that a clipped axis never reads as a hidden player.

11. As the maintainer, I want one action that turns an approved submission into a deployed leaderboard entry, so that adding a member takes one dispatch instead of an edit, a fetch, a commit, and a deploy.
12. As the maintainer, I want the action to refuse duplicates and unresolvable handles, so that a bad submission cannot corrupt the player list or split a member's history.
13. As the maintainer, I want the daily fetch to warn when a member's account disappears, so that dead entries are noticed in a day rather than in ten.
14. As the maintainer, I want to keep edits and removals to myself, so that no stranger can rewrite another member's details.

## Implementation Decisions

### Identity: `id` is the WhatsApp tag

`Player.id` is the member's **WhatsApp group tag** — the name people use to tag them in the group. It is not an internal slug, and it is not derived from a chess handle. This is already true of the data (`wealth`, `beeba`, `wiafe`, `da_kvng`, `nas-1`) and is the reason the existing ids look like nicknames rather than usernames.

Consequences, all of them load-bearing:

- `id` is the snapshot key in the Gist, is part of `aliasText` (so search matches it), and is **already public** in the Gist — every `playerId` is one. Adding a tag to the player list introduces no new exposure.
- `id` must be **unique**. Two members claiming one tag would silently share a history.
- `id` is **immutable** after creation. A member changing their tag is a maintainer edit plus a `formerIds` remap (`beeba: ["unlikelyeffect"]` is that case).
- `Player.name` remains the displayed name and defaults to the raw tag, editable, because some members display differently from their tag (`mawulikossimensah` displays as `teamfrugal1`).

**Normalization.** Tags arrive with spaces, capitals, and emoji. `id` is normalized: lowercase; whitespace and runs of non-`[a-z0-9]` collapse to `_`; leading/trailing `_` trimmed. `Kwesi Boateng` → `kwesi_boateng`; `KWESI` → `kwesi`; `Kwesi 🔥` → `kwesi`. The raw tag is preserved as the `name` default, never as the id.

The normalization is a pure function, exported, and shown to the submitter before submission.

### `/join/` page

New route `app/join/page.tsx`, exported as `/chess-leaderboard/join/index.html` in production. Linked once from the masthead. The masthead link is the only entry point; no modal, no panel in the leaderboard.

The page is a client component. Fields, in order:

| Field | Required | Notes |
|---|---|---|
| WhatsApp tag | yes | Becomes `id`. Instructions are explicit and unmissable. |
| Display name | no | Defaults to the raw tag; editable. |
| Chess.com username | one of | Must resolve. |
| Lichess username | one of | Must resolve. |

At least one handle is required. Both are allowed.

Instruction copy for the tag field is written to be unmissable, because the tag is the identity and the honor system is deliberate:

> **Your WhatsApp tag** — the name people use to **tag you** in the group chat, not your phone number. If you are `Wealth` in the group, type `Wealth`.

Validation runs on the client, on blur and on submit:

- `GET https://api.chess.com/pub/player/{username}` and `GET https://lichess.org/api/user/{username}`. Both endpoints return `Access-Control-Allow-Origin: *`, so no proxy is needed.
- `2xx` → valid; store the **canonical** username from the response body, not what was typed.
- `404` → "No account with that username."
- Any other status (403, 429, 5xx, network) → "Couldn't verify right now — try again." A Cloudflare 403 is never reported as "not found".
- Whitespace is trimmed; empty fields are skipped.

Duplicate checks, both required:

- normalized `id` already in `players.json` → refuse.
- either canonical handle already in `players.json` → refuse.

Both use the same copy: **"Already on the leaderboard — DM ME (Wealth in the group) to change your details."** The DM is plain text, not a link. No phone number appears anywhere on the site.

**Confirmation line.** Before submit is enabled, the form shows one line of resolved truth:

> Found: `Fifi_Enko` — lichess rapid 1724. You'll be listed as **fifi_enko**.

This single line replaces most instruction-writing: it catches wrong handles, wrong case, and a surprising `id` at a glance.

**Submission.** `POST` to Formspree (`NEXT_PUBLIC_FORMSPREE_JOIN_ID`), JSON body containing the canonical handles, the normalized tag, the display name, and the raw tag for the maintainer's reference. Success → "Sent. It will appear after review." Failure → values preserved, retry offered. No CAPTCHA; a honeypot field only. The Formspree form ID is public by design and safe in the bundle.

### Applying a submission (dispatch action)

New `.github/workflows/add-player.yml`, `workflow_dispatch` only, inputs: `whatsapp_tag` (required), `name` (optional), `chess_com` (optional), `lichess` (optional). A `concurrency` group prevents overlapping runs.

Steps:

1. **Validate** in a script: normalize the tag, require at least one handle, re-resolve both handles server-side, and re-check both duplicates against `players.json`. Any failure exits non-zero with a message naming the problem. The client checks are a courtesy; this is the boundary.
2. **Append** the member to `data/players.json` in join order (new members go last; the file is not sorted by name and is not re-sorted).
3. **Fetch** with `node scripts/fetch-ratings.js` using the existing `GIST_ID` and `GIST_TOKEN` secrets. `mergeSnapshots` replaces the snapshot for the current date rather than appending, so a mid-day run refreshes today's snapshot for everyone and creates no extra history point.
4. **Commit and push to `main`** — only if every earlier step succeeded. The push triggers the existing deploy workflow, so the member is live in roughly two minutes. A failed fetch aborts before the push; nothing is half-applied.

Direct commit, not a PR: the maintainer already made the decision by dispatching, and the diff stays visible in the commit. Commit message: `Add <name> (<id>) to the player list`.

### Hiding members with no account on the active platform

**Cosmetic.** `buildRatingsView` does not change. `model.ranked`, `scorecards`, `rated`, `average`, `leader`, focus, and field series all keep their current meaning. Hiding is a selector over the model:

```
visible = showHidden
  ? ranked
  : ranked.filter(hasAccountOn(platform) || matches(query))
```

`hasAccountOn` is `handleFor(player, platform) !== null`. The union with search matches is the whole rule: **a search always reveals a hidden member**, because a deliberate lookup is intent, not clutter.

- **Where the rule applies:** the board, the list, and every count that describes them — the hero's player count, `getSeatInfo`, the board/list count label, and the dialog's "rank X of Y" all describe the visible set. The model stays whole; the numbers match the screen.
- **Toggle:** one control beside the view switch, labelled with the count it hides — `Show 56 hidden` in Lichess, `Show 1 hidden` in Chess.com. The count ignores the search query and reflects the platform rule only.
- **Persistence:** `showHidden` joins `ViewState`, defaults to `false`, and resolves tolerantly like every other field.
- **Not hidden:** members who have the account but an unplayed category. They stay, because the rule is about accounts, not ratings.
- **Focus picker:** lists every member, hiding included, flagged `No Lichess account`. The picker is a search surface.

Expected effect: Lichess 63 → 7 entries; Chess.com 63 → 62.

### Chart: clamp, don't filter

The field chart's y-axis is auto-scaled today, so a single 2308 stretches the plot away from the median. The fix is the axis, not the membership: **no member is removed from the chart**, because a hidden line is indistinguishable from a member who does not exist.

- Default y-max = the **p90** of the currently visible players' latest ratings, rounded up to the nearest 50. The clamp is applied only when there are at least 8 plotted players and the max exceeds the p90.
- When clamped, the chart states it in the caption: `3 players above 1,950 · Show full range`. The threshold is the computed value, not a hardcoded 1800 — 1800 does nothing for Chess.com classical (max 1619) and would clip five of six Lichess puzzle players (max 2019).
- **Show full range** is a boolean in `ViewState`, default `false`. Turning it on disables the clamp for that browser, and the note becomes `Full range`.
- The y-min stays auto. Focus mode is unchanged: its peers are already within ±200, so clamping would only hide the comparison.
- Clamping is computed from the same visible set as the chart's series, so the hidden-players toggle and the chart agree.

### Closed-site suggestion form

`components/closed-site.tsx` stops building a GitHub issue URL and posts to a second Formspree form (`NEXT_PUBLIC_FORMSPREE_SUGGEST_ID`), with the same honeypot and the same success copy. If the variable is unset at build time, the component falls back to the current GitHub-issue behaviour rather than failing. The component still only renders when `NEXT_PUBLIC_SITE_CLOSED=true`.

## Data Cleanup

One-off, applied with this change:

- Delete `walker5379` and `enko_hn2` from `data/players.json`.
- Delete their snapshots from the Gist. `mergeSnapshots` only replaces the current date, so history for a removed member persists unless it is removed directly. This is a surgical edit of the Gist document (a throwaway script using `GIST_TOKEN` is acceptable and is not committed), not a `RESET_SNAPSHOTS` run.
- Watch for a re-registration: `enko_hn2` and `fifi_enko` look like the same person, so the deletion may be a rename rather than a departure.

**Fetcher guard.** A 404 from either platform becomes a named result (`chess.com account not found: enko_hn2`) instead of a silent null, logged per member and summarised at the end of the run. The fetcher **does not delete members** — a public Gist is the wrong place for unattended destructive automation. The warning is the signal; deletion stays a maintainer decision.

## Testing Decisions

The seams are pure functions; there is still no DOM harness in this project.

**Seam 1 — id normalization (new).** `normalizePlayerId`: capitals, spaces, emoji, punctuation, repeated separators, empty result, and that distinct tags do not collide. Highest-value new test, because a wrong id silently splits a member's history.

**Seam 2 — submission validation (new).** A pure mapper from a raw submission to `{ ok: true, player } | { ok: false, errors }`, tested against: no handles, both handles, 404, 403, duplicate tag, duplicate handle. Network access is injected, never real.

**Seam 3 — visible-set selector (new).** Pure over a built model: hidden by rule, revealed by search, restored by the toggle, and unchanged in `model.ranked` either way. Extend `tests/ratings-view.test.ts`.

**Seam 4 — chart axis (new).** `chartAxisMax(ratings, fullRange)` against: outlier present, no outlier, fewer than 8 players, and the real Chess.com rapid distribution (expected clamp 1950).

**Seam 5 — stored view (existing).** `resolveViewState` gains `showHidden` and `fullChartRange`: defaults when absent, tolerance when malformed, and valid siblings surviving a bad field.

**Seam 6 — fetcher 404 (existing suite).** Extend `tests/fetch-format.test.ts` with a not-found response, asserting a named warning and no null written for that platform.

Existing model tests must pass unchanged: hiding is a selector, not a model change. The three identity-gating tests that assert a Chess.com-only member survives the Lichess view as `no-account` remain correct and must not be rewritten.

**Deliberately not automated:** the form's DOM, Formspree posting, and the masthead link. No jsdom or component harness is added.

**Manual verification:**

- `pnpm typecheck`, `pnpm test`, and a production build with `NEXT_PUBLIC_BASE_PATH=/chess-leaderboard`.
- Submit forward, one fixed — `/chess-leaderboard/join/` resolves and is linked from the masthead.
- Lichess view shows 7 entries with `Show 56 hidden`; toggling shows 63; the count and seat note agree with what is on screen in both states.
- Searching a hidden member's name reveals them in board and list; clearing the search hides them again.
- Reload preserves the toggle; an older stored view without it opens hidden.
- The chart clamps Chess.com rapid near 1950, states the number of members above it, and `Show full range` restores the full axis without changing any line.
- A submission with a typo'd handle is blocked before Formspree; a valid one arrives in Formspree with the canonical handle spelled as the platform reports it.
- Dispatching `add-player` with an existing tag, an existing handle, and a 404 handle each fails with a clear message and pushes nothing.
- A successful dispatch puts the member on the board within a few minutes, with a rating.
- With the closed flag enabled locally, the suggestion form posts to Formspree instead of opening GitHub.

## Out of Scope

- Editing, renaming, or removing members through the site. Updates are a DM; the maintainer applies them, including `formerIds` remaps for tag changes.
- Any authentication, account system, session, or ownership proof. The honor system is deliberate.
- Any hosted backend, serverless relay, database, or change to the static-export architecture.
- Moving the player list or snapshots off `players.json` and the Gist.
- Auto-approving submissions, or applying them without a maintainer dispatch.
- Line-count reduction in the field chart (58 lines remain 58 lines).
- A changelog, digest, or notification for new members.
- Committing, pushing, or deploying as part of implementation; those stay separate actions.

## Further Notes

- **Formspree free tier** is 50 submissions per month, which is far above club volume. Two forms are used: join and suggestion.
- **The Chess.com API 403s** for non-browser user agents; browser requests carry one, so the join form works normally, but a hardened or privacy browser may be refused. This is why "couldn't verify" is a distinct outcome from "not found".
- **The live Gist is still v1** (629 entries, latest 2026-10-31) while the code supports both formats. Nothing in this change touches the format.
- **Deleting a member is destructive and irreversible** for their history: the Gist keeps the entries unless they are removed explicitly, and a re-added member restarts from scratch.
- **`players.json` is in join order, not alphabetical.** New members append. A future sort would break the "first to join, listed first" feel and is not part of this change.
- This spec is the result of a completed design interview; every open decision above was settled explicitly. Implementation should not need to invent product behaviour.
