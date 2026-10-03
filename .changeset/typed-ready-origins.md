---
"duplex-message": minor
"simple-electron-ipc": minor
---

Add typed RPC clients with method-specific arguments and inferred results, plus bounded, cancellable readiness probes using an explicit ready endpoint. Existing emit APIs and wire messages remain compatible.

Add configurable incoming Window origin restrictions, default outgoing target origins and origin-pinned replies. Existing origin behavior is preserved when no policy is configured. Add a fail-closed Electron sender/frame validator and re-export the shared RPC helpers from the Electron package.

Replace the Electron demo with a bundled sandboxed, isolated preload and a fixed contextBridge API. Add a real Electron smoke test to CI. Rewrite package documentation around runnable setup, progress, typed calls and safe integration; update npm descriptions, keywords, repository directories and the Electron package's workspace dependency range.
