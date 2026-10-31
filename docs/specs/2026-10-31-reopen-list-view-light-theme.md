# Reopen the Ladder: Board/List Views and a Light Palette

**Status:** Ready for implementation
**Date:** 2026-10-31
**Repository state:** `main` at `e096018`
**Issue tracker:** Not published; this file is the working spec, per request.

## Problem Statement

The club's chess leaderboard has been offline behind an under-construction gate while adjustments were made. The data pipeline is healthy and current, so the gate is now the only thing keeping members away from their ratings.

When the site returns, it still has two usability problems:

- **The chessboard is an identity, not a reading surface.** The 8×8 grid is distinctive and easy to scan for a familiar name, but it is poor for comparing ratings down a column, reading long names on a phone, and finding a specific member quickly. Members currently have no compact, literal list of the standings.
- **The dark palette is heavy for a daily glance.** The site reads as a late-night tournament hall even when someone just wants to check a rating over coffee. The cream hero, scorecards, and chart cards already establish a lighter direction; the surrounding shell has not caught up.

Members need the site back online, a board they recognize, and an alternative list that makes the same ranking readable and accessible. The visual system should feel lighter without losing the club's buff, green, and rust identity.

## Solution

Reopen the site by removing the closed-build flag from deployment while keeping the existing kill switch available.

Add a **Board / List** switch to the rankings section. The chessboard remains the default and keeps its open-seat conceit. The list renders the exact same ranking as a semantic table: rank, player, handle, rating, and the selected-range change. Search, counts, empty states, and the scorecard dialog behave identically in both views. The member's choice persists locally, and an older stored view without a layout opens on the board.

Rework the site into a warm **Tournament paper** theme: cream page and masthead, dark-green ink, rust actions, and the chessboard's deep-green squares as the main dark anchor. The hero becomes a raised cream card, the board gains a hairline frame, charts and the scorecard are tokenized to match, and the closed page is themed for consistency if it is ever switched back on.

## User Stories

1. As a club member, I want the leaderboard to be reachable again instead of showing an under-construction page, so that I can check ratings.
2. As a club member, I want the site to keep its current data and ranking rules when it reopens, so that the return does not reset or reinterpret my history.
3. As a site maintainer, I want to keep the closed-site kill switch after reopening, so that I can take the site down again during future maintenance without rewriting the gate.
4. As a site maintainer, I want the deployment to build the live site by default, so that a routine push does not accidentally republish the closure page.

5. As a club member, I want the chessboard to remain the default view, so that the site still feels like the club leaderboard I know.
6. As a club member, I want a visible Board / List switch beside the player search, so that I can change how rankings are presented without leaving the rankings section.
7. As a club member, I want the switch to announce which view is active, so that I am never unsure whether I am looking at the board or the list.
8. As a returning member, I want my last chosen view to be remembered, so that I do not have to switch to the list on every visit.
9. As a first-time or returning member with an older stored preference, I want the board to be the safe default, so that an unfamiliar stored value cannot leave the rankings section blank or broken.
10. As a club member, I want the hero, chase list, view bar, and composite chart to stay in place when I switch views, so that the platform, category, and range keep meaning the same thing everywhere.

11. As a club member, I want the list to show every ranked player in the same order as the board, so that the two views never disagree about who is first.
12. As a club member, I want each list row to show rank, name, handle, rating, and the change for the active range, so that I can read the standings without opening scorecards.
13. As a club member, I want the top three ranks to be visually distinguished, so that the podium is as legible in the list as it is on the board.
14. As a club member, I want long names to truncate gracefully with the full name available on interaction, so that a long alias does not break the table.
15. As a club member, I want players who are unrated in the active platform and category to appear under a labelled divider, so that the tail of the list is explained rather than looking like a bug.
16. As a club member, I want an em dash rather than a zero for missing ratings and changes, so that "not rated" is never confused with "rated zero".
17. As a club member, I want to click anywhere on a row to open that player's scorecard, so that the list is as actionable as the board.
18. As a keyboard user, I want a real focusable control inside each row, so that I can open a scorecard without a pointer.
19. As a club member, I want the list footer to explain how to open a scorecard, so that the interaction is discoverable.

