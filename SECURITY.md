# Security Policy

## Supported versions

Only the current state of the `main` branch (the deployed website) receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report it privately via GitHub: **Security → Report a vulnerability**
(https://github.com/momo-senpai1/Practical-Engineering/security/advisories/new).

Please include:

- what is affected (page, file, dependency) and how to reproduce it,
- the impact you expect (e.g. script injection, crash through a crafted file or link),
- if possible, a suggested fix.

## What to expect

- Acknowledgement within **7 days**.
- An assessment and, for confirmed issues, a fix or mitigation plan within **30 days**.
- Credit in the release notes if you wish.

## Scope

The site is static: no server, no accounts, no data leaves the browser (see `#/privacy`).
Relevant are in particular script injection (XSS), crafted sheet files or share links
(`?sheet=`) that break or abuse the page, and vulnerable dependencies.
Out of scope: denial of service by deliberately entering huge simulation sizes in your own browser.
