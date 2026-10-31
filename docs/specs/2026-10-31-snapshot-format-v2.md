# Snapshot Format v2: Compact Storage and Game-Count Groundwork

**Status:** Ready for implementation
**Date:** 2026-10-31
**Repository state:** `main` at `fb6375d` (site is live; deploy gate removed)
**Issue tracker:** Not published; this file is the working spec.

## Problem Statement

Two problems, one change, because fixing them separately means migrating the snapshot format twice.

**1. The snapshot file grows on every visit.** The site downloads the entire history from the gist on every page load, with no caching, and GitHub's raw gist endpoint serves it uncompressed. The file is currently ~633 KB after 10 days. Each snapshot repeats `username`, `platform`, `category`, and a `playerName` field that nothing reads, and the fetcher pretty-prints the whole file at roughly 43% overhead. At today's rate a visitor downloads over 1 MB per page load within a month, ~5 MB within three months, and ~20 MB within a year — on a site whose entire content is a table of numbers.

**2. Players want progress measured over games, not days.** Lichess reports rating change over the last 12 games. The club has asked for the same. The full version of that feature requires per-game data, and on Chess.com that means downloading megabytes of unused PGN from an endpoint with no documented rate limit — a reliability risk for the one thing the site must do every morning. There is a cheaper path: both platforms already publish cumulative games-played counts in responses the fetcher already receives, and those numbers are discarded today. Storing them costs almost nothing and makes a games-based comparison possible later from history we would already have.

Doing (2) on top of (1) as-is would accelerate the growth that is already the site's most pressing problem. So the format gets restructured first, and the game counts ride along inside the smaller shape.

## Solution

Introduce **snapshot format v2**: a compact, minified, restructured snapshot document that is ~62% smaller per day than what is stored today, carries a format version, and adds per-account cumulative **games played** per category. The file becomes meaningful rather than decorative in size — smaller today than the current format even with the new fields.

The site reads both formats. The fetcher writes v2. Once v2 has been live for a few days, the v1 reader is deleted.

Alongside it: the browser stops re-downloading the file on every page load.

The games-played counts are **storage only**. No UI changes, no new range, no visible behaviour change. The 12-games comparison feature is a deliberately separate, later spec; this one exists so that when it is built, the history it needs already exists.

## User Stories

1. As a club member, I want the leaderboard to load quickly on a phone, so that checking a rating does not cost several megabytes of mobile data.
2. As a club member, I want page loads to cost roughly the same next month as they do today, so that the site does not degrade as history accumulates.
3. As a club member, I want the site to keep working unchanged while the storage format changes underneath, so that I never see a broken leaderboard because of a migration.
4. As a club member on a slow connection, I want a cached copy of the snapshot used when I reload within a few minutes, so that a quick second look is nearly free.
5. As a club member, I want the daily update to remain reliable, so that the numbers I trust are still there every morning.

6. As a site maintainer, I want one coordinated format change rather than two, so that I do not migrate the same data twice.
7. As a site maintainer, I want the stored snapshot document to omit structurally redundant fields, so that the file size reflects the information it carries.
8. As a site maintainer, I want the file written minified, so that indentation does not cost 40% of every visitor's bandwidth.
9. As a site maintainer, I want a format version marker, so that a future shape change is recognisable rather than inferred from the data.
10. As a site maintainer, I want the reader to accept the previous format for a transition period, so that the site works whether the fetcher has run or not.
11. As a site maintainer, I want a single place that decodes a stored document into the domain model, so that a future format is one function and one test file, not a scattered migration.
12. As a site maintainer, I want the format boundary covered by tests, so that a malformed or half-migrated file cannot take the site down.

13. As a site maintainer, I want cumulative games-played counts captured per account and category from the very next fetch, so that the data a games-based feature needs starts accruing immediately.
14. As a site maintainer, I want those counts optional in the type, so that snapshots written before they existed remain valid.
15. As a site maintainer, I want the previous snapshots retained through the change, so that the ten days of history already collected are not thrown away.
16. As a site maintainer, I want the unwanted-byte contributions measured rather than assumed, so that future additions are judged against evidence.
17. As a club member, I want no visible change from this work, so that the site I just got back keeps behaving exactly as it does now.

18. As a site maintainer, I want the puzzle category excluded from games-played counts, so that the data does not imply puzzle "games" are chess games.
19. As a site maintainer, I want Chess.com and Lichess counts sourced from the endpoints already called, so that no new upstream dependency or rate-limit exposure is introduced.
20. As a site maintainer, I want a missing count represented as absent rather than zero, so that "unknown" and "has played none" stay distinguishable.
21. As a site maintainer, I want the `playerName` field dropped from stored snapshots, so that the file stops carrying a field nothing reads.
22. As a site maintainer, I want display names to keep coming from the committed player list, so that removing the field changes nothing user-visible.

