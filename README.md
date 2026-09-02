# Decision Wheel

A shared, LAN-hosted wheel for two people who cannot agree where to eat.

Each person privately tickets the restaurants they want. When both lock in, those
tickets become one weighted wheel: a place both people chose gets twice the
odds of a place only one person chose. The server picks the result. Confirming
the visit writes it into history. Places nobody has confirmed in three weeks
show up as recommendations — optional, not automatic.

This repository is intended to be open source. It ships with an MIT license,
contribution docs, and CI.

## Who it is for

Two people on the same trusted home network. One computer runs Docker. Both
phones or laptops open the same URL. There is no account and no password.

**Do not expose this port to the public internet.** Anyone who can reach the
app can read and change the shared ledger. The app makes no outbound calls;
keep it that way. See [SECURITY.md](SECURITY.md).

## Features

- Two named seats stored on each device
- Private restaurant picks until both people lock in
- Weighted spin (one ticket per selection; duplicates increase the odds)
- Skips the immediately previous result when another candidate exists
- Confirm-or-skip after the spin so the three-week timer only moves when you
  actually went
- Manual “we went” entries for meals chosen off-wheel
- Live updates across both browsers
- JSON export/import plus a persistent SQLite file

## Run with Docker

```bash
npm run compose:up
```

Or:

```bash
# macOS: discover this computer's Wi-Fi address
ipconfig getifaddr en0
ADVERTISE_HOST=$(ipconfig getifaddr en0) docker compose up --build
```

**Other devices cannot use `http://127.0.0.1:3000`.** That address only means
“this machine.” On the other phone or laptop, open this computer’s Wi-Fi
address, for example `http://10.0.0.181:3000`. `npm run lan-url` prints it.

The first screen asks which seat this device belongs to.

### Other device cannot connect

1. Confirm you are opening `http://<wifi-ip>:3000`, not localhost.
2. Both devices must be on the same LAN, not a guest/isolated Wi-Fi network.
   Some routers block phone-to-computer traffic (“AP isolation” / “client
   isolation”).
3. On macOS Sequoia and later, allow **Local Network** for Docker Desktop
   under System Settings → Privacy & Security.
4. The container must publish `0.0.0.0:3000`, not `127.0.0.1:3000`.
   `docker compose port app 3000` should report `0.0.0.0:3000`.

Data lives in the `decision-data` Docker volume at `/data/decisions.db`.
Replacing the container does not erase restaurants or visits.

### Backup and restore

From the UI: **Export JSON** / **Import JSON**.

From the volume:

```bash
docker compose cp app:/data/decisions.db ./decisions-backup.db
```

Restore by stopping the app, replacing the file in the volume, and starting it
again. Prefer the JSON backup if you want a portable, inspectable copy.

### Upgrades

```bash
git pull
docker compose up --build -d
```

SQL migrations run on startup.

## Local development

Requires Node.js 22+.

```bash
cp .env.example .env
npm install
npm run dev
```

- UI with live reload: http://127.0.0.1:5173
- API: http://127.0.0.1:3000

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

End-to-end coverage of the two-seat flow:

```bash
npx playwright install chromium
npm run test:e2e
```

## How a round works

1. Add restaurants to the shared ledger.
2. Start a round.
3. Each person checks the places they are willing to include. Picks stay hidden.
4. Both lock in. The wheel appears with ticket counts and percentages.
5. Either person spins. Both screens land on the same result.
6. Confirm “we went here” to record the visit, or skip if you did not go.

A restaurant is **due** when it has no confirmed visit in the last 21 days,
including places that have never been visited. The badge is a nudge only.

## Configuration

| Variable         | Default               | Purpose                                      |
| ---------------- | --------------------- | -------------------------------------------- |
| `HOST`           | `0.0.0.0`             | Bind address                                 |
| `PORT`           | `3000`                | HTTP port                                    |
| `DATABASE_PATH`  | `./data/decisions.db` | SQLite file (`/data/decisions.db` in Docker) |
| `DUE_AFTER_DAYS` | `21`                  | Recommendation window                        |
| `LOG_LEVEL`      | `info`                | Fastify log level                            |

See [.env.example](.env.example).

## Project layout

```
client/    React UI
server/    Fastify API, SQLite, SSE
shared/    Types and constants
e2e/       Playwright two-browser flow
```

## License

[MIT](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
