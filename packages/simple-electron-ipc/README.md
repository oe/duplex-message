# simple-electron-ipc

<p align="center">
  <a href="https://github.com/oe/duplex-message/actions/workflows/main.yml"><img src="https://github.com/oe/duplex-message/actions/workflows/main.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://github.com/oe/duplex-message/tree/main/packages/simple-electron-ipc/src"><img src="https://img.shields.io/badge/language-TypeScript-3178C6?logo=typescript&amp;logoColor=white" alt="Language: TypeScript"></a>
  <a href="https://github.com/oe/duplex-message/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/simple-electron-ipc.svg" alt="MIT license"></a>
  <a href="https://www.npmjs.com/package/simple-electron-ipc"><img src="https://img.shields.io/npm/v/simple-electron-ipc.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/simple-electron-ipc"><img src="https://img.shields.io/npm/dm/simple-electron-ipc.svg" alt="Monthly npm downloads"></a>
</p>

**Bidirectional Electron RPC with progress feedback, typed calls and local cancellation.** Use it in the main process and an isolated preload; expose specific application operations through `contextBridge`.

Use it for long-running tasks with progress, or when both main → preload and preload → main need request/response calls. For a few ordinary renderer → main requests, Electron's native [`ipcRenderer.invoke` / `ipcMain.handle`](https://www.electronjs.org/docs/latest/tutorial/ipc) may be enough.

For browser Workers, iframes and tabs, see [duplex-message](https://github.com/oe/duplex-message/tree/main/packages/duplex-message#readme).

## Install

```sh
pnpm add simple-electron-ipc
# or: npm install simple-electron-ipc
```

Your application also needs Electron. The library's runtime dependency on `duplex-message` is installed automatically; shared RPC helpers and types are re-exported here.

## Quick start with context isolation

Keep `nodeIntegration: false`, `contextIsolation: true` and `sandbox: true`. Instantiate `RendererMessageHub` in **preload**, not the unprivileged page. Expose a fixed application API rather than the hub, raw IPC or arbitrary method names.

**Shared application contract (`api.ts`):**

```ts
export interface MainApi {
  add(a: number, b: number): number
}
```

**Main process:**

```ts
import { app, BrowserWindow } from 'electron'
import { MainMessageHub } from 'simple-electron-ipc'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { MainApi } from './api'

void app.whenReady().then(() => {
  const file = join(__dirname, 'index.html')
  const trustedUrl = pathToFileURL(file).href
  const window = new BrowserWindow({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: join(__dirname, 'preload.cjs'),
    },
  })
  const target = window.webContents
  const hub = new MainMessageHub({
    validateSender: event => event.sender === target
      && event.senderFrame === target.mainFrame
      && event.senderFrame.url === trustedUrl,
  })
  hub.on(target, {
    add(a, b) {
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new TypeError('numbers required')
      return a + b
    },
  } satisfies MainApi)
  target.setWindowOpenHandler(() => ({ action: 'deny' }))
  target.on('will-navigate', event => event.preventDefault())
  window.on('closed', () => hub.destroy())
  void window.loadFile(file)
})
```

**Preload (`preload.ts`, bundled to `preload.cjs`):**

```ts
import { contextBridge } from 'electron'
import { RendererMessageHub, createRpcClient } from 'simple-electron-ipc'
import type { MainApi } from './api'

const hub = new RendererMessageHub({ requestTimeout: 5000 })
const main = createRpcClient<MainApi>((method, ...args) => hub.emit(method, ...args))
contextBridge.exposeInMainWorld('appApi', {
  add: (a: number, b: number) => main.call('add', a, b),
})
window.addEventListener('unload', () => hub.destroy())
```

**Renderer page:**

```js
const sum = await window.appApi.add(2, 3) // 5
```

Register main handlers before loading the window. For application initialization that happens later, use the [explicit readiness endpoint](https://github.com/oe/duplex-message/tree/main/packages/duplex-message#wait-for-application-readiness); expose a named operation or ready promise through your bridge rather than raw `emit`.

### Bundle the sandboxed preload

A sandboxed preload has restricted `require` support. Bundle the library and its dependencies into the preload, leaving **only `electron` external**. Build a normal browser bundle for renderer code; it should not import Electron or this library at runtime.

For example, a Vite preload build can use:

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist',
    lib: { entry: 'src/preload.ts', formats: ['cjs'], fileName: () => 'preload.cjs' },
    rolldownOptions: { external: ['electron'] },
  },
})
```

The [runnable demo](https://github.com/oe/duplex-message/tree/main/packages/simple-electron-ipc/demo) includes main, bundled preload, renderer, shared interfaces and a Content Security Policy. From the repository root:

```sh
pnpm install
pnpm build
pnpm --filter simple-electron-ipc dev
```

## Typed calls and both directions

`createRpcClient<Api>` checks method names and parameters and infers awaited results. Types describe the expected API; handlers must still validate actual application data.

```ts
// In main, addressing a particular WebContents:
const renderer = createRpcClient<RendererApi>((method, ...args) => mainHub.emit(webContents, method, ...args))
const title = await renderer.call('pageTitle')

