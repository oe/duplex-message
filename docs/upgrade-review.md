# Upgrade review — 2026-10-03

This review compares PR #57 with main and the published `duplex-message@2.1.0` distribution. It is not a claim of zero breaking changes or universal performance improvement.

## Compatibility

Existing `emit` signatures and legacy request/response messages remain available. Real Chromium Workers passed old→new and new→old calls, numerical progress and handler-error propagation. New callers accept legacy heartbeats; older callers still cannot distinguish the reserved heartbeat string from business progress carrying that same string.

The release has explicit upgrade boundaries:

- Declarations require TypeScript 4.1+ for recursive RPC result inference. Published 2.1.0 declarations compiled under 3.9; the new declarations do not. TypeScript 4.1 and 4.4 consumer checks passed, including nested promises, union results and incorrect-call rejection. Consumers do not need TypeScript 7. Electron's own declarations may impose a newer minimum.
- `destroy()` now rejects pending calls with `UNKNOWN` instead of abandoning unresolved promises. Callers must handle promise rejections.
- `signal` and `requestTimeout` in method configuration are reserved local controls; they are not forwarded as custom wire metadata.
- Workspace development requires pnpm 12 and a supported modern Node version. This is separate from the library output's ES2018 target.

The initial upgraded build emitted ES2020 syntax unlike the published 2.1.0 artifact. Both library targets now preserve ES2018, and packed `.js`/`.mjs`/`.cjs` files are parsed with Acorn's ES2018 grammar. This checks syntax, not missing runtime APIs. The chosen transport must exist in the runtime. `waitForPeer` and cancellation require `AbortController`/`AbortSignal`; ordinary calls do not.

The 3.0.0 major release records these boundaries in both package changelogs.

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

The dispatch path now reuses a resolved Promise for response/progress events, avoids redundant async wrappers in Electron, handles a single endpoint without the multi-handler race machinery, and avoids argument/configuration copies when unnecessary. Thenables are assimilated once; multi-handler first-defined/all-undefined/error behavior and rejected-Promise semantics for subclass hooks are preserved by tests.

- Unlike 2.1.0, successful calls release heartbeat timers immediately. A regression test verifies that 1,000 completed calls leave no timers or pending callbacks. A separate browser timer-count probe around 1,000 concurrent clone-transport echoes observed 1,000 timers still waiting in published 2.1.0 versus zero in this build, before destroying either hub. Cancellation/deadlines likewise release local resources; remote handlers continue.
- Full production UMD gzip size grows from approximately **3.8 KB to 5.8 KB**. Safety checks, lifecycle cleanup and optional helpers have a real size cost; this is not a package-size reduction.
- `scripts/benchmark-rpc.mjs` compares a published production ESM artifact, an optional prior PR artifact and the current build. It measures clone/microtask transport, native Worker sequential calls and 32 concurrent lanes. It rotates version order, drains baseline timers between paused measurements, and isolates continuous runs in separate contexts. Concurrent figures are amortized time per call, not individual call latency. Results below are diagnostic; scheduling variation prevents a universal speed claim.

Measurements on 2026-10-03, Chromium 153.0.8010.12 on this Linux workspace, numerical echo; medians in µs/call. “Prior PR” is commit `2d6a57e`, before the dispatch optimization. The first three rows use 8 rotated paused rounds; steady rows use 3 rotated isolated cycles with 2 measured rounds/cycle after 1s continuous warmup.

| Scenario | Published 2.1.0 | Prior PR | Optimized PR |
| --- | ---: | ---: | ---: |
| clone-transport | 12.60 | 13.42 | 12.31 |
| worker-sequential | 57.52 | 65.35 | 60.22 |
| worker-32-concurrent | 27.31 | 30.88 | 29.21 |
| worker-steady-1 | 64.49 | 64.60 | 67.69 |
| worker-steady-32 | 36.84 | 26.70 | 25.90 |

Samples fluctuate with worker scheduling. Compare these workloads only; do not interpret the concurrent rows as per-call latency or claim a universal speedup. The optimized path reduces known allocation and timer-retention costs, but compatibility and security checks still carry overhead. Large payloads and other engines/platforms require separate performance measurements.

Reproduce with `node scripts/benchmark-rpc.mjs /path/to/unpacked/duplex-message-2.1.0/dist/index.production.es.js [prior-build.mjs]`. Run without other CPU-heavy jobs. Raw samples are in [rpc-benchmark.json](rpc-benchmark.json).

The typed client stays a small function wrapper. Readiness adds a bounded opt-in probe loop and abort cleanup, without a proxy layer, connection manager, business retry policy or global background polling. The redundant origin cache and fragmented pending-state maps were unnecessary and have been removed.

## Validation and remaining limits

266 tests: 81 Node, 56 each in Chromium/Firefox/WebKit, and 17 mocked Electron IPC tests. Lint, strict type checking, library builds and packed NodeNext consumers pass. Package checks cover native import/require class and singleton identity, typed RPC results, negative argument tests, extensionless imports, UMD globals and unused-feature tree shaking. Local real Electron 31 and 44 smoke tests pass with context isolation and the renderer sandbox enabled. CI runs Electron 31/44 on Linux and Electron 44 on Windows/macOS.

The browser matrix covers current Playwright Chromium, Firefox and WebKit. WebKit testing is not a guarantee for every Safari/iOS version. Older browsers, embedded WebViews, mobile devices and Electron versions outside the matrix remain unverified. Incoming-origin and Electron-sender restrictions remain opt-in for legacy compatibility; applications must configure them and validate their arguments/permissions. Readiness requires an explicit peer endpoint. Local cancellation does not cancel or reverse peer-side work.
