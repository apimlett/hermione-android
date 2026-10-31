# Android brief: Native artefacts

| | |
|---|---|
| **Status** | **Proposed. Not implemented.** |
| Canonical PRD | `docs/prd/native-artefacts.md` in the Hermione bridge repository. The contract, storage, security and acceptance-test IDs are defined there; this brief covers only the Android slice. |
| Date | 2026-10-31 |

## Scope for the app

The app owns discovery, download, cache, rendering and Android Save/Share. It never stores artefacts outside app-private storage unless the user explicitly saves or shares one.

## Starting point (current code)

- Bridge client: `src/bridge.ts` (`BridgeClient.req`, JSON only, bearer header). `bridgeTarget()` in `src/config.ts` resolves `<baseUrl>/bridge`.
- History: `src/hermes.ts` (`inline_images=false`) → `src/chat-model.ts` (`imageCount` only) → `src/history-turns.ts`.
- Live runs and reconnect: `src/run-stream.ts`.
- Conversation UI: `app/bot/screen.tsx`, `src/ui/message-menu.tsx`. Text Share already uses React Native `Share`.
- Demo backend: `src/demo-backend.ts`. Policy: `src/poc-policy.ts`.

## Proposed changes

1. **Capability:** extend `BridgeStatus` with optional `features.artefacts`. Store it per connection. All artefact UI is gated on it (canonical §9).
2. **Client module (new, for example `src/artefacts.ts`):** list, metadata and content download. Content goes to `FileSystem.cacheDirectory/artefacts/<id>` using `expo-file-system` download with the `Authorization` header. Verify `sha256` against metadata before use. Never put the key in a URL.
3. **Placement:** after history loads, and after each run reaches a terminal state or reconnects, list artefacts for the session. Merge cards into turns by `run_id`, falling back to `created_at`, keyed by artefact ID so they're never duplicated (canonical §8).
4. **Inline image component:** downsampled bubble image from the cached file, plus a full-screen viewer. Use React Native `Image` with a `file://` source.
5. **Document card component:** name, type, size and time, with Save, Share and Open with… actions. SVG and HTML are always shown as cards, never rendered.
6. **Save:** `expo-file-system` Storage Access Framework (create a document in a user-picked directory). Must not request storage permissions; the existing `blockedPermissions` stay.
7. **Share:** needs a file share sheet with a `content://` URI. The likely addition is the `expo-sharing` dependency. That is a **new native dependency plus prebuild**, which needs approval and a full local release build (`scripts/build-local-android.sh`).
8. **Cache lifecycle:** clear `artefacts/` on disconnect or unpair and on bridge-key change. Optionally apply an LRU size cap.
9. **Demo parity:** labelled sample image and document artefacts in `demo-backend.ts`, with no network calls.

## Constraints

- No new permissions. Storage permissions stay blocked.
- The connection policy is unchanged: same `.ts.net` host and HTTPS, and the bridge on the same host.
- No artefact UI or requests when the bridge isn't configured or the feature isn't advertised.
- Changes to the debug-signing identity and package are out of scope.

## Tests

- Unit tests (`test/poc-artefacts*.test.mjs`, new):
  - capability gating, including a 404 meaning "unsupported";
  - merge and de-duplication by ID across reload and reconnect;
  - checksum mismatch rejection;
  - SVG and HTML treated as documents;
  - cache clearing on unpair;
  - the key never appears in any URL.
- Fake-bridge integration: extend `test/bridge.test.mjs` once the bridge routes exist (run with `HERMES_BRIDGE_SRC`).
- Device acceptance: canonical AT-04 to AT-10, AT-13, AT-15 and AT-17 on the physical phone against a non-production bridge. Keep deployment-specific evidence (hostnames, checksums) out of this repository.

## Dependencies on the bridge

This can't start beyond capability gating and demo cards until canonical **Q1** (how Hermes signals a deliverable file) is resolved and the bridge routes exist.