20. As a club member, I want the existing player search to filter the list as well as the board, so that I do not need a second search box.
21. As a club member, I want my search text to survive switching between board and list, so that toggling does not silently clear my filter.
22. As a club member, I want the count label to reflect the same filtered result in both views, so that the two views report the same number.
23. As a club member, I want a clear empty state when nothing matches my search, so that I know the filter worked rather than the site failing.
24. As a screen-reader user, I want the count to be announced when filtering changes, without the whole 63-row table being read aloud, so that search feedback is useful rather than overwhelming.

25. As a phone user, I want the list to keep rank, player, rating, and change visible at narrow widths, so that I can compare players without horizontal scrolling.
26. As a phone user, I want the handle column to recede on small screens, so that the four important columns stay readable.
27. As a tablet user, I want the list rows and the board section header to reflow cleanly, so that the switch and search do not collide.
28. As a phone user, I want list rows to remain comfortable touch targets, so that I can open a scorecard reliably.

29. As a club member, I want the page to read as warm paper rather than a dark hall, so that a daily rating check feels lighter.
30. As a club member, I want the chessboard to remain the strongest dark object on the page, so that it still feels like the centerpiece.
31. As a club member, I want the masthead, view bar, section headings, and footer to share the same light surface language, so that the page does not look half-converted.
32. As a club member, I want the hero to become a raised cream card with a rust top rule, so that the champion is prominent without a large dark block.
33. As a club member, I want the board to keep its buff frame with a thin dark outline and a softer shadow, so that it reads as a physical board laid on paper.
34. As a club member, I want rust to remain the action and leader accent, so that the club identity survives the lighter theme.
35. As a club member, I want gold to remain a highlight without being used for small text on cream, so that the palette stays legible.
36. As a low-vision member, I want body, muted, accent, and button text to meet WCAG AA contrast on cream, so that I can read the page comfortably.
37. As a keyboard user, I want focus indicators that are clearly visible against cream, so that I can follow where I am.
38. As a club member with reduced-motion preferences, I want existing motion reductions to keep working, so that the theme change does not introduce new animation.

39. As a club member, I want the field chart and scorecard chart to use the same ink, grid, and series language as the light theme, so that charts do not look pasted in from the old design.
40. As a club member, I want chart tooltips to stay dark ink on cream panels, so that values remain easy to read at a glance.
41. As a club member, I want the chart series colors to remain distinguishable on cream, so that the top five lines are still identifiable.
42. As a club member, I want the scorecard dialog to keep its current structure and behavior, so that the only change is visual consistency.

43. As a site maintainer, I want the closed page to use the same paper tokens, so that a future closure still looks like the same site.
44. As a site maintainer, I want the suggestion form and GitHub issue flow to keep working, so that the kill switch remains useful.

45. As a site maintainer, I want the palette expressed as semantic tokens rather than scattered literal colors, so that future theme changes are a single pass.
46. As a site maintainer, I want the chart colors to read the same tokens at runtime, so that CSS and canvas do not drift apart.
47. As a site maintainer, I want the view-state storage change to be backward-compatible, so that existing visitors do not lose their platform, category, range, or focused player.
48. As a site maintainer, I want the list view to consume the existing ranked model rather than re-sorting or re-deriving ratings, so that board and list can never disagree.
49. As a site maintainer, I want documentation to explain how to reopen, how to re-close, and how the token system works, so that the next maintenance pass is not archaeology.
50. As a site maintainer, I want the change to ship without new runtime or testing dependencies, so that the deployment footprint stays small.

## Implementation Decisions

### Reopening

- Remove the `NEXT_PUBLIC_SITE_CLOSED` environment variable from the deployment build. The application's `SITE_CLOSED` check remains, defaulting to open when the variable is absent.
- Keep the closed-page component, its suggestion form, and its GitHub issue link as the documented kill switch. Do not delete the gate.
- Document the exact re-close procedure in the README: set the flag to `"true"` in the deploy workflow build environment and redeploy.

### Layout as view state

