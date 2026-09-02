# Security policy

Decision Wheel is designed for a **trusted local network**. The first version
has **no login, no HTTPS termination, and no public-internet hardening**.

## Supported versions

The `main` branch and the latest tagged release receive security fixes.

## Assumptions

- Anyone who can reach `http://<host-ip>:3000` can read and change the shared
  restaurant list, sessions, and visit history.
- Do not publish the container port to the internet, a hotel Wi-Fi, or any
  network you do not trust.
- If you need remote access, put the app behind your own authentication and TLS
  layer (a reverse proxy, VPN, or Tailscale). That layer is out of scope here.

## What this codebase does not send out

- No accounts, analytics, crash reporters, or third-party fonts/scripts.
- Production builds do not include source maps.
- The UI only talks to the same origin (`connect-src 'self'`).
- CORS is disabled in production so a page on another site cannot read the
  ledger from a browser on your LAN.
- Request bodies, file paths, and machine hostnames are not written to logs.
- SQLite files, `.env`, and JSON backups are gitignored and excluded from the
  Docker build context.

A browser on your home network can still open the app directly. That is
intentional for a trusted LAN. It is not a secret store.

## Reporting a vulnerability

Please use [GitHub security advisories](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/creating-a-repository-security-advisory)
on this repository. Include:

- A description of the issue and its impact
- Steps to reproduce
- Affected version or commit

Do not open a public issue for unreleased vulnerabilities.

We will acknowledge reports as soon as practical and credit reporters who want
to be named.
