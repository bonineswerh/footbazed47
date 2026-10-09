# Inbox, calendar and diary interaction review

The diary is the core action on a profile: it now precedes aggregate panels on desktop and mobile. Statistics remain computed from the complete authorized history. Clicking a nonempty score bucket clears unrelated diary filters and opens that exact score across the authorized history; it never filters only the eight loaded records.

Overview keeps one comparable list and a visible order control. Added quick minimum-vote thresholds share the existing server-side filter and URL state. They mean ratings, not independent authors; preliminary results still identify small author samples. Scoreboards center both club marks and score, and retain each club's palette.

Reference observations checked on 9 October 2026:

- https://www.sofascore.com/ separates match status, favorites and competitions into direct controls. Our calendar and Overview keep frequent choices visible and detailed filters in the existing sheet.
- https://www.fotmob.com/ places match filtering beside the match list. We preserve a single search/filter path rather than introducing a second catalogue or local-only filtering.
- https://www.bookdfootball.com/ presents logging matches, a personal diary and favorite teams as connected actions. FOOTBAZED profiles now lead with the diary and connect statistics directly to its records.

These are interaction principles, not copied artwork or provider-statistical ratings.

## Notification contract

Every event has a separate 44px dismiss action. `notification_dismissals` retains only owner-scoped event IDs. Existing restrictive block/privacy policies remain in effect; a new restrictive SELECT policy removes dismissed events before cursor pagination and from the lightweight unread counter. The event and original read status remain intact. Neither a friendship request nor a rating/comment is changed by cleanup.

The last dismissal can be undone while this account remains active. An error retains the confirmed event and count. Session changes clear undo state. No raw notification DELETE/INSERT grants were added. The compatible additive database migration must be deployed before this client release.

The mutation remains invoker. A fixed-path private definer predicate reads only the caller's own dismissal metadata to break the cycle between inbox SELECT and dismissal INSERT policies. It neither reads event content nor bypasses existing inbox privacy or block checks; anonymous execution is denied.

## Calendar contract

The period browser lives inside the existing modal and focus trap. Month/year browsing does not fetch or select a day. Keyboard arrows navigate the scrollable month/year choices; Escape returns to days first. Years are rendered in a bounded 121-year window with earlier/later navigation, covering the existing 1000–9999 model range without thousands of controls.

Exact dates use a text field and explicit submit/Enter. DD.MM.YYYY is parsed by the pure calendar model; impossible dates never roll over. A successful submission preserves favorites and filters and queries one local day using the existing time-zone/DST boundaries.

## Release evidence

Focused browser checks cover inbox persistence/undo/failures, exact dates, invalid dates, keyboard navigation, neutral likes, profile-to-diary filtering, server thresholds, actual safe crest assets, button lift and reduced motion. Responsive and accessibility checks include 320px, 390px and 1440px in both themes. Cross-browser checks run in Chromium, Firefox and WebKit. Full application, clean database and secret checks are required before main is merged; production must subsequently confirm the exact merge SHA.