// In preload, addressing main:
const main = createRpcClient<MainApi>((method, ...args) => rendererHub.emit(method, ...args))
const sum = await main.call('add', 2, 3)
// main.call('add', '2', 3) // TypeScript error.
```

Register `pageTitle` in the preload with `rendererHub.on('pageTitle', () => document.title)`. The original generic `emit<ResponseType>` API is also available.

## Progress and local cancellation

Supply `onprogress` in the first argument. The main handler receives a corresponding callback:

```ts
mainHub.on(webContents, 'export', async (options: { onprogress: (percent: number) => void }) => {
  for (let percent = 10; percent <= 100; percent += 10) {
    await new Promise(resolve => setTimeout(resolve, 50))
    options.onprogress(percent)
  }
  return 'done'
})
```

In preload, keep the signal local and expose named start/cancel operations:

```ts
let pending: AbortController | undefined
contextBridge.exposeInMainWorld('exportApi', {
  async start(onprogress: (percent: number) => void) {
    if (typeof onprogress !== 'function') throw new TypeError('callback required')
    if (pending) throw new Error('an export is already pending')
    const controller = new AbortController()
    pending = controller
    try {
      return await rendererHub.emit({
        methodName: 'export', requestTimeout: 10_000, signal: controller.signal,
      }, { onprogress })
    } finally { pending = undefined }
  },
  cancel: () => pending?.abort(),
})
```

The renderer calls `window.exportApi.start(percent => updateProgress(percent))` and handles its promise rejection; a Cancel button calls `window.exportApi.cancel()`.

Cancellation stops **local waiting**, not an already running main handler. The signal and deadline are not sent through IPC or `contextBridge`. Remote work can continue after cancellation. Timers and abort listeners are cleared, and late progress/results are ignored.

A total `requestTimeout` includes heartbeat wait and is not extended by progress. The default is `0` (unlimited). Set a constructor default or override it in method configuration; `0` disables that default. Values must be finite numbers from `0` to `2147483647` milliseconds.

## Sender validation and application boundaries

`MainMessageHub` accepts a synchronous `validateSender(event: IpcMainEvent): boolean`. It runs before any incoming request, progress or response is processed. Only returning `true` accepts the message; any other value or a thrown error ignores it. Async validators are unsupported. Validate both the expected `WebContents` and trusted frame/URL; a registered `WebContents` can contain untrusted child frames.

The hook is optional for compatibility. Configure it for privileged operations, use a narrow bridge API, and validate method arguments and permissions. See [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages).

## API reference

| Operation | Main | Preload |
| --- | --- | --- |
| Register a method | `main.on(webContents, name, handler)` | `renderer.on(name, handler)` |
| Register a map | `main.on(webContents, handlers)` | `renderer.on(handlers)` |
| Call a method | `main.emit(webContents, method, ...args)` | `renderer.emit(method, ...args)` |
| Remove a method | `main.off(webContents, name)` | `renderer.off(name)` |
| Remove all peer methods | `main.off(webContents)` | `renderer.off()` |
| Release a hub | `main.destroy()` | `renderer.destroy()` |

`method` is a string or `IMethodNameConfig` with `{ methodName, to?, requestTimeout?, signal? }`. Main can use `'*'` for fallback registration; use peer-specific registration and sender validation for application operations. Both classes also support catch-all handlers and a `shared` getter. Destroy is idempotent, rejects pending calls with `UNKNOWN`, and releases listeners.

Both constructors support `channelName` (default `message-hub`), `instanceID`, `heartbeatTimeout` (default 500ms) and `requestTimeout` (default `0`). Main additionally supports `validateSender`. Use the same channel name on both sides.

Errors inside the hub conform to `IError`: `{ code, message, error? }`. `EErrorCode` and shared helper types can be imported from `simple-electron-ipc`:

| Code | Name |
| --- | --- |
| 1 | `HANDLER_EXEC_ERROR` |
| 2 | `PEER_NOT_FOUND` |
| 3 | `METHOD_NOT_FOUND` |
| 4 | `INVALID_MESSAGE` |
| 5 | `UNKNOWN` |
| 6 | `REQUEST_ABORTED` |
| 7 | `REQUEST_TIMEOUT` |

Error objects crossing `contextBridge` do not necessarily retain custom properties. If your page needs structured error codes, catch errors in preload and return a narrow application result such as `{ ok: false, code, message }`.

ESM/CommonJS imports and type declarations are available. Shared RPC declarations require TypeScript 4.1 or later; the installed Electron version may require a newer compiler for its own declarations. Consumers do not need the workspace's TypeScript 7 compiler. Library output targets ES2018, with packed JavaScript syntax checked before release. When upgrading from 2.1, handle pending-call rejections on `destroy()` and upgrade compilers older than 4.1. `signal` and `requestTimeout` in method configuration are reserved local controls. CI exercises mocked IPC and a real main/preload/renderer application with Electron 31 and 44 on Linux, and Electron 44 on Windows/macOS. Other Electron versions still require application-level verification.

## Development and license

See [workspace development instructions](https://github.com/oe/duplex-message#development). `pnpm check:electron` builds and runs the real Electron smoke test; Linux runners need a display, for example `xvfb-run -a pnpm check:electron`. Leave `ELECTRON_SKIP_BINARY_DOWNLOAD` unset when installing to run the demo or smoke test.

MIT. See [LICENSE](https://github.com/oe/duplex-message/blob/main/LICENSE).
