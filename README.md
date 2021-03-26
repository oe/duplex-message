<h1 align="center">duplex-message</h1>
<div align="center">
  <a href="https://github.com/oe/duplex-message/actions">
    <img src="https://github.com/oe/duplex-message/actions/workflows/main.yml/badge.svg" alt="github actions">
  </a>
  <a href="#readme">
    <img src="https://badgen.net/badge/Built%20With/TypeScript/blue" alt="code with typescript" height="20">
  </a>
  <a href="#readme">
    <img src="https://badge.fury.io/js/duplex-message.svg" alt="npm version" height="20">
  </a>
  <a href="https://www.npmjs.com/package/duplex-message">
    <img src="https://img.shields.io/npm/dm/duplex-message.svg" alt="npm downloads" height="20">
  </a>
</div>

---

<h4 align="center">A tinny(~2kb) utility that can makes one way message responsible <br> 
enhance postMessage/storageEvent/electron IPC/chrome extension scripts</h4>

## About

## Features
* **Tinny**: less than 2kb gzipped, no external dependencies required
* **Compatibility**: use `postMessage` under the hood, support all modern browser(even IE8)
* **Consistency**: use same api every where(parent window, iframe window, worker, etc)
* **Simple API**: use api `on` `emit` `off` to handle all messages in current context from any window(parent window, child window, workers)
* **Dedicated API**: use api `createDedicatedMessageHub` to create a dedicated message-hub to communicate with specified window(parent window, child window or worker)
* **Responsible**: `emit` will return a promise that you can get response from the other side. You can respond `emit` on other side by return result in `on`'s callback
* **Proxy Message**: with api `createProxy`, you can proxy all messages from a window(iframe, webworker, etc) to another window(worker)
* **Typescript support**: this utility is written in typescript, has type definition inborn

