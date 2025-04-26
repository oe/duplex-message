<h1 align="center">duplex-message</h1>
<div align="center">
  <a href="https://github.com/oe/duplex-message/actions">
    <img src="https://github.com/oe/duplex-message/actions/workflows/main.yml/badge.svg" alt="github actions">
  </a>
  <a href="#readme">
    <img src="https://badgen.net/badge/Built%20With/TypeScript/blue" alt="code with typescript" height="20">
  </a>
</div>


<h3 align="center">A tinny(~3kb) utility that can makes one way message responsible <br> 
enhance postMessage/storageEvent/electron IPC/chrome extension scripts</h3>

## packages
1. For browser: check [Duplex-Message](https://github.com/oe/duplex-message/tree/main/packages/duplex-message)  
2.  For electron: check [Simple-Electron-IPC](https://github.com/oe/duplex-message/tree/main/packages/simple-electron-ipc)  

## publish steps
1. `pnpm changeset` to create a changeset
2. `pnpm changeset version` to update the version
3. `pnpm publish -r` to publish the package