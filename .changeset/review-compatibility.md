---
"duplex-message": major
"simple-electron-ipc": major
---

Published declarations now require TypeScript 4.1 or later for recursive RPC result inference; compilers predating 4.1 must be upgraded. Runtime emit signatures and the legacy wire protocol remain compatible. Pending calls now reject with UNKNOWN when their hub is destroyed instead of remaining unresolved; callers must handle rejected promises.

Preserve the legacy zero-heartbeat-timeout fallback and extensionless distribution imports. Node import/require share the same implementation and shared hubs; browser bundlers retain the ESM entry. Keep outgoing target origins independent of incoming messages, require an explicit synchronous true from Electron sender validators, safely convert unreadable handler exceptions, and consolidate pending request bookkeeping to reduce allocation and cleanup overhead.
