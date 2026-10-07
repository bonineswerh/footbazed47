# Community and profile refinement — 7 October 2026

This stage fixes the tall Tottenham crest overflowing its fixed mark. Media grid tracks now shrink within the frame; image dimensions are tested with a tall asset, rather than a square placeholder. Pending matches in the home diary use the same batched club marks. The league ribbon continues on hover and respects reduced motion. Selected favorites use semantic blue; confirmed likes use semantic red.

Profile actions now separate relationship controls, the primary comparison action, and sharing. Relationship management uses a focused dialog and existing confirmation, blocking and reporting workflows. The editor keeps the underlying profile visible, uses the shared blurred overlay and returns focus when closed. Sensitive form fields are removed on close and session change. Statistics retain semantic average colors and a common accent for other numbers. “Статистика оценок” describes the actual data; “Матчи в истории” describes logged activity without implying expertise.

## Editorial experts

Admin → Experts → enter an existing username → Appoint expert. Agree with the author before assigning the label. Only the protected admin API can call the service-only RPC; the database rechecks the protected admin flag and records assignments/removal in the append-only audit. The role grants no administrative access. The registry has no client table grants. Revocation preserves ratings. No real account is automatically appointed during deployment.

The feed tabs are All / Experts / Friends / Mine. The expert filter is applied before cursor pagination; the feed keeps existing privacy and two-way blocking rules. An empty expert registry produces an honest empty state. The old popular RPC scope remains supported for compatibility.

## People you may know

Recommendations require an accepted mutual friend. Existing friends, pending requests, self, private strangers, and either direction of blocking are excluded before pagination. Private mutual profiles and blocked edges are excluded from the graph. Only the mutual count is returned, never a hidden friendship list or private identity. Suggestions are a bounded aggregate reader; username search remains available independently.

## Reference observations

- [Bookd](https://www.bookdfootball.com/) separates a match score, author review, reaction, and diary collection. FOOTBAZED keeps this separation and gives reactions stable filled states without mixing them with rating colors.
- [Letterboxd FAQ](https://letterboxd.com/about/faq/) separates logged activity, ratings and reviews. FOOTBAZED's profile headings describe actual rating history rather than a status implying authority.
- [FotMob](https://www.fotmob.com/) puts fixtures, match identity and favorites close together. FOOTBAZED retains compact club marks and its own two-sided club palette.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): graph and editorial privileges are enforced on the database boundary, independently of hidden UI controls.

Validation includes role-level pgTAP, administrator API tests, responsive crest geometry, focus return and dialog privacy, empty/real expert feeds, recommendations after a request, reaction states, reduced motion, startup budget, and full regression checks. Release verification must follow database compatibility, generated types and a production deployment.
