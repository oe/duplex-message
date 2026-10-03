---
"duplex-message": minor
"simple-electron-ipc": minor
---

Add optional local `AbortSignal` cancellation and total request deadlines using `requestTimeout`, with new `REQUEST_ABORTED` and `REQUEST_TIMEOUT` error codes. Defaults preserve unlimited handler execution. Caller controls are never serialized, and completed/failed/cancelled requests release their timers and abort listeners.

Mark heartbeats separately from business progress so new peers can deliver the legacy heartbeat string as ordinary progress. Continue accepting legacy heartbeats, and preserve the legacy heartbeat wire shape for older callers. Worker listeners are attached only for requests that will be sent.