23. As a site maintainer, I want the unplayed-versus-missing distinction preserved through the format change, so that the scorecard's "Not played" and "No data" labels remain correct.
24. As a site maintainer, I want the per-rating account handle to survive the restructure, so that the identity gate that stops ratings being borrowed across accounts keeps working.
25. As a site maintainer, I want the fetcher's existing read-modify-write of the gist to handle either format, so that a run immediately after the deploy does not clobber history.
26. As a site maintainer, I want the rename remapping to keep working against the new shape, so that `formerIds` continues to move history when a member id changes.
27. As a site maintainer, I want the compact format to remain human-inspectable, so that debugging the gist does not require a decoder.

28. As a site maintainer, I want the format described in the README, so that the next person does not reverse-engineer it.
29. As a site maintainer, I want a documented rollback, so that a bad deploy can be reverted without data loss.
30. As a site maintainer, I want the change to land without new runtime dependencies, so that the deployment footprint stays small.

31. As a future implementer of the 12-games feature, I want the games counts already in history, so that the feature does not have to wait for weeks of new data.
32. As a future implementer, I want the counts stored per account and category, so that a games-based delta can be derived for the exact pool the viewer has selected.

## Implementation Decisions

### The format

Snapshot format v2 is a versioned document. The version lives in the document, not in the filename, so the gist file name stays `snapshots.json` and the reader can branch on content.

Decision-rich shape (from the measurement prototype; this is the contract):

```jsonc
{
  "version": 2,
  "snapshots": [
    {
      "playerId": "wiafe",
      "date": "2026-10-31",
      "accounts": {
        "chess.com": {
          "username": "mr_wiafe",
          "ratings":  { "rapid": 2114, "classical": 529, "blitz": 1851, "bullet": 1081 },
          "unplayed": ["puzzle"],
          "gamesPlayed": { "rapid": 3712, "classical": 137, "blitz": 2988, "bullet": 1067 }
        }
      },
      "chessComExtras": { "tacticsHigh": 1554, "puzzleRushBest": null }
    }
  ]
}
```

Rules:

- The document is the object above; the file contains no surrounding whitespace and no indentation. Pretty-printing is removed, not relocated.
- `ratings` holds only categories with a numeric rating. A category the account has but that is unrated appears in `unplayed` instead of as an explicit `null`.
- `unplayed` is what preserves the existing three-way distinction: a category present in `unplayed` means the account exists and the value is genuinely unavailable ("Not played" / "Not published"); a category in neither map means no data for that account ("—"). This distinction is load-bearing and must survive the decode.
- `gamesPlayed` maps category to the cumulative number of games played in that category, sourced from the count the platform already publishes. It is omitted entirely when no count is available, and individual categories are omitted rather than defaulted. Puzzle is never included, on either platform.
- The `playerName` field is removed. Display names come from the committed player list, which already overrides the snapshot for every surface.
- `chessComExtras` is omitted for accounts that have no Chess.com presence, as today.
- `accounts` is omitted or empty when a member has no accounts, rather than emitting an empty ratings array.
- Key names stay readable. A further byte saving from terse abbreviations was measured and rejected: it buys about 8% at the cost of the gist no longer being inspectable by eye, which is the debugging surface of last resort.

### Decode boundary

