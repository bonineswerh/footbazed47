# FOOTBAZED

FOOTBAZED is a football platform for match and player ratings, personal profiles, social activity and match discussion.

## Architecture

- `index.html` contains the static application shell and accessible dialogs.
- `app.js` owns routing and shared product screens.
- `js/core.js` owns the Supabase client, shared field lists and cache helpers.
- `js/auth.js`, `js/ratings.js`, `js/matches.js` and `js/search.js` own their domains.
- `api/admin.js` is the only server-side administrative API and keeps the service-role key off the client.
- `supabase/migrations/` is the source of truth for database changes.

## Local checks

Node.js 20 or newer is required.

```powershell
npm run check
```

The application is static. For browser testing, serve the repository through a local HTTP server rather than opening `index.html` directly.

## Deployment

Production is deployed by Vercel from the GitHub repository. Apply new Supabase migrations in filename order before enabling client code that depends on them. For breaking database contracts, use an additive migration first, deploy the compatible client, and only then apply the enforcement migration.

Never place `SUPABASE_SERVICE_ROLE_KEY` in HTML or frontend JavaScript. It belongs only in Vercel environment variables used by `api/admin.js`.