- Add a presentation-only layout to the shared view state. The shape is:

  ```ts
  export type Layout = "board" | "list";

  export type ViewState = {
    platform: Platform;
    category: MainCategory;
    range: RangeKey;
    focusPlayerId: string | null;
    layout: Layout;
  };

  export const DEFAULT_VIEW_STATE = {
    platform: "chess.com",
    category: "rapid",
    range: "7d",
    focusPlayerId: null,
    layout: "board",
  } as const satisfies ViewState;
  ```

- Keep the existing local-storage key. A stored payload without `layout` is valid and resolves to `"board"`. An unknown layout value resolves to `"board"`. Existing platform, category, range, and focus values are preserved.
- Extract the stored-payload normalization from the view-state hook into a pure, exported function so the persistence contract can be tested without a browser:

  ```ts
  resolveViewState(stored: unknown): ViewState
  ```

  The hook continues to read the key once after mount, write only after that read completes, and tolerate blocked or malformed storage. It gains a `setLayout` setter alongside the existing setters.
- Do not put layout in the URL. Do not add a second storage key or bump the storage version; the missing field is backward-compatible.

### One ranking, two presentations

- `layout` must not affect the ratings model. `buildRatingsView` ignores it; board and list both consume `model.ranked`, `aliasText`, and the same change data.
- The list must never re-sort, re-rank, or recompute ratings. If the list ever disagrees with the board or hero, the list is wrong by definition.
- The board section remains the owner of the shared search query, the count label, the data notices, and the layout switch. A new presentational player-table component renders the list from the already-filtered ranked array.
- The board's open-seat filler appears only in board layout. The list shows only real players.

### Switch behavior

- Place a segmented **Board / List** control in the rankings section header, alongside the player search. It uses the same pressed-button visual language as the chart's Field/Focus control.
- The group is labelled for assistive technology as the ranking view. Each option exposes its pressed state.
- The switch is visible at every breakpoint. On narrow screens the tools wrap so the switch keeps a full touch target rather than being compressed.
- Switching views preserves the search query, the scroll position within the section as far as the layout permits, and the current platform/category/range/focus state.

### List markup and content

- The list is a real table with a visually hidden caption naming the active platform, category, and range.
- Columns, in order:
  1. **Rank** — zero-padded rank, or an em dash when unrated.
  2. **Player** — display name with the active-platform handle beneath it. The handle reads as secondary context; a missing handle reads "No {platform} account".
  3. **Rating** — formatted number or an em dash.
  4. **{Range} change** — the existing change badge, with the range in the header so the delta has context.
- The handle column is hidden below 640px. Rank, player, rating, and change remain visible.
- Rows use comfortable density (roughly 48–52px), hairline separators, no zebra striping, and a sticky header with an opaque surface so it remains readable while scrolling.
- The top three ranks receive a rust rank accent. The list does not reuse the board's leader tile fill; the podium is a text-level accent here.
- When unrated players exist, insert a full-width labelled divider before the first unrated row. Do not group or reorder beyond the existing ranking (rated descending, then unrated by name).
- The table gets its own empty state when the shared search matches nobody. The message names the query and suggests a name or username, matching the board's tone.
- Row interaction: the whole row is clickable and shows a pointer/hover treatment. A real button in the player cell provides keyboard activation and stops propagation so the scorecard opens once. The accessible name includes rank, name, rating, change, and the action.
- The footer copy changes with the layout: board explains clicking a square; list explains selecting a player.

### Counts and feedback

- The existing count label logic applies unchanged to both views: loading, filtered count, rated-of-total, or total players.
- Put the live region on the count label rather than the table body, so filtering announces a number without reading all rows.
- The board's existing open-seat note and data notices remain shared section furniture below the active view.

### Theme tokens

- Introduce a semantic token layer in the global styles and migrate components off literal buff/green/rgba values. Tokens:

  | Token | Value | Use |
  | --- | --- | --- |
  | `--page` | `#F6EEDC` | Page background |
  | `--surface` | `#FCF7EA` | Raised cards, hero, table header |
  | `--ink` | `#14231D` | Primary text and dark tooltips |
  | `--ink-muted` | `#5D6C60` | Secondary text |
  | `--line` | `--ink` at 16% | Hairlines and borders |
  | `--line-strong` | `--ink` at 32% | Controls and table edges |
  | `--accent` | `#E0522C` | Decorative marks and large fills only |
  | `--accent-strong` | `#B23B1E` | Buttons, small accent text, leader accents |
  | `--gold` | `#C08A2C` | Highlights on ink surfaces only |
  | `--board-light` | `#F4ECD9` | Light squares, board frame |
  | `--board-dark` | `#123D30` | Dark squares |

