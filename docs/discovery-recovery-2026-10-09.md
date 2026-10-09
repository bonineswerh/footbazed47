# Overview and diary: predictable paging and recovery

## Observed problem

On the live mobile Overview, moving from clubs 1–12 to 13–24 replaced the list with a short spinner. This clamped the scroll position before the new results appeared. The heading ended at 545 px in an 844 px viewport and keyboard focus remained on the pager below the visible results. A failed read also erased the confirmed rows and counters. Both Overview and diary advanced their offset/cursor before the read succeeded.

## Change

- Keep confirmed rows, count, summaries and range while reading another page of the same selection. Expose loading through `aria-busy` and a small status message; disable paging during the read.
- Commit the offset or diary cursor only after a successful response. Retry the exact failed request. A temporary transport/database availability error preserves the confirmed result with an explicit explanation.
- Clear results for changed selections, access denial, cancellation, unknown database errors and an unavailable profile. Existing route, account and profile-version guards still discard stale responses. No grants, policies, queries or private-data scope are expanded.
- Focus and scroll to the collection heading after a user-requested page succeeds, unless the user focused another control or opened a dialog while waiting. Honor reduced motion.
- Give filtered empty results a direct reset action. Use neutral wording in someone else's history. Apply the shared semantic rating color to the complete monthly average. Render numeric validation in the selected site language rather than the browser's operating-system language.
- Manual navigation from Overview to Real Madrid exposed another issue: its upcoming preview showed 21, 18, 14 and 10 October in that order. Use the existing domain match sorter before applying the five-row preview limit: live first, then the nearest scheduled matches. The general historical match list keeps its existing contract.

## Reference review

Primary pages inspected on 2026-10-09: [Sofascore](https://www.sofascore.com/), [FotMob](https://www.fotmob.com/) and [Flashscore](https://www.flashscore.com/). Sofascore exposes match state and favourites/competitions alongside the results; FotMob keeps search, time and live controls close to the match list; Flashscore provides favourites, pinned leagues and teams beside the score view.

FOOTBAZED conclusion: keep frequent controls and recovery close to the collection, preserve the context of a confirmed selection, and make the distinction between personal history and community evidence explicit. The recovery implementation is our decision; these pages were not evidence of their internal failure-handling behavior. No artwork, wording or layout is copied.

## Verification

Eight added browser regressions exercise retained rows, exact retry offsets/cursors, backwards paging after retry, denial and null-profile clearing, stale filters, search focus, modal focus, empty-result reset, language-specific validation, foreign-profile copy and upcoming ordering before the preview limit. An added pure unit test covers transient versus access/cancellation errors. Existing responsive, privacy, accessibility, localisation and visual checks remain enabled.

Release requires the full local suite and build, all required PR checks, the exact merged main quality run, Vercel publication and production verification. Live inspection uses public pages; authenticated failure scenarios use isolated test fixtures, not mutations of production data.

## Remaining audit scope

This batch improves collection behavior; it does not close the entire product audit. Local/UTC diary-date consistency requires a coordinated server-summary contract change, rather than changing labels independently. Existing database advisor items are documented in the preceding release and are unaffected by this frontend-only change.
