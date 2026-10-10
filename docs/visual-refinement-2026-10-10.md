# Visual refinement — 10 October 2026

This is a bounded presentation pass: no new data requests, dependencies, schema changes or authentication behaviour.

- Feed: remove the redundant section kicker and introductory sentence; give the live result count a compact shape. Circular avatars align author identity with profiles. Reviews use readable foreground text and a quiet rule rather than another filled card. At 320 px the four scope buttons wrap into two rows instead of requiring sideways scrolling.
- Profile: combine the four metrics into one divided strip, retaining semantic rating colour, interactive friend count, focus visibility and the mobile two-column layout.
- Overview: quiet the summary and table-heading surfaces so club palettes, scores and evidence remain prominent. Active filter chips use the shared control radius.
- Match details: supporter groups use two columns below 900 px; labels wrap without ellipsis. This fixes the intermediate tablet width as well as phones, for both ratings and expectations.
- Settings: remove the generic introductory sentence while keeping instructions about local appearance and language persistence.

The public pages of [Sofascore](https://www.sofascore.com/), [FotMob](https://www.fotmob.com/) and [Flashscore](https://www.flashscore.com/) were checked for information hierarchy. Their exposed controls place fixture status, filters and favourites close to results. Our conclusion is to favour concise headings and readily available controls over additional promotional copy. No assets or brand styling were copied; this was not an inspection of their private app screens.

An unrelated timing-dependent test was found during validation: a TOTP timestamp one second in the future could become current before the final loop iteration. The API integration test now freezes Date.now through the test-scoped mock. The real server's freshness checks and assertions are unchanged.

Validation includes existing interaction, accessibility and visual coverage, plus 664 px upcoming-match scenarios in both themes and a check that audience labels are not clipped. Reviewed reference images cover feed, profile and settings; screenshot tolerances are unchanged. Full check:all and protected-branch CI are required before publication.