- Use `color-mix` or equivalent tokenized translucency instead of reintroducing literal rgba values. Keep the board's light/dark square pair distinct from the page cream; the board must remain an object.
- Body background becomes a warm paper field with a very subtle top radial highlight. Typography, spacing, borders, and the reduced-motion rules stay unchanged.
- The eyebrow's light variant collapses onto the same muted treatment; there are no dark-only text colors left in live components.
- **Accessibility correction from the design review:** gold alone does not meet the 3:1 non-text contrast requirement for focus indicators on cream. Focus-visible rings use ink or rust. Gold remains a highlight on ink surfaces (for example, inside dark board squares) and a chart token, never small text on cream.

### Component treatment

- **Masthead:** paper background, ink wordmark, board-pattern mark using the board tokens, rust status dot, muted snapshot metadata, hairline bottom rule.
- **View bar:** ink-on-cream controls, translucent ink hover, rust fill with page text for the pressed option. Focus rings follow the contrast correction.
- **Hero:** raised surface card, heavy rust top rule, ink display type, rust rank chip with page text, hairline internal divisions, muted meta and stats labels. No large dark-green hero block.
- **Rankings section:** ink heading, muted section eyebrow, ink-bordered search field on surface, muted count. Board frame keeps its 8px thickness, gains a 1px ink hairline and a tighter warm shadow so it separates from the page.
- **Board tiles:** keep the existing light-square, dark-square, leader, and podium treatments using the board tokens. Change-badge colors keep their light/dark variants.
- **Footer:** muted ink on paper with a hairline top border.
- **Scorecard dialog:** already a cream card; migrate its literal values to tokens. Keep the ink translucent backdrop and the existing structure and behavior.
- **Closed page:** same paper background and raised card, ink copy, rust action button, surface textarea. Keep its layout, radius, suggestion form, and issue flow; retheme colors only.

### Charts

- Move chart colors out of hardcoded hex values and read them from CSS custom properties at render time, alongside the existing font reads. This covers tooltips, ticks, grid lines, borders, point borders, band fill, field and peer strokes, and series colors.
- Keep dark-ink tooltips with page-colored text; chart panels are cream, and the dark tooltip echoes the scorecard bar.
- Re-tune the series palette for cream. The existing rust, green, navy, and plum hues remain recognizable. The gold line series uses a darker chart-specific gold so it clears graphical contrast; the decorative gold token is not reused as a thin line on cream.
- No changes to chart type, layout, interaction, accessibility labels, focus behavior, or range filtering.

### Documentation and dependencies

- Update the README to cover: the site is open by default, how to re-close it, the board/list switch, the persisted layout value, and the semantic token layer.
- Add no new runtime dependencies and no new testing dependencies for this work.

## Testing Decisions

A good test here asserts externally observable behavior at a stable boundary: what a stored view resolves to, and the guarantee that presentation layout cannot change rankings. Tests should not assert CSS class names, markup structure, literal palette values, or which component owns a piece of state.

### Seam 1: stored view normalization (new, highest useful seam)

- Test `resolveViewState` as a pure function.
- Cases:
  - `null`, `undefined`, and non-object payloads resolve to the documented defaults.
  - A valid legacy payload with platform, category, range, and focus but no layout preserves those four values and resolves layout to `"board"`.
  - A valid payload with layout `"list"` preserves it.
  - An unknown layout value resolves to `"board"`.
  - Invalid platform, category, range, or focus values fall back independently without discarding the valid fields.
- This mirrors the existing tolerance for malformed input in the former-id tests: bad data is ignored with a safe default rather than throwing.

### Seam 2: layout invariance in the shared view model (existing seam)

