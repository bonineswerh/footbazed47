# FOOTBAZED

FOOTBAZED is a football platform for match and player ratings, personal profiles, social activity and match discussion.

## Architecture

- `index.html` contains the static application shell and accessible dialogs.
- `app.js` owns routing and shared product screens.
- `js/core.js` owns the Supabase client, shared field lists and cache helpers.
- `js/auth.js`, `js/ratings.js`, `js/matches.js` and `js/search.js` own their domains.
- `js/entities.js` owns club and player pages; `js/feed.js` owns the social feed and its interactions.
- `api/admin.js` is the only server-side administrative API and keeps the service-role key off the client.
- `supabase/migrations/` is the source of truth for database changes.

## Local checks

Node.js 20 or newer is required.

```powershell
npm run check
```

Install the Playwright browser once, then run the authenticated browser scenarios:

```powershell
npx playwright install chromium
npm run test:e2e
```

Run every automated check before a release:

```powershell
npm run check:all
```

E2E tests use a deterministic local Supabase client and never write to production. The application is static; use `npm run serve` for manual local testing instead of opening `index.html` directly.

## Deployment

Production is deployed by Vercel from the GitHub repository. Apply new Supabase migrations in filename order before enabling client code that depends on them. For breaking database contracts, use an additive migration first, deploy the compatible client, and only then apply the enforcement migration.

Never place `SUPABASE_SERVICE_ROLE_KEY` in HTML or frontend JavaScript. It belongs only in Vercel environment variables used by `api/admin.js`.
