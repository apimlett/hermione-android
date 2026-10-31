# Hermione Android POC

A locally built Android client for self-hosted Hermes agents, reached over a private Tailscale network.

## Provenance and scope

This is a local adaptation of the MIT-licensed [suryavamsi6/hermes-app](https://github.com/suryavamsi6/hermes-app), based on commit `7d60fa80b306c0080b98de0b3051415fb4d2445e`. The upstream `LICENSE` and original README are retained.

Other candidates inspected during reconnaissance:
- [karem505/hermes-mobile-remote-gateway](https://github.com/karem505/hermes-mobile-remote-gateway): direct remote-gateway Flutter client, but less aligned with the bot-roster-first UI.
- [veficos/hermes-mobile](https://github.com/veficos/hermes-mobile): larger Flutter/FastAPI control plane, more server footprint than needed for this first POC.
- [dresar/hermes-mobile](https://github.com/dresar/hermes-mobile): not selected; mixed legacy/current implementation and unsafe credential-injection patterns identified in its server code.

This research was targeted source inspection, not a comprehensive security audit of those projects.

## What this includes

- A native React Native/Expo Android project named `Hermione POC`. Its application ID is a placeholder (`com.example.hermione.poc`); set your own with `HERMIONE_ANDROID_PACKAGE` (see below).
- Bot-first home roster, individual conversations, live status/tool-step presentation, approvals and routines screens inherited from upstream.
- Explicit offline sample/demo mode for evaluating the UX. Sample bots, messages, routines and approvals are not live agents or real results.
- Live Runs API adapter. Connection credentials are stored in Android SecureStore, never embedded in the app.
- A private-connection policy: HTTPS `.ts.net` server URLs, no URL-embedded credentials or query strings, bridge restricted to the same host.
- No upstream maintainer EAS project linkage, no OTA updates, no cloud-build requirement.
- Voice deliberately disabled until local speech processing is verified.

## Connecting to a server

1. Enable the Hermes API server on loopback (see [homelab/hermes.env.example](homelab/hermes.env.example)) and expose it **only** through Tailscale Serve (HTTPS, tailnet-only). Don't use Funnel.
2. Verify that missing and wrong bearer keys get 401, and that authenticated `/v1/capabilities` returns 200.
3. In the app, enter the API's root HTTPS URL (not `/v1`, and not a desktop webapp URL) and transfer the API key privately into the secure field.
4. Leave the Cloudflare fields empty unless Cloudflare Access is configured. Leave the bridge fields empty unless a scoped [hermes-bridge](https://github.com/suryavamsi6/hermes-bridge) is deployed on the same host.

A desktop webapp login is not an API key. Never paste credentials into chat tools, issues or the browser preview.

## Data boundary

Agent execution stays on the configured Hermes server. That doesn't make a hosted model local: prompts, attachments and tool results in a model request may still go to that provider. No model-provider keys are embedded in the client. The POC doesn't provide unattended push delivery or computer-screen takeover.

## Local development

```bash
npm ci --ignore-scripts --legacy-peer-deps
npm run typecheck
npm test
npm run test:poc
```

Tests use a pinned local esbuild, not `npx` downloads. The upstream base64 restore lifecycle has been removed: running tests must never replace current source with older encoded copies. Bridge integration tests are skipped unless `HERMES_BRIDGE_SRC` points at a bridge checkout. Fake-server and demo tests validate client behaviour only; they aren't evidence of live server integration.

### Native Android build

```bash
echo 'HERMIONE_ANDROID_PACKAGE=your.reverse.domain.hermione' > .env.local   # optional, untracked
bash scripts/build-local-android.sh
```

Requires JDK 17, Android SDK platform `android-37.0`, Build Tools 37.0.0, NDK 27.1.12297006 and CMake 3.22.1, under `$HERMIONE_TOOLCHAINS` (default `~/.local/share/hermione-toolchains`). The target is ARM64. Native files are generated under the ignored `android/` directory. Output: `android/app/build/outputs/apk/release/app-release.apk`.

**Signing:** the script signs with the generated Android debug identity. That's fine for a private POC, not a production release. Keep the same keystore and application ID to install updates over an existing build; changing either requires uninstalling first.

### Demo web preview

```bash
CI=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 EXPO_PUBLIC_DEMO=1 \
  ./node_modules/.bin/expo export --platform web --output-dir dist/web-preview
python3 -m http.server 9180 --bind 127.0.0.1 --directory dist/web-preview
```

The web preview is for sample data only, not a replacement for Android's encrypted credential storage.

## Known dependency findings

`npm audit` reports advisories in the build-tool dependency tree, including a Zod 3 advisory inherited through Expo CLI. npm's suggested forced Expo downgrade is incompatible and was not applied. Recheck `npm audit` before expanding scope or distributing.

## Next increments

- Native pairing and one real, harmless end-to-end run from the phone.
- A deliberately limited existing-profile roster before enabling profile management.
- Artefact library and share sheet ([docs/prd/native-artefacts.md](docs/prd/native-artefacts.md)).
- Routines management with explicit confirmation and server-reported state.
- Background delivery and Android lifecycle testing on a physical device.
