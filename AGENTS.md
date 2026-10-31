# Agent context: Hermione Android app

This is the single source of agent context for this repository. [CLAUDE.md](CLAUDE.md) only points here.

## What this is

A locally built Android client (React Native / Expo / TypeScript) for self-hosted Hermes agents. It's adapted from the MIT-licensed [suryavamsi6/hermes-app](https://github.com/suryavamsi6/hermes-app), based on `7d60fa80b306c0080b98de0b3051415fb4d2445e`. App name: `Hermione POC`. The committed application ID is a placeholder; `app.config.js` overrides it from `HERMIONE_ANDROID_PACKAGE`.

- Chat goes directly to Hermes's Runs API (`/v1/runs`, `/api/sessions`). The code is in `src/hermes.ts` and `src/run-stream.ts`.
- Management (profiles, routines, skills, MCP, plugins, memory, persona) goes through the optional [hermes-bridge](https://github.com/suryavamsi6/hermes-bridge) with Hermione's mobile scope. The client is in `src/bridge.ts`, and `src/live-backend.ts` uses it.
- Connection policy is in `src/poc-policy.ts`: HTTPS `.ts.net` only, no credentials or query strings in URLs, and the bridge must be on the same host. Credentials live in SecureStore (`src/config.ts`, `src/secure.ts`).

## Read next

1. [docs/DEVELOPMENT_HANDOFF.md](docs/DEVELOPMENT_HANDOFF.md): commands, provenance, modifications, verified and unverified functionality, release blockers.
2. [POC_README.md](POC_README.md): POC scope, server connection and local build.
3. [docs/prd/native-artefacts.md](docs/prd/native-artefacts.md): Android brief for the proposed artefact increment. The canonical PRD lives in the bridge repository at `docs/prd/native-artefacts.md`.

[PLAN.md](PLAN.md), [TODO.md](TODO.md) and [README.md](README.md) are inherited from upstream. They describe the upstream maintainer's project (app ID `home.surya.hermesmobile`, EAS linkage, Funnel exposure, `keys/` signing). **Those rules don't apply here.** Where they conflict with this file, this file wins.

## Hard rules

- **This repository is public.** Never commit hostnames, tailnet names, IP addresses, ports of a real deployment, personal names, home-directory paths, device details, checksums of private builds or signing certificates. Keep those in untracked local files (`.env.local`, or notes outside the repository).
- Don't change the application ID or signing identity of an installed build without a planned migration: a different ID or signer forces an uninstall.
- No EAS, cloud builds, OTA updates, commits, pushes or PRs without explicit approval.
- Never embed or log server API keys, bridge keys, dashboard tokens or model-provider keys.
- Tailnet-only exposure (Tailscale Serve). No Funnel. Never expose the Hermes dashboard or any private management backend.
- Don't restart Hermes services, or change server profiles, credentials or Serve routes, without approval. An agent must never restart its own gateway.
- Base API calls on hermes-agent source or the bridge's routes. Don't invent endpoints. Mark proposed contracts as proposed.
- Don't re-add the upstream base64 "restore" scripts to the test lifecycle. They overwrite current source with old copies.
- Sample or demo data must stay visibly labelled and never be presented as live results.
- Voice stays disabled until on-device speech processing is verified.
- Agent skills are installed per machine and are gitignored. Don't commit them.

## Before handing back work

```bash
npm run typecheck
npm test                 # 8 bridge-integration tests skip unless HERMES_BRIDGE_SRC is set
HERMES_BRIDGE_SRC=/path/to/hermione-bridge npm test
npm run test:poc
```

Report fake-server and demo results as client-behaviour evidence only, never as live server verification.
