---
"duplex-message": patch
"simple-electron-ipc": patch
---

Upgrade the workspace to pnpm 12, TypeScript 7, Vite 8 and Vitest 5. Provide explicit ESM/CommonJS package entries while retaining legacy browser distribution filenames.

Clean up pending requests, heartbeat timers and unused Worker listeners; reject pending calls on destroy and serialization failures. Preserve caller-owned options and handlers, ignore malformed or mismatched responses, handle non-Error exceptions, recreate destroyed shared hubs, and deliver repeated storage progress updates without cleanup timers.
