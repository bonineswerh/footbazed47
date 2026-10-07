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

## Database release verification

The two additive migrations are applied as `20261007195757` and `20261007200508`; the latter covers the assigning-administrator foreign key. Hosted generated types match the committed normalized contract. Counts remained 6 accounts, 12 ratings, 261 matches and 9 friendships. The registry is empty, RLS is enabled, client roles cannot read it or call the assignment RPC, and the anonymous role cannot call recommendations. Live readers return an empty expert feed and a bounded recommendation contract.

Advisors have no remaining unindexed foreign keys. The private registry intentionally has no client RLS policies or grants. The authenticated SECURITY DEFINER advisory for recommendations is intentional: this aggregate reader needs the protected friendship graph, checks `auth.uid()`, and excludes private and blocked connections before pagination. Existing unrelated advisories remain tracked in the broader audit; this stage does not declare the whole security audit complete.

Profile/editor accessibility and responsive checks include 320, 390 and 1440 pixels; browser compatibility also covers Firefox and WebKit. Visual references were reviewed in both themes on Windows and Linux. The mobile icon-control width and Safari return-focus defects discovered during testing were fixed, rather than bypassed in tests.
