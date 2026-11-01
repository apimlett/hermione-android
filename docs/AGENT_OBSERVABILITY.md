# Agent workers and completion notifications

## Shipped in this feature branch (not deployed)

- Root-level optional worker observation is separate from chat turns. Ending a parent run cannot settle the independently read child ledger. It polls the configured bridge while application JS runs, and refreshes on foreground/reopen.
- Activity shows the parent bot/profile separately from child identities (`delegationId:taskIndex`), recorded outcome, elapsed time since dispatch where known, last ledger update, unknown live activity and unknown parent review. It does not display raw goals, reasoning, transcripts, tool arguments or results. Parent session identity is retained; absent parent run/job IDs are null.
- A new **bridge-specific** `GET /v1/profiles/{profile}/workers` capability contract supplies retained asynchronous children. It is not an invented Hermes endpoint or new Hermes SSE event. The matching bridge design/evidence document describes its opt-in read-only adapter for the existing Hermes async ledger. An older/missing/disabled bridge does not imply idle or success.
- Local completion, failure, cancellation, interruption and unknown-outcome alerts respect existing per-bot notification preferences. Stable worker-state event IDs, connection/profile-scoped stored acknowledgements and stable native notification identifiers deduplicate ordinary replay/reopen. Notification taps open Activity and identify the selected worker. No worker notification grants approval or pretends to steer a worker.

## Limits and acceptance status

| Requirement | This increment |
| --- | --- |
| Child remains observable after parent finishes | Verified with deterministic ledger fixtures and real feature bridge/client/observer; not live runtime/device verified |
| Multiple parent/child identities, safe activity, timing | Component and bridge fixtures verified; current task text is deliberately generic, live tool activity unknown |
| Child terminal outcome versus parent review | Separate; parent review is unknown, not implicitly approved or verified |
| Replay/reconnect/reopen | Durable Hermes ledger plus client scheduling acknowledgements tested; no dependency on retained parent SSE |
| Completion/error/attention notification | Local scheduling mocked and dedupe tested; unknown outcome is attention, per-child approval/blocker routing is not provided by this ledger adapter |
| Killed-app delivery | **BLOCKED**: no server-originated sender, registration, receipts or device evidence |
| Published result/artifact deep link | **BLOCKED**: Activity links to recorded worker outcome, not a fabricated child conversation or artefact; safe published-result contract still needed |
| Full active -> push -> receipt -> result acknowledgement | **BLOCKED**, not claimed |

No live worker is claimed from fixture data. Running is explicitly **last recorded running**; a ledger update is not a heartbeat. A missing backend retains uncertainty. A batch unit's join timestamp is not assigned to each child. Hermes owns ledger retention; truncation is explicit. Synchronous/external workers are not covered by this adapter.

Local scheduling acknowledgement is not a notification delivery receipt, parent review, or user-read acknowledgement. A crash between native scheduling and storage can replay a scheduling attempt (the stable native identifier mitigates replacement, not exactly-once device delivery). Denied/muted/quiet-hour attempts are not acknowledged; they may be offered later when allowed. Acknowledgement IDs are retained without eviction to avoid replay storms; storage scaling/garbage collection and durable storage failure UX need follow-up before broad use. No global exactly-once guarantee is claimed.

The optional adapter is disabled by default. No cloud infrastructure, telemetry dependency, Firebase/Expo credentials, live configuration changes or service restarts were added. Killed-app delivery needs an operator-approved provider/network design and real-device registration/delivery/deep-link testing; adding a mock sender interface alone would not satisfy it.

## Temporary task bots: integration direction, not implemented orchestration

A task bot is a user-facing work identity; a worktree only isolates code. Future task views must expose a primary brief/context outside the initiating parent's chat, preserve parent/child/task/session linkage, support real user steering with acknowledged outcome, and show published artefacts. Reuse the stable delegation/task-index/profile/session linkage rather than generic helper-tool labels. Add task/session/child IDs only from actual Hermes authority.

Native Hermes Bot = profile. Worker is a distinct primitive, not automatically a user-addressable chat bot. No profiles or credential copies, fake roster entries, separate bot framework, or task-bot orchestration are created here. A proposed task/session projection can replace Activity as the detail destination once actual routing exists, preserving notification identity and review separation.

