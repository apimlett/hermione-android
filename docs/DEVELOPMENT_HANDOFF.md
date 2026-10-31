# Development handoff: Hermione Android app

Agent rules are in [../AGENTS.md](../AGENTS.md). Scope and server setup are in [../POC_README.md](../POC_README.md). Deployment records for a specific server are kept privately, outside this repository.

## Setup and test commands

Verified with Node v24.20.0:

```bash
npm ci --ignore-scripts --legacy-peer-deps   # regenerate node_modules; never copy it between machines
npm run typecheck                            # tsc --noEmit: clean
npm test                                     # 149 tests: 141 pass, 8 skipped (bridge integration), 0 fail
HERMES_BRIDGE_SRC=/path/to/hermione-bridge npm test   # 149 tests: 149 pass
npm run test:poc                             # all pass
```

Tests use the pinned local `esbuild` and shims in `test/`. They never download through `npx` and never restore old source.

### Local configuration

Copy-free, untracked overrides go in `.env.local` (ignored by `.env.*`). Expo CLI and `scripts/build-local-android.sh` both load it.

| Variable | Purpose |
|---|---|
| `HERMIONE_ANDROID_PACKAGE` | Your Android application ID. Default: placeholder `com.example.hermione.poc`. Keep it stable once a build is installed. |

Server URLs and keys are entered in the app at runtime and stored in SecureStore. They're never build-time configuration.

### Android release build (local only)

```bash
bash scripts/build-local-android.sh
```

- What it does: loads `.env.local` if present, runs typecheck and the POC tests, then `expo prebuild --platform android --no-install`, then `./gradlew assembleRelease` for `arm64-v8a`.
- Output: `android/app/build/outputs/apk/release/app-release.apk`.
- Required toolchains, under `$HERMIONE_TOOLCHAINS` (default `~/.local/share/hermione-toolchains`): JDK 17, Android SDK platform `android-37.0`, Build Tools 37.0.0, NDK 27.1.12297006 and CMake 3.22.1.
- Build time: roughly 25 minutes on a small machine.
- `android/` is generated and gitignored. It also holds the debug signing keystore. Keep that keystore to install updates over an existing build.

### Demo web preview and browser check

```bash
CI=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 EXPO_PUBLIC_DEMO=1 \
  ./node_modules/.bin/expo export --platform web --output-dir dist/web-preview
python3 -m http.server 9180 --bind 127.0.0.1 --directory dist/web-preview
node scripts/verify-preview.mjs              # Playwright, 412×915; writes dist/verification/
```

### Source snapshot

`python3 scripts/package-source.py` writes `dist/hermione-android-poc-source.zip`, excluding `node_modules`, `android`, `ios`, `dist`, `keys`, `.env*` and key material.

### Moving to another machine

1. Clone this repository and the bridge repository separately.
2. Run `npm ci --ignore-scripts --legacy-peer-deps`, then the test commands above.
3. Install the Android toolchains and recreate `.env.local`.
4. Transfer the signing keystore only through a secure channel, if you need to update an existing install.
5. Never copy live credentials or server configuration into the repository.

## Upstream provenance

| Item | Value |
|---|---|
| Upstream | https://github.com/suryavamsi6/hermes-app (MIT; `LICENSE` retained) |
| Remote name | `upstream` |
| Base | `7d60fa80b306c0080b98de0b3051415fb4d2445e` ("Merge pull request #13", upstream app 0.11.18) |
| Hermione version | `0.1.1`, Android versionCode 2 |

Alternatives inspected and rejected are listed in [../POC_README.md](../POC_README.md).

## Modifications from upstream

- **Identity and distribution:** `app.json` (name, placeholder package, scheme, versions, OTA disabled, `allowBackup: false`, blocked storage and overlay permissions, EAS project and owner removed), `app.config.js` (local application-ID override) and `package.json` (name, version, `test:poc`, restore lifecycle removed). The upstream GitHub workflows were moved to `docs/upstream-*.yml.disabled`. Vendored agent skills are untracked.
- **Connection boundary:** `src/poc-policy.ts`, plus changes to `src/config.ts`, `src/secure.ts` (no web secret storage), `app/settings.tsx` and `app/index.tsx` (offline-demo entry, onboarding).
- **Live controls:** `src/hermes.ts`, `src/run-stream.ts`, `src/live-backend.ts`, `src/app-state.tsx`, `src/app-state-hooks.ts`, `src/chat-model.ts` and `src/ui/approval-card.tsx`. These recover pending approvals and clarifications, match controls by run, request, generation and kind, keep observing after a failed Stop, and label unknown execution without replaying it.
- **Bridge scope in UI:** `app/new-bot.tsx` creates `mobile-` profiles. `app/bot/bits.tsx` was also changed.
- **Voice disabled:** `src/ui/dictation.ts` and `app/call/[botId].tsx`.
- **Tests:** existing tests adapted, plus `test/poc-*.test.mjs` and `test/native-storage-shim.mjs`.
- **Scripts and docs:** `scripts/build-local-android.sh`, `scripts/package-source.py`, `scripts/verify-preview.mjs`, `POC_README.md`, `AGENTS.md`, `CLAUDE.md` and `docs/`.

## Verified versus unverified

### Verified

- Typecheck and the test runs above.
- A local release build: signature verified, ARM64 only, release manifest not debuggable, the bundled JavaScript matches current source, and no server secrets in the bundle.
- Against a real Hermes server (0.22.5), server side only: authenticated `/v1/capabilities` and models return 200, missing or wrong keys return 401, a harmless Runs API run completed and persisted history, and `Last-Event-ID` replay resumed correctly. Scoped bridge reads succeeded, and out-of-scope access and gateway restart were denied.
- Offline demo flow in a browser preview (Playwright): roster, chat and routines, with no external requests.
- Installed on a physical phone and exercised in offline demo mode (operator-reported).

### Unverified

- Native pairing with real credentials, and live chat from the phone, including streaming, reconnect after Android backgrounding, and phone-side approve, clarify, stop and steer.
- Mutations through the app against real data: create a `mobile-` bot, routines, skills and toolsets, MCP and plugin installs, memory and persona writes.
- Notifications, background delivery and Android lifecycle resilience.
- Multimodal sends (images or inlined text files) against a live server.
- Native artefacts: not implemented. See [prd/native-artefacts.md](prd/native-artefacts.md).

## Release blockers

1. Phone pairing and one real, harmless end-to-end live chat on a physical device, including reconnect.
2. Deliberate validation of each management mutation exposed in the UI, or hide the unvalidated ones.
3. `npm audit` findings, including a Zod advisory inherited through Expo CLI.
4. Signing: builds use the generated debug keystore. Production needs a real identity and a migration plan.
5. Permissions: the manifest still requests `RECORD_AUDIO`, `CAMERA` and `POST_NOTIFICATIONS` even though voice is disabled.

## Inherited documentation

[../PLAN.md](../PLAN.md), [../TODO.md](../TODO.md) and [bridge-api.md](bridge-api.md) are upstream documents and reference upstream paths (`../hermes-bridge`, `keys/`, the EAS project).