- Extend the existing ratings-view tests with a layout-invariance case: build the same snapshots and the same view twice, once with `layout: "board"` and once with `layout: "list"`, and assert that ranked entries, rated count, leader, average, scorecards, field chart, focus model, and notices are identical.
- Assert the default view is `"board"`.
- This test protects the core product promise: the switch changes presentation only.
- Existing ranking, range, focus, scorecard, identity, and search tests must continue to pass unchanged after `ViewState` grows a field.

### Deliberately not automated

- No DOM or component test harness is added. The list is presentational over the already-tested ranked model, and the project currently has no browser/component test setup. Adding jsdom and a component library would introduce a new dependency and a much lower seam for markup assertions.
- If automated interaction coverage is wanted later, the right seam is rendering the rankings section with a prepared model and asserting user-visible outcomes: default board, toggle to list, shared search, empty state, and persisted layout. That is a separate, explicit follow-up, not part of this change.
- Palette contrast is verified manually against the chosen token pairs rather than by parsing CSS in a test.

### Manual verification checklist

- `pnpm typecheck`, `pnpm test`, and a production build with `NEXT_PUBLIC_BASE_PATH=/chess-leaderboard`.
- Default visit renders the board and announces Board as pressed.
- Toggling to List renders 63 rows in the same order as the board; toggling back restores the board.
- Reload preserves the list choice; clearing the stored key opens on the board; an old stored payload without `layout` opens on the board.
- Search filters both views, the query survives toggling, and the empty state appears in both.
- The unrated divider appears before the unrated block when the active view has unrated players.
- Clicking a row opens the matching scorecard; keyboard activation from the player button opens it once; Escape closes it.
- At 1440px, 768px, and 390px: no horizontal overflow, the switch and search reflow cleanly, the handle column hides on small screens, and rows remain comfortable touch targets.
- Contrast spot-check: ink/page, muted/page, accent-strong/page, page/accent-strong, and focus ring against cream. Chart ticks, grid, tooltips, and the gold series line remain legible.
- Chart tooltips, point borders, and axes use the light-theme tokens; no dark-only colors remain.
- With the closed flag enabled in a local build, the closed page is paper-themed and the suggestion form still opens a prefilled GitHub issue.

### Prior art

- `tests/ratings-view.test.ts`: pure Vitest, inline player/snapshot fixtures, behavior-focused assertions over the view model.
- `tests/former-ids.test.ts`: malformed-input tolerance and independence from implementation details; the same style applies to stored-view normalization.

## Out of Scope

- Sortable list columns, alphabetical ordering, or any ordering that disagrees with the canonical rank.
- Per-category rating columns, sparklines, or trend charts inside list rows.
- Sharing the active layout through the URL or server state.
- A light/dark theme switch or automatic system-theme following.
- Font changes, layout redesign of the hero or composite chart, or changes to chart behavior.
- Changes to the snapshot schema, fetcher, gist, player list, ranking rules, focus peers, or scorecard matrix.
- Removing the closed-site component or its suggestion form.
- Committing, pushing, or deploying the change; those remain separate actions.
- Automated browser/component tests; see the follow-up note in Testing Decisions.

## Further Notes

- The committed player list has 63 members, so the board shows 63 players plus one open seat. The list will have 63 data rows.
- The gist was current through 2026-10-31 when this spec was written (629 snapshots), so reopening does not require a data reset.
- Production is served from a repository subpath. Local development uses an empty base path; previewing a production build requires building with `NEXT_PUBLIC_BASE_PATH=/chess-leaderboard` and serving the output under that path.
- The kill switch is the `SITE_CLOSED` check in the app combined with the deploy workflow's `NEXT_PUBLIC_SITE_CLOSED` build variable. Re-closing means setting that variable to `"true"` and redeploying; reopening means removing it. The app remains usable when the snapshot fetch fails, and that behavior must not change.
- The design review agreed on gold focus outlines. This spec records one deliberate correction: gold is retained as a highlight but not as the sole focus indicator on cream, because it fails non-text contrast. Ink or rust focus rings replace it.
- This spec was written from the completed design interview. The only open implementation detail is whether the team wants a DOM-level test harness later; the proposed seams for this change are the stored-view resolver and the existing ratings model, and they should be confirmed before implementation begins.
