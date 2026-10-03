# Upgrade review — 2026-10-03

This review compares PR #57 with main and the published `duplex-message@2.1.0` distribution. It is not a claim of zero breaking changes or universal performance improvement.

## Compatibility

Existing `emit` signatures and legacy request/response messages remain available. Real Chromium Workers passed old→new and new→old calls, numerical progress and handler-error propagation. New callers accept legacy heartbeats; older callers still cannot distinguish the reserved heartbeat string from business progress carrying that same string.

The release has explicit upgrade boundaries:

- Declarations require TypeScript 4.1+ for recursive RPC result inference. Published 2.1.0 declarations compiled under 3.9; the new declarations do not. TypeScript 4.1 and 4.4 consumer checks passed, including nested promises, union results and incorrect-call rejection. Consumers do not need TypeScript 7. Electron's own declarations may impose a newer minimum.
- `destroy()` now rejects pending calls with `UNKNOWN` instead of abandoning unresolved promises. Callers must handle promise rejections.
- `signal` and `requestTimeout` in method configuration are reserved local controls; they are not forwarded as custom wire metadata.
- Workspace development requires pnpm 12 and a supported modern Node version. This is separate from the library output's ES2020 target.

A major changeset records these boundaries. Versions have not been bumped and packages have not been published.

## Confirmed issues fixed during review

| Issue | Result |
| --- | --- |
| Accepted incoming origins could override the configured default outgoing origin. | Removed the peer-origin cache; only replies/progress inherit their own request's verified origin. |
| Truthy non-boolean or async Electron validators could accept IPC. | Only synchronous `true` accepts a message. Accidentally rejected async validators are consumed without an unhandled rejection. |
| Unreadable thrown objects could fail inside error conversion and leave RPC unresolved. | Guarded conversion returns a serializable handler error. |
| `heartbeatTimeout: 0` changed from a 500ms fallback to immediate expiry. | Restored the legacy fallback and added a regression test. |
| Adding package exports broke valid extensionless distribution imports. | Added explicit aliases and packed-consumer checks. |
| Native Node import/require loaded different classes and shared hubs. | Both modes share the CJS implementation; Electron uses a small explicit ESM forwarding entry. Browser bundlers retain ESM. |

## Performance and implementation size

Request bookkeeping now uses one pending-request record plus a peer-count map, replacing five separate per-request maps. Cleanup is idempotent and removes state before invoking hooks. Origin metadata is allocated only when an origin policy is enabled and recorded only for incoming requests. Readiness is explicit and optional; unused readiness code is removed by tree shaking. No application request is automatically retried.

The additional safeguards still have costs:

- Full production UMD gzip size grows from approximately **3.8 KB to 5.6 KB**. A minified ESM bundle retaining only `PostMessageHub` grows from approximately **3.37 KB to 4.75 KB**. Sizes measure JavaScript, not README/declarations/archive size.
- After consolidating bookkeeping, an alternating native-Worker benchmark measured median numerical RPC round trips of **60.82→69.54 µs** without persistent handlers and **61.91→67.85 µs** with a persistent handler. These are approximately **14% and 10%** increases for very small calls, or **9 µs and 6 µs** per call. This upgrade should not be advertised as faster for every workload.
- Unlike 2.1.0, successful calls release heartbeat timers immediately. A regression test verifies that 1,000 completed calls leave no timers or pending callbacks. Cancellation/deadlines likewise release local resources; remote handlers continue.

Benchmark method: Chromium 153 on the same Linux workspace; published 2.1.0 versus production builds after bookkeeping consolidation; a native module Worker echoing a number; 1,000 warmups per peer, eight alternating rounds of 5,000 sequential calls per version, and a 550ms pause after each paired round. Samples varied substantially with scheduling. These measurements are diagnostic, not a general throughput guarantee. Large payloads, concurrency, other engines and desktop platforms require separate measurements.

The typed client stays a small function wrapper. Readiness adds a bounded opt-in probe loop and abort cleanup, without a proxy layer, connection manager, business retry policy or global background polling. The redundant origin cache and fragmented pending-state maps were unnecessary and have been removed.

## Validation and remaining limits

146 tests pass: 73 Node, 56 Chromium and 17 mocked Electron IPC tests. Lint, strict type checking, library builds and packed NodeNext consumers pass. Package checks cover native import/require class and singleton identity, typed RPC results, negative argument tests, extensionless imports, UMD globals and unused-feature tree shaking. Real Electron integration is also exercised by CI.

The browser matrix currently covers Chromium, and real Electron tests cover Linux/Electron 44. Older Electron runtimes, Firefox, Safari, Windows and macOS are not verified. Incoming-origin and Electron-sender restrictions remain opt-in for legacy compatibility; applications must configure them and validate their arguments/permissions. Readiness requires an explicit peer endpoint. Local cancellation does not cancel or reverse peer-side work.