- A single module owns turning a fetched document into `Snapshot[]`, and owns the version branch. The browser's gist client calls it; nothing else parses the stored shape.
- The decoder accepts:
  - a v2 document — read directly;
  - a v1 document (today's `{ snapshots: [...] }` with no `version`) — upgraded in memory into the domain shape, including reconstructing `unplayed` from explicit `null` ratings and leaving `gamesPlayed` absent;
  - anything else — treated as no snapshots, with the existing warning behaviour, never a thrown error.
- The decoder is a pure function and the primary test seam for this change.
- The domain types (`Snapshot`, `PlayerRating`) keep their current shape. `Snapshot.ratings` remains the array the rest of the app consumes; the compact accounts map is a storage representation, not a domain one. This keeps every existing consumer and test untouched.
- `Snapshot` gains an optional `gamesPlayed` on the rating entry (or equivalent), optional throughout so v1-derived and pre-change snapshots remain valid.

### Retention

- No pruning in this change. The measurement shows the restructured format roughly halves the growth curve; retention policy is a separate decision that needs its own discussion about how far back the 90-day and All ranges must reach.
- The file remains the single source of history. No second file, no companion compact file.

### Fetching

- The browser stops using `cache: "no-store"`. Since the gist sends `max-age=300` and updates daily, the client uses a short revalidation window rather than bypassing the cache on every load. The exact lever is the implementer's call, but the behaviour is: a reload within a few minutes should not re-download the file, and a load after a daily update must see fresh data.
- No compression is added. The endpoint does not gzip, and implementing client-side decompression would add a dependency for a problem the format change already solves far more cheaply.

### Fetcher changes

- The fetcher writes v2: minified (no indentation), restructured, with `version: 2`, and with `gamesPlayed` populated from the counts already present in the stats responses.
- Chess.com cumulative count per category is derived from the record's win/loss/draw totals for that category. Lichess cumulative count per category is the existing `games` field, which the fetcher already reads to decide whether a rating is real.
- Puzzle is excluded everywhere.
- The fetcher's read of the existing gist must accept v1 and must not duplicate or drop the day being written. Re-running on the same day still replaces that day, as today.
- `formerIds` remapping continues to work; it operates on stored snapshots, so it must run against whichever shape is loaded.
- The daily workflow and secrets are unchanged.

### Testing and documentation

- The decode boundary and the encoder/decoder round trip are the test seams; see Testing Decisions.
- The README documents the v2 shape, the reason for it, the version field, the decode boundary, and the rollback: a revert of the deploy is safe because the reader tolerates v1, so history is never at risk from shipping or reverting this change.

## Testing Decisions

Good tests here assert the storage contract as observable behaviour: what a given stored document decodes to, and that a value survives a write-then-read round trip. They must not assert key ordering, whitespace, or internal helper structure.

### Seam 1: the decode boundary (new, and the highest useful point)

- Test the single decode function, pure, with no network and no storage.
- Cases:
  - a v2 document decodes to the same domain snapshots the data represents, including `gamesPlayed`;
  - a v1 document decodes correctly, with `unplayed` reconstructed from explicit `null`s and `gamesPlayed` absent;
  - a document with no `version` is treated as v1;
  - an unknown future `version` is rejected as no snapshots rather than misread;
  - malformed input — null, a string, an array, a missing `snapshots` key, an account entry that is not an object — yields no snapshots and never throws;
  - a category present in `unplayed` decodes to an unavailable rating, distinct from a category absent from both maps.
- This mirrors the malformed-input tolerance already established by the former-id tests and the stored-view resolver.

### Seam 2: encode/decode round trip

- Round-trip test: build the domain snapshots, encode them, decode them, assert deep equality of the information that matters (ratings, unplayed, gamesPlayed, extras, ids, dates). This is the contract that lets the fetcher and the site evolve separately.
- Include a case with an absent `gamesPlayed`, and one where only some categories have counts.
- If practical without new dependencies, assert the flattened output is minified (no newline indentation) and that the encoded bytes for a fixed fixture are at or below a threshold, to catch someone reintroducing pretty-printing. If that proves brittle, drop the size assertion and keep the round trip.

### Seam 3: existing behaviour stays green

- The existing ratings-view, former-id, and view-state suites must pass unchanged. Any test that starts failing indicates the decode changed domain semantics, which is exactly the regression this change is most likely to cause.

### Prior art

- Pure Vitest tests with inline fixtures, node environment, no DOM — the style of the existing ratings-view and former-id tests.
- Malformed-input tolerance mirrors `resolveViewState` and `buildFormerIdMap`.

### Manual verification

- Record the gist file size before and after the first v2 run and state the actual reduction alongside the predicted ~62%.
- Load the deployed site on a throttled connection and confirm the snapshot request is no longer repeated on an immediate reload.
- Confirm the board, list, hero, charts, and a scorecard render identically to before the change.
- Confirm `pnpm typecheck`, `pnpm test`, and a base-path production build pass.
- Confirm a v1 gist still renders the site correctly, by pointing the client at a v1 fixture.

## Out of Scope

- The 12-games comparison feature itself: the range option, the delta, the labelling, and any UI.
- Per-game history, game-by-game fetching, and any call to a games endpoint on either platform.
- Pruning, thinning, or capping retained history; and any decision about how far back each range must reach.
- Migrating or rewriting the existing stored history into v2 beyond what a normal daily run does. The old snapshots are upgraded at read time, not converted in place.
- Enabling gzip or adding compression dependencies.
- Removing the v1 reader. That happens in a follow-up once v2 has been live for a few days.
- Any change to what the site displays.

## Further Notes

- **Measured numbers** (10 days of real history, 63 players, from the committed gist): today's stored format is 52.6 KB/day; minifying alone brings it to 36.2 KB/day; the restructured format with game counts is 19.8 KB/day — 62% smaller than what is stored today (2.7×), and 2.1× smaller than the same change made to the current shape with its indentation intact (41.3 KB/day minified). At 19.8 KB/day a page load reaches 1 MB around day 49 and 5 MB around day 247, versus roughly day 19 and day 93 today.
- **Why not the games endpoint:** Chess.com monthly archives carry roughly 0.6 MB of unused PGN per 0.9 MB, expose no per-game rating delta, and have no documented rate limit, across 62 Chess.com accounts and four categories. That is a reliability tax on the daily update for a feature that can be derived from data already being fetched.
- **Why the counts are nearly free:** Chess.com publishes per-category win/loss/draw records and Lichess publishes per-category `games` counts in the same responses the fetcher already parses. The only reason a games-based delta cannot be shown today is that nobody recorded the counts, not that they are unavailable.
- **Accuracy caveat to carry into the follow-up spec:** a delta derived from cumulative counts across daily snapshots is approximate — it resolves to whichever stored day crosses the threshold, so it can land a couple of games either side of exactly twelve. Lichess would be exact only via its games endpoint, which this spec deliberately does not use. The follow-up should decide how to label that honestly.
- The live site was opened by a previous change; this spec must keep it live. If the fetcher fails after the format change, the site falls back to displaying the newest readable document, and a v1 document remains fully readable.
