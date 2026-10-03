# simple-electron-ipc

## 3.0.0

### Major Changes

- 2d6a57e: Published declarations now require TypeScript 4.1 or later for recursive RPC result inference; compilers predating 4.1 must be upgraded. Runtime emit signatures and the legacy wire protocol remain compatible. Pending calls now reject with UNKNOWN when their hub is destroyed instead of remaining unresolved; callers must handle rejected promises. `signal` and `requestTimeout` in method configuration are reserved local controls and are no longer forwarded as custom wire metadata.

  Preserve the legacy zero-heartbeat-timeout fallback and extensionless distribution imports. Node import/require share the same implementation and shared hubs; browser bundlers retain the ESM entry. Keep outgoing target origins independent of incoming messages, require an explicit synchronous true from Electron sender validators, safely convert unreadable handler exceptions, and consolidate pending request bookkeeping to reduce allocation and cleanup overhead.

### Minor Changes

- 869b3fc: Add optional local `AbortSignal` cancellation and total request deadlines using `requestTimeout`, with new `REQUEST_ABORTED` and `REQUEST_TIMEOUT` error codes. Defaults preserve unlimited handler execution. Caller controls are never serialized, and completed/failed/cancelled requests release their timers and abort listeners.

  Mark heartbeats separately from business progress so new peers can deliver the legacy heartbeat string as ordinary progress. Continue accepting legacy heartbeats, and preserve the legacy heartbeat wire shape for older callers. Worker listeners are attached only for requests that will be sent.
- d143b9e: Add typed RPC clients with method-specific arguments and inferred results, plus bounded, cancellable readiness probes using an explicit ready endpoint. Existing emit APIs and wire messages remain compatible.

  Add configurable incoming Window origin restrictions, default outgoing target origins and origin-pinned replies. Existing origin behavior is preserved when no policy is configured. Add a fail-closed Electron sender/frame validator and re-export the shared RPC helpers from the Electron package.

  Replace the Electron demo with a bundled sandboxed, isolated preload and a fixed contextBridge API. Add a real Electron smoke test to CI. Rewrite package documentation around runnable setup, progress, typed calls and safe integration; update npm descriptions, keywords, repository directories and the Electron package's workspace dependency range.

### Patch Changes

- 130fddb: Upgrade the workspace to pnpm 12, TypeScript 7, Vite 8 and Vitest 5. Provide explicit ESM/CommonJS package entries while retaining legacy browser distribution filenames.

  Clean up pending requests, heartbeat timers and unused Worker listeners; reject pending calls on destroy and serialization failures. Preserve caller-owned options and handlers, ignore malformed or mismatched responses, handle non-Error exceptions, recreate destroyed shared hubs, and deliver repeated storage progress updates without cleanup timers.
- d51e634: Preserve ES2018 syntax in published artifacts and verify that syntax after packing. Reduce Promise allocation, argument copying and repeated validation in the RPC path while retaining heartbeat, cleanup and origin/sender checks. Expand browser coverage to Chromium, Firefox and WebKit and real Electron checks to older Electron 31 and current Electron 44 across desktop platforms.
- Updated dependencies [130fddb]
- Updated dependencies [869b3fc]
- Updated dependencies [2d6a57e]
- Updated dependencies [d51e634]
- Updated dependencies [d143b9e]
  - duplex-message@3.0.0

## 2.1.0

### Minor Changes

- make it safer to use `process`(better debug mode control)

### Patch Changes

- Updated dependencies
  - duplex-message@2.1.0
