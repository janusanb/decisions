# Contributing

Thanks for helping Decision Wheel stay small, local, and understandable.

## What this project is

A single-container app for two people on a trusted LAN. One Node process serves
the UI, the API, and live events. SQLite on a Docker volume is the source of
truth.

Please keep new features aligned with that shape. Avoid accounts, cloud
services, or extra containers unless the change is optional and documented.

## Development setup

You need Node.js 22+.

```bash
npm install
npm run dev
```

- UI: http://127.0.0.1:5173
- API: http://127.0.0.1:3000

Copy `.env.example` to `.env` if you want to change the database path or the
21-day recommendation window.

## Checks

Run these before opening a pull request:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Browser coverage for the two-seat flow:

```bash
npx playwright install chromium
npm run test:e2e
```

License scan for production dependencies:

```bash
npm run licenses
```

## Pull requests

- Prefer small, reviewable changes.
- Add or update tests for spin math, due dates, sealed submissions, and backups
  when those behaviors change.
- Do not commit `data/`, `*.db`, or `.env`.
- Update the README when you change how people run or back up the app.

## Architecture notes

- Server-side spin logic lives in `server/src/services/spin.ts`. The browser
  never chooses the winner.
- Due restaurants are computed from visit history, not a stored flag.
- Each submitted restaurant is one ticket. A place chosen by both people gets
  two tickets.
- Live updates are Server-Sent Events that tell clients to refresh `/api/state`.

## Code of conduct

Participation is covered by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
