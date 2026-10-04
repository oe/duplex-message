# duplex-message

<p align="center">
  <a href="https://github.com/oe/duplex-message/actions/workflows/main.yml"><img src="https://github.com/oe/duplex-message/actions/workflows/main.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://github.com/oe/duplex-message/tree/main/packages/duplex-message/src"><img src="https://img.shields.io/badge/language-TypeScript-3178C6?logo=typescript&amp;logoColor=white" alt="Language: TypeScript"></a>
  <a href="https://github.com/oe/duplex-message/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/duplex-message.svg" alt="MIT license"></a>
  <a href="https://www.npmjs.com/package/duplex-message"><img src="https://img.shields.io/npm/v/duplex-message.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/duplex-message"><img src="https://img.shields.io/npm/dm/duplex-message.svg" alt="Monthly npm downloads"></a>
</p>

Promise-based RPC for **iframes, Web Workers and browser tabs**, with progress feedback, typed calls and local cancellation.

Use it when a task in another context needs to return a result and report progress: parsing a file in a Worker, exporting from an embedded editor, or coordinating browser tabs. Four built-in transports share `on`, `emit` and `off`; the browser package has no runtime dependencies and supports tree shaking.

For Electron main ↔ preload communication, use [simple-electron-ipc](https://github.com/oe/duplex-message/tree/main/packages/simple-electron-ipc#readme).

## Install

```sh
pnpm add duplex-message
# or: npm install duplex-message
```

## Quick start: call a Worker

With Vite or another bundler that supports module Workers:

**worker.ts**

```ts
import { PostMessageHub, READY_METHOD } from 'duplex-message'

const hub = new PostMessageHub()
hub.on(self, 'add', (a: number, b: number) => a + b)
// Register ready after application methods and asynchronous initialization.
hub.on(self, READY_METHOD, () => true)
```

**main.ts**

```ts
import { PostMessageHub, waitForPeer } from 'duplex-message'

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
const hub = new PostMessageHub({ requestTimeout: 5000 })

try {
  await waitForPeer(method => hub.emit(worker, method))
  console.log(await hub.emit<number>(worker, 'add', 2, 3)) // 5
} finally {
  hub.destroy()
  worker.terminate()
}
```

`emit` returns a promise. A handler returns its result or a promise; errors reject the caller's promise. Always handle rejection and destroy hubs when their owning view or task ends.

## Typed methods

Share an interface between caller and handler. `createRpcClient` checks method names and arguments and infers the awaited result. It uses the existing wire protocol; it does not validate runtime payloads.

```ts
import { createRpcClient } from 'duplex-message'

interface WorkerApi {
  add(a: number, b: number): number
  title(): Promise<string>
}

const rpc = createRpcClient<WorkerApi>((method, ...args) => hub.emit(worker, method, ...args))
const sum = await rpc.call('add', 2, 3) // number
const title = await rpc.call({ methodName: 'title', requestTimeout: 1000 }) // string

// rpc.call('missing')       // TypeScript error: unknown method
// rpc.call('add', '2', 3)   // TypeScript error: incorrect argument
```

On the handler side, use a typed object, for example `hub.on(self, { add: (a, b) => a + b } satisfies Pick<WorkerApi, 'add'>)`. The original `emit<ResponseType>` API remains available; its generic specifies the result without checking method names or arguments.

## Progress, cancellation and deadlines

Pass an `onprogress` callback in the **first argument**. The library keeps that callback local and installs a corresponding callback in the peer's first argument.

**Worker handler:**

```ts
hub.on(self, 'export', async (options: { onprogress: (percent: number) => void }) => {
  for (let percent = 10; percent <= 100; percent += 10) {
    await new Promise(resolve => setTimeout(resolve, 50))
    options.onprogress(percent)
  }
  return 'export complete'
})
```

**Caller:**

```ts
import { EErrorCode, type IError } from 'duplex-message'

const controller = new AbortController()
const result = hub.emit(worker, {
  methodName: 'export',
  requestTimeout: 10_000,
  signal: controller.signal,
}, { onprogress: (percent: number) => console.log(percent) })

result.catch((error: IError) => {
  if (error.code === EErrorCode.REQUEST_ABORTED) console.log('Cancelled local waiting')
  else if (error.code === EErrorCode.REQUEST_TIMEOUT) console.log('Timed out')
  else console.error(error)
})

// For example, in a Cancel button handler:
// controller.abort()
```

Cancellation and deadlines end **local waiting**. They clear request timers/listeners and ignore late progress/results. An already running peer handler continues; its effects are not undone. An already aborted signal prevents sending. Signals and timeout controls never cross the transport.

`requestTimeout` measures the whole request, including heartbeat wait. Progress does not reset it. Its default is `0` (unlimited); a per-call value overrides the constructor default, and `0` disables that default. Valid values are finite numbers from `0` to `2147483647` milliseconds.

New peers explicitly distinguish heartbeat and business progress. When either peer uses an older release, avoid the reserved progress string `--message-hub-to-be-continued--` because the old protocol treats it as a heartbeat.

## Iframes and origin restrictions

Use a trusted origin for both outgoing messages and incoming messages.

**Parent:**

```ts
import { PostMessageHub, waitForPeer } from 'duplex-message'

const iframe = document.querySelector<HTMLIFrameElement>('#editor')!
const childOrigin = new URL(iframe.src).origin
const hub = new PostMessageHub({
  allowedOrigins: [childOrigin],
  targetOrigin: childOrigin,
})

await waitForPeer(method => hub.emit(iframe.contentWindow!, method))
const result = await hub.emit(iframe.contentWindow!, 'add', 2, 3)
```

**Iframe:**

```ts
import { PostMessageHub, READY_METHOD } from 'duplex-message'

const parentOrigin = 'https://app.example.com' // Your trusted application origin.
const hub = new PostMessageHub({ allowedOrigins: [parentOrigin], targetOrigin: parentOrigin })
hub.on(parent, 'add', (a: number, b: number) => a + b)
hub.on(parent, READY_METHOD, () => true)
```

`allowedOrigins` filters incoming Window messages before handlers and response callbacks run. Replies to accepted window messages use the verified sender origin. `targetOrigin` is the default for outgoing window messages; a per-call `targetOrigin` overrides it.

For compatibility, omitting `allowedOrigins` accepts any origin and the default `targetOrigin` is `'*'`. Configure explicit origins for trusted iframe/window integrations. An empty list rejects all window origins; `['*']` explicitly accepts all. Origin checks apply to Window messages; Worker messages have no meaningful Window origin. Validate application arguments and permissions in handlers as well.

For multiple trusted origins, set a per-call `targetOrigin` whenever the destination differs from the hub's configured default. For opaque origins such as sandboxed iframes, the string `'null'` does not uniquely identify a trusted site; prefer an origin-preserving configuration.

## Wait for application readiness

Register `READY_METHOD` **after** initialization and handler registration:

```ts
await initializeApplication()
hub.on(peer, 'export', exportDocument)
hub.on(peer, READY_METHOD, () => true)
```

The caller uses:

```ts
await waitForPeer(method => hub.emit(peer, method), {
  timeout: 5000,
  interval: 100,
  signal: controller.signal,
})
```

`waitForPeer` retries only the explicit ready endpoint, never a business operation. A ready handler returns `true`; it may return `false` while still initializing. Missing handlers and probe timeouts are retried. Other handler errors reject immediately. The overall deadline also works when an adapter fails to resolve. Completion, cancellation and timeout release the wait's timers/listeners.

The peer must implement the ready endpoint, including when communicating with older releases. A catch-all handler should route `READY_METHOD` explicitly. The defaults are a 5000ms total deadline and a 100ms probe timeout/pause; both options must be positive finite numbers up to `2147483647`.

## Choose a transport

| Class | Contexts | Native transport |
| --- | --- | --- |
| `PostMessageHub` | Windows, iframes, dedicated browser Workers | `postMessage` |
| `BroadcastMessageHub` | Same-origin browser tabs, Node BroadcastChannel contexts | `BroadcastChannel` |
| `StorageMessageHub` | Same-origin browser windows/tabs | `localStorage` storage events |
| `PageScriptMessageHub` | Separate hub instances in the same page; page/content-script bridges | `CustomEvent` |

Different transport classes do not communicate with each other. `PageScriptMessageHub` is not a complete browser-extension background/service-worker router.

The last three classes omit the `peer` argument:

```ts
import { BroadcastMessageHub, createRpcClient } from 'duplex-message'

// Responding tab:
const server = new BroadcastMessageHub({ channelName: 'editor' })
server.on('title', () => document.title)

// Calling tab:
const client = new BroadcastMessageHub({ channelName: 'editor' })
const rpc = createRpcClient<{ title(): string }>((method, ...args) => client.emit(method, ...args))
console.log(await rpc.call('title'))
// Destroy both hubs when their owning views end.
```

Broadcast requests can execute handlers in multiple peers. The caller accepts one selected responder's result, not an aggregate; this is request/response RPC rather than a fan-out collection API. Specify `to: peer.instanceID` in method configuration to address one hub.

## API reference

### Hub options

All hubs accept `{ instanceID?, heartbeatTimeout?, requestTimeout? }`.

- `instanceID`: custom peer identity; generated when omitted.
- `heartbeatTimeout`: handler-acknowledgement wait, default 500ms. It does not limit handler duration. If it expires before a total request deadline, the caller receives `METHOD_NOT_FOUND`.
- `requestTimeout`: optional total deadline, default `0`.

Transport options:

- `PostMessageHub`: `allowedOrigins?: readonly string[]`, `targetOrigin?: string`.
- `BroadcastMessageHub`: `channelName?: string`.
- `StorageMessageHub`: `keyPrefix?: string`.
- `PageScriptMessageHub`: `customEventName?: string`.

Every class provides a `shared` getter. Destroying a shared hub allows a later getter to create a new instance.

### on, emit, off and destroy

```ts
hub.on(peer, 'add', (a: number, b: number) => a + b)
hub.on(peer, { title: () => document.title, add: (a: number, b: number) => a + b })
hub.on(peer, (methodName: string, ...args: unknown[]) => route(methodName, args))

await hub.emit(peer, 'add', 2, 3)
await hub.emit(peer, { methodName: 'add', to: peerInstanceID, requestTimeout: 5000 }, 2, 3)

hub.off(peer, 'add', specificHandler) // Remove one handler.
hub.off(peer, 'add')                // Remove handlers for this method.
hub.off(peer)                       // Remove handlers for this peer.
hub.destroy()                      // Reject pending calls and release resources.
```

Omit `peer` for Broadcast/Storage/PageScript hubs. `PostMessageHub.on('*', ...)` registers a fallback handler for attached peers. Registering a Worker handler or emitting to it attaches its listener; a wildcard registration alone does not discover Workers.

Handler maps can contain arrays of functions. All applicable functions run; the first defined successful result wins. If all successful handlers return `undefined`, the request resolves with `undefined`. Catch-all handlers receive the method name as their first argument.

`destroy()` is idempotent. Pending calls reject with `UNKNOWN`; peer-side work is not cancelled. Completed/failed/cancelled calls release response state, timers and abort listeners. Worker listeners remain while pending calls or registered handlers need them.

### Method configuration and transferables

`emit` accepts a method string or `{ methodName, to?, signal?, requestTimeout? }`. PostMessage calls additionally accept `targetOrigin` and `transfer`:

```ts
const buffer = new ArrayBuffer(1024)
await hub.emit(worker, { methodName: 'process', transfer: [buffer] }, buffer)
```

Arguments/results must be supported by the underlying transport's serialization. Transferred buffers are detached from the sender. Storage uses JSON-compatible data. Avoid exposing arbitrary privileged operations through wildcard or catch-all handlers.

### Dedicated hubs and proxies

```ts
const dedicated = hub.createDedicatedMessageHub(worker)
await dedicated.emit('add', 2, 3)
dedicated.on('notify', handler)
dedicated.off('notify')
dedicated.setPeer(anotherWorker)

// Forward iframe requests to a Worker from a normal window context.
hub.createProxy(iframe.contentWindow!, worker)
hub.stopProxy(iframe.contentWindow!)
```

Pass `silent: true` as the second `createDedicatedMessageHub` argument to suppress missing-peer registration errors; emitting without a peer still rejects with `PEER_NOT_FOUND`. Proxies forward RPC through handlers, so business progress and response results are preserved.

### Errors

Rejected calls expose `IError`: `{ code: EErrorCode, message: string, error?: Error }`. Import the enum from `duplex-message`.

| Code | Name | Meaning |
| --- | --- | --- |
| 1 | `HANDLER_EXEC_ERROR` | A peer handler failed. |
| 2 | `PEER_NOT_FOUND` | Peer missing or unloaded. |
| 3 | `METHOD_NOT_FOUND` | No matching handler acknowledgement in time. |
| 4 | `INVALID_MESSAGE` | Invalid controls, serialization or transport failure. |
| 5 | `UNKNOWN` | Unspecified error, including hub destruction. |
| 6 | `REQUEST_ABORTED` | Caller cancelled local waiting. |
| 7 | `REQUEST_TIMEOUT` | Request or readiness deadline expired. |

### Imports and debug output

The package provides ESM, CommonJS and type declarations for TypeScript 4.1 or later. The workspace's TypeScript 7 compiler is not required by consumers. Use normal package imports with a bundler or Node. Legacy `dist/index.es.js`, UMD and production filenames remain available, including extensionless distribution imports; explicit ESM filenames end in `.mjs`. The UMD global is `duplex-message`. Published JavaScript targets ES2018 and is checked against that syntax level. The selected transport must be supported by the runtime; readiness and cancellation additionally need `AbortController`/`AbortSignal`.

When upgrading from 2.1, upgrade TypeScript if using a compiler older than 4.1. `destroy()` now rejects pending calls with `UNKNOWN` instead of leaving them unresolved; handle rejections from each call. The existing `emit` signatures and wire protocol are retained. `signal` and `requestTimeout` in method configuration are reserved local controls, and the legacy `heartbeatTimeout: 0` fallback remains 500ms.

Debug logging is enabled when `process.env.NODE_ENV` exists and is not `production`. Bundlers can replace that value; production-specific browser builds are also available at `duplex-message/dist/index.production.es.mjs` and `duplex-message/dist/index.production.umd.js`.

## When to choose another approach

| Need | Consider |
| --- | --- |
| Built-in transports, familiar event names and per-request progress | duplex-message |
| Remote Worker objects/properties and proxy callbacks | [Comlink](https://github.com/GoogleChromeLabs/comlink) |
| Established window/iframe connections and MessagePort integrations | [Penpal](https://github.com/Aaronius/penpal) |
| Typed RPC over a custom transport such as WebSocket | [birpc](https://github.com/antfu-collective/birpc) |
| Only a handful of simple messages | Native `postMessage` / `MessageChannel` may be sufficient |

See the [runnable browser demos](https://github.com/oe/duplex-message/tree/main/packages/duplex-message/demo) and [workspace development instructions](https://github.com/oe/duplex-message#development). CI exercises Node, Chromium/Firefox/WebKit Workers and iframes, and packed CJS/ESM consumers. This covers current Playwright engines; older browsers, mobile Safari and embedded WebViews still require application-level verification.

## License

MIT. See [LICENSE](https://github.com/oe/duplex-message/blob/main/LICENSE).
