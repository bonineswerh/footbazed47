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

Node.js 22 or newer and pnpm 11.16.0 are required.

```powershell
pnpm run check
```

Install the Playwright browser once, then run the authenticated browser scenarios:

```powershell
pnpm exec playwright install chromium
pnpm run test:e2e
```

Run every automated check before a release:

```powershell
pnpm run check:all
```

E2E tests use a deterministic local Supabase client and never write to production. The application is static; use `pnpm run serve` for manual local testing instead of opening `index.html` directly.

## Deployment

Production is deployed by Vercel from the GitHub repository. Apply new Supabase migrations in filename order before enabling client code that depends on them. For breaking database contracts, use an additive migration first, deploy the compatible client, and only then apply the enforcement migration.

Production builds wait for the exact `main` commit's GitHub **Quality Gate** before writing the static bundle. All three jobs (application, clean database, secret scan) must finish successfully. A failed/cancelled run, missing Git identity, inaccessible GitHub, or a 25-minute deadline stops the build and leaves the previous deployment serving. Local/preview builds do not wait. This uses the public repository without new tokens; Git-connected Vercel system environment variables must remain enabled. `/release.json` publishes only the verified commit and workflow run ID.

`pnpm check:production [full-commit-sha]` checks the live RU/EN shells, release identity, main script/style, CSP and rejection of an unauthenticated admin request. It does not perform database mutations or football-provider requests. GitHub **Production availability** runs the same public check about every 30 minutes and can be launched manually; scheduled jobs can be delayed by GitHub. Failure appears in Actions. Receiving an email depends on the owner's existing GitHub notification settings; runtime error collection, database/provider freshness and external paging are not implemented by this probe.

`main` is protected by the active **FOOTBAZED main quality gate** ruleset: a pull request, an up-to-date branch and successful application/database/secret checks from GitHub Actions are required. Deletion and force push are blocked; the bypass list is empty. No second person's approval is required for this single-owner project. Push work to a `feature/**` branch, open a PR, wait for the checks, then merge. The resulting main commit runs CI again and Production waits for that exact commit.

Release recovery: inspect the failed Quality Gate job, fix and push a new commit, or rerun the failing job only after diagnosing a transient runner failure. If the Vercel build already failed, redeploy that same commit after all three jobs pass. Never remove the gate to turn a failing build green. For an incident, restore a previous known-good, verified deployment through Vercel's rollback controls; this restores code, not database contents. A staging rollback drill remains a separate task.

Never place `SUPABASE_SERVICE_ROLE_KEY` in HTML or frontend JavaScript. It belongs only in Vercel environment variables used by `api/admin.js`.