## Parent-owned PR integration / RAS handoff

Local new-feature, evidence-driven-testing and greploop instructions were read. Existing task worktrees were retained. No branch reset/rebase, commits, pushes, PR creation, review trigger, uploads, merge or deployment was performed by this worker.

After fetching `origin`, app `origin/main` is `7b9be490f2704304dc16a72c01508872a85751d9`, while this assigned worktree HEAD is `28fdef17f580c7395c8a403ce2a5f9adf1800dfb`. Two pre-existing design-system commits (`f7d47d4`, `28fdef1`) account for a **28-file design-system diff before this task**. The existing design-system PR #1 has that same HEAD and base. Its overlapping layout/Activity patches were read: this task adds observation/provider wiring on top and does not own the redesign. A notifications PR directly against main now would include the unrelated design-system work. Parent must choose a stacked base or land/reconcile that dependency first; do not silently rebase or include redesign changes as notification work.

Task-only paths relative to assigned HEAD (including new files):

```text
app/_layout.tsx
app/activity/[botId].tsx
src/backend.ts
src/bridge.ts
src/live-backend.ts
src/notify.ts
src/ui/worker-panel.tsx
src/worker-monitor.tsx
src/worker-observer.ts
src/workers.ts
test/poc-worker-monitor.test.mjs
test/poc-worker-notify.test.mjs
test/poc-worker-observer.test.mjs
test/poc-worker-ui.test.mjs
test/poc-workers.test.mjs
test/workers_stack.py
docs/AGENT_OBSERVABILITY.md
```

Local evidence is retained under ignored `dist/agent-notifications-evidence/` (`report.md`, `typecheck.log`, `npm-test.log`, `poc-test.log`). Raw logs are private development evidence, not upload-ready documents. UI visual/device assertions are explicitly untested in that report; measured component/API assertions are not substituted for native screenshots.

Greptile: **not run, 0 cycles, no score**. No notification PR/revision exists from this worker; local checks are not Greptile review. Parent owns task-only staging/commit/push/PR and a fresh review tied to its published revision. Re-run relevant checks after any base integration changes, then follow bounded review/fix cycles and do not claim review completion without actual fresh results.

## Verification and reproduction

```sh
npm run typecheck
HERMES_BRIDGE_SRC=/path/to/feature-bridge npm test
HERMES_BRIDGE_SRC=/path/to/feature-bridge npm run test:poc
```

Baseline: typecheck passed; npm test 149 total, 141 pass, 8 bridge skips; POC 52 pass. No baseline failures. Installation used the documented isolated `npm ci --ignore-scripts --legacy-peer-deps`; package/lock files are unchanged. Installer reports 13 inherited vulnerabilities (1 low, 10 moderate, 2 high); no audit fixes applied.

Regression evidence: bridge RED 404 at the missing worker-status seam -> GREEN durable child outcomes; app RED missing independent child-status method -> GREEN real feature bridge integration. Observer RED missing visibility -> GREEN, plus RED/GREEN concurrency/reopen/error/disposal cases. Notifications RED missing worker sender -> GREEN mocked provider/preferences tests. Worker UI RED absent -> GREEN component/wiring tests. Timer-nudge regression RED three polling timers -> GREEN one loop. These are local synthetic/component tests, not production delivery evidence.

Historical completion wake loss remains undiagnosed. Source review found existing Hermes `subagent.start`/`subagent.complete` run events, a live-only gateway `delegation.status` method and durable async ledger; generic API async delivery is disabled but audited session-history/wake paths exist. None is proof of where a specific historical completion was lost.

Final verification: `npm run typecheck` passed; `npm test` with the feature bridge source passed **149/149**, zero skips/failures; `npm run test:poc` with that same bridge passed **63/63**, zero skips/failures. The bridge full unittest suite passed **57 tests**. Both worktrees pass `git diff --check`. Existing Node localStorage experimental warning and bridge ResourceWarnings remain; no new test failures. No installed app, running bridge, Hermes runtime source, profile or deployment was changed.
