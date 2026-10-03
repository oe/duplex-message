<h1 align="center">duplex-message</h1>
<div align="center">
  <a href="https://github.com/oe/duplex-message/actions">
    <img src="https://github.com/oe/duplex-message/actions/workflows/main.yml/badge.svg" alt="github actions">
  </a>
  <a href="#readme">
    <img src="https://badgen.net/badge/Built%20With/TypeScript/blue" alt="code with typescript" height="20">
  </a>
</div>


<h3 align="center">A small utility that makes one way messaging responsive <br>
enhance postMessage/storageEvent/electron IPC/chrome extension scripts</h3>

## packages
1. For browser: check [Duplex-Message](https://github.com/oe/duplex-message/tree/main/packages/duplex-message)  
2.  For electron: check [Simple-Electron-IPC](https://github.com/oe/duplex-message/tree/main/packages/simple-electron-ipc)  

## publish steps
1. `pnpm changeset` to create a changeset
2. `pnpm changeset version` to update the version
3. `pnpm publish -r` to publish the package

## Development

Use Node.js 22.12+, 24, or 26+ and pnpm 12.8.1. The workspace pins TypeScript 7.0.2, Vite 8.3.2 and Vitest 5.0.3 in the pnpm catalog.

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

`pnpm test:unit` runs Node and mocked Electron IPC tests without a browser. `pnpm test` also exercises Chromium Workers, iframes, proxies, page-script events and storage messaging. Electron tests simulate its serialization and event interfaces; they do not launch the Electron GUI. CI checks Node 22 and 24, builds both demos and validates packed CJS/ESM imports, NodeNext types, UMD globals and tree shaking.

```sh
pnpm --filter duplex-message dev
pnpm --filter duplex-message build:demo
pnpm --filter simple-electron-ipc dev
```

Set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` during installation if you only need library builds and tests. Leave it unset to run the Electron demo. Library JavaScript targets ES2020. Browser builds retain the legacy `dist/index.es.js`, `dist/index.umd.js` and production filenames; package imports use explicit `.mjs`/CommonJS entries. Type declarations are emitted by TypeScript directly, without a second compiler in a declaration plugin.

Completed requests clear their timers and abort listeners immediately. `destroy()` rejects outstanding requests with `EErrorCode.UNKNOWN` and releases listeners. A heartbeat acknowledges handler availability; requests have no total timeout by default. Pass `requestTimeout` and/or an `AbortSignal` in the method configuration to bound local waiting. See [request controls](packages/duplex-message/README.md#cancellation-and-request-deadlines).
