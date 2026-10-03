---
"duplex-message": patch
"simple-electron-ipc": patch
---

Preserve ES2018 syntax in published artifacts and verify that syntax after packing. Reduce Promise allocation, argument copying and repeated validation in the RPC path while retaining heartbeat, cleanup and origin/sender checks. Expand browser coverage to Chromium, Firefox and WebKit and real Electron checks to older Electron 31 and current Electron 44 across desktop platforms.
