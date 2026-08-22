<p align="center">
  <img src="dust-gfatherer-logo.jpg" alt="Dust Gatherer Logo" width="200">
</p>

<h1 align="center">Dust Gatherer</h1>

<p align="center">
  An installable web app for tracking resale inventory — from thrift store finds to final sale.
</p>

## Features

- **Inventory Management** — Add items with photos, purchase price, asking price, location, and notes
- **Status Tracking** — Track items through their lifecycle: In Stock → Scheduled → Posted → Sold
- **Quick Actions** — Swipe right to mark as posted, swipe left to mark as sold
- **Analytics Dashboard** — Inventory value, cost of goods sold, sales profit and margin
- **Search & Filter** — Find items quickly by name or filter by status
- **Import / Export** — Versioned ZIP backups, round-trip compatible with the original Android app
- **Dark Mode** — System, light, or dark theme options
- **Bilingual** — English and Ukrainian language support

## Tech Stack

- **Framework:** Next.js (App Router) + React, TypeScript
- **Hosting:** Netlify
- **Database:** Netlify DB (Neon Postgres) via Drizzle ORM
- **Image storage:** Netlify Blobs
- **Auth:** Single passphrase held in a Netlify environment variable

## Local Development

Requires Node 22 (see `.nvmrc`).

```bash
npm install
cp .env.example .env.local   # then edit
npm run dev                  # http://localhost:3210
```

`NETLIFY_DB_URL` is optional locally — the database client is lazy, so the app builds and
the login flow works without it. Screens that read data will report the database as
unconfigured.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DUST_GATHERER_PASSPHRASE` | yes | The single login credential. Server-only — never expose it to the client. |
| `SESSION_SECRET` | yes | Signs the session cookie. Rotating it invalidates every existing session. |
| `NETLIFY_DB_URL` | in production | Injected automatically by Netlify DB. |

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server on port 3210 |
| `npm run build` | Production build |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run db:generate` | Generate a migration from `src/lib/schema.ts` |
| `npm run db:migrate` | Apply migrations (`netlify database migrations apply`) |

## Deployment

1. Create a Netlify site connected to this repository
2. Provision Netlify DB — `NETLIFY_DB_URL` is injected automatically. Claim the database
   to a Neon account so it is not left as a trial instance.
3. Set `DUST_GATHERER_PASSPHRASE` and `SESSION_SECRET` in the site environment
4. Apply migrations: `npm run db:migrate`

The build is pinned in `netlify.toml`. Security headers are set in `src/middleware.ts`,
**not** in `netlify.toml` — Netlify applies configuration headers after middleware, so
headers declared there would mask the middleware's.

## Migrating from the Android app

The original Android app exported a versioned ZIP (`inventory.json` plus an `images/`
directory). That format is still the import format:

1. Sign in, then go to **Settings → Import**
2. Choose the `.zip` produced by the Android app
3. Review the preview, pick a conflict strategy, and import

Images are downscaled in the browser before upload, and the archive is unpacked
client-side, so large backups do not hit serverless request-size limits.

Export produces the same format, so backups remain round-trippable.

## Project History

This started life as a native Android app (Kotlin, Jetpack Compose, Room). It was
converted to a web app so it could run on any device. The conversion plan is in
[PLAN-pwa-conversion.md](PLAN-pwa-conversion.md); the Android source remains in git
history.

## License

MIT License — see [LICENSE](LICENSE) for details.
