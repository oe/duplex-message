# duplex-message

**Promise-based RPC for iframes and Web Workers, with progress feedback.** The browser library shares one API across window messages, BroadcastChannel, storage events and page-script events. An Electron adapter uses the same request lifecycle.

[![CI](https://github.com/oe/duplex-message/actions/workflows/main.yml/badge.svg)](https://github.com/oe/duplex-message/actions)

Use it for file processing in Workers, embedded editor tasks, or other calls that need a result and progress updates. Typed clients check methods/arguments; optional deadlines and `AbortSignal` cancellation bound local waiting.

| Package | Use it for | Documentation |
| --- | --- | --- |
| [duplex-message](https://www.npmjs.com/package/duplex-message) | Iframes, Workers and same-origin browser tabs; no runtime dependencies | [Browser guide](packages/duplex-message/README.md) |
| [simple-electron-ipc](https://www.npmjs.com/package/simple-electron-ipc) | Bidirectional main ↔ isolated preload RPC | [Electron guide](packages/simple-electron-ipc/README.md) |

## Quick start

```sh
pnpm add duplex-message
# or: npm install duplex-message
```

**worker.ts**

```ts
import { PostMessageHub, READY_METHOD } from 'duplex-message'

const hub = new PostMessageHub()
hub.on(self, 'add', (a: number, b: number) => a + b)
hub.on(self, READY_METHOD, () => true)
```

**main.ts**

```ts
import { PostMessageHub, createRpcClient, waitForPeer } from 'duplex-message'

interface WorkerApi { add(a: number, b: number): number }
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
const hub = new PostMessageHub({ requestTimeout: 5000 })
const rpc = createRpcClient<WorkerApi>((method, ...args) => hub.emit(worker, method, ...args))

try {
  await waitForPeer(method => hub.emit(worker, method))
  console.log(await rpc.call('add', 2, 3)) // 5
} finally {
  hub.destroy()
  worker.terminate()
}
```

This example uses module Workers with Vite. See the browser guide for [progress and cancellation](packages/duplex-message/README.md#progress-cancellation-and-deadlines), [iframe origin restrictions](packages/duplex-message/README.md#iframes-and-origin-restrictions), [transport selection](packages/duplex-message/README.md#choose-a-transport) and [comparisons](packages/duplex-message/README.md#when-to-choose-another-approach).

For Electron, keep Node integration disabled and context isolation enabled. The [runnable Electron demo](packages/simple-electron-ipc/demo/) uses a bundled sandboxed preload and exposes specific application methods through `contextBridge`.

## Development

Use Node.js 22.12+, 24, or 26+ and pnpm 12.8.1. The workspace pins TypeScript 7.0.2, Vite 8.3.2 and Vitest 5.0.3.

```sh
npm install -g pnpm@12.8.1
pnpm install --frozen-lockfile
pnpm --filter duplex-message exec playwright install --with-deps chromium
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm check:package
```

`pnpm test:unit` runs Node and mocked Electron IPC tests without a browser. `pnpm test` also exercises Chromium Workers, real cross-origin iframes, proxies, page-script events and storage messaging. CI checks Node 22 and 24, builds both demos, and validates packed CJS/ESM imports, declarations, UMD globals and tree shaking. Packed type checks include invalid methods/arguments and inferred return types.

```sh
pnpm --filter duplex-message dev
pnpm --filter duplex-message build:demo
pnpm --filter simple-electron-ipc build:demo
pnpm --filter simple-electron-ipc dev
pnpm check:electron
# Headless Linux: xvfb-run -a pnpm check:electron
```

The separate Electron smoke test launches an actual main/preload/renderer application and checks context isolation, restricted bridge methods, bidirectional RPC, progress, local cancellation and renderer controls. CI runs it on Linux with Electron 44. Set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` during installation if you only need library builds/unit tests; leave it unset for the Electron demo/smoke test.

Library output targets ES2020. Legacy browser distribution filenames and the UMD global remain available; package imports use explicit `.mjs`/CommonJS entries. TypeScript emits declarations directly. Existing `emit` APIs remain available; new typed clients and ready endpoints are additive. Origin/sender filters are opt-in to preserve existing integrations; configure them explicitly for trusted peers.

## Releasing

```sh
pnpm changeset
pnpm changeset version
pnpm publish -r
```

Review changesets, validation and release versions before publishing. Cancellation ends local waiting; it does not stop peer-side work or undo effects.

## License

MIT. See [LICENSE](LICENSE).
