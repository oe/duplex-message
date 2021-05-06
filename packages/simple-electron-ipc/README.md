<h1 align="center">Simple-Electron-IPC</h1>
<div align="center">
  <a href="https://github.com/oe/duplex-message/actions">
    <img src="https://github.com/oe/duplex-message/actions/workflows/main.yml/badge.svg" alt="github actions">
  </a>
  <a href="#readme">
    <img src="https://badgen.net/badge/Built%20With/TypeScript/blue" alt="code with typescript" height="20">
  </a>
  <a href="#readme">
    <img src="https://badge.fury.io/js/simple-electron-ipc.svg" alt="npm version" height="20">
  </a>
  <a href="https://www.npmjs.com/package/simple-electron-ipc">
    <img src="https://img.shields.io/npm/dm/simple-electron-ipc.svg" alt="npm downloads" height="20">
  </a>
</div>


<h4 align="center">an easy way to use electron ipc, get a response via promise, even with progress feedback support</h4>

## 📝 Table of Contents
- [Features](#features)
- [Install](#install)
- [Example](#example)
- [Usage](#usage)
  - [MainMessageHub & RendererMessageHub](#mainmessagehub--renderermessagehub)
  - [emit](#emit)
  - [on](#on)
  - [progress](#progress)
  - [off](#off)
  - [Error](#error)
## Features
* **Simple API**: `on` `emit` and `off` are all you need
* **Responsible**: `emit` will return a promise with the response from the other side
* **Progress-able**: get response with progress easily
* **Tinny**: less than 4kb gzipped(even smaller with tree-shaking), no external dependencies required
* **Consistency**: same api every where 
* **Typescript support**: this utility is written in typescript, has type definition inborn

It also has a browser version that can simplify cross window / js context messaging, check [Duplex-Message
](https://github.com/oe/duplex-message/tree/master/packages/duplex-message) for more details.

## Install
using yarn
```sh
yarn add simple-electron-ipc
```

or npm
```sh
npm install simple-electron-ipc -S
```

## Example

The following example shows you how to use it to to communicate between electron app's main process and renderer process.

in main process:
```js
import { MainMessageHub } from 'simple-electron-ipc'

const mainMessageHub = new MainMessageHub()

// listen getUserToken and download from all renderer processes
mainMessageHub.on('*', {
  getUserToken: (a, b) => Math.random().toString(36) + a + b,

  // download with progress support
  download: (msg) => {
    return new Promise((resolve, reject) => {
      let hiCount = 0
      const tid = setInterval(() => {
        if (hiCount >= 100) {
          clearInterval(tid)
          return resolve('done')
        }
        msg.onprogress({count: hiCount += 10})
      }, 200)
    })
  }
}
// mainWindow should be an instance of BrowserWindow, use mainWindow.webContents to get WebContents object
mainMessageHub.on(mainWindow.webContents, 'some-method', () => {...})

mainMessageHub.emit(mainWindow.webContents, 'generate-watermark', 'arg1', 'arg2')
  .then(base64OfPng => {...})
  .catch(e => console.log(e))
```

in renderer process:
```js
import { RendererMessageHub } from 'simple-electron-ipc'

const rendererMessageHub = new RendererMessageHub()

rendererMessageHub.on('generate-watermark', async (arg1, arg2) => {
  ...
})

rendererMessageHub.emit('download', {
  onprogress(p) {
    console.log('progress', p)
  }
}).then(res => console.log(res))

```

## Usage
### MainMessageHub & RendererMessageHub
Before use this lib to communicate to each other, you need to create instances with `MainMessageHub` for main process & `RendererMessageHub` for renderer process.


```ts
// in main process
import { MainMessageHub } from 'simple-electron-ipc'

const mainMessageHub = new MainMessageHub(options?: IElectronMessageHubOptions)

// in renderer process
import { RendererMessageHub } from 'simple-electron-ipc'

const rendererMessageHub = new RendererMessageHub(options?: IElectronMessageHubOptions)


interface IElectronMessageHubOptions {
  /** ipc channel name used under the hood, default: message-hub */
  channelName?: string
}
```

If you change `channelName` when creating instances, main and renderers should use the same channel name.

You may need to change `webPreferences` when create BrowserWindow, so that you can import `simple-electron-ipc` in renderer process:
```js
import { BrowserWindow } from "electron";
const mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    // other configurations
    ...
  });
```

The usage of `MainMessageHub` and `RendererMessageHub` have subtle differences, because the main process can send messages to multi renderers, but a renderer process can only send messages to the main process.


### emit
Send a message to peer, invoking `methodName` registered on the peer via [`on`](#on) with all its arguments `args`:

```ts
// in main process
//    if you got a BrowserWindow instance, use browserWindow.webContents to get WebContents
mainMessageHub.emit(peer: WebContents, method: string, ...args: any[]) => Promise<unknown>

// in renderer process, no need to specify the peer, the peer is default to the main process
rendererMessageHub.emit(method: string, ...args: any[]) => Promise<unknown>
```

e.g.
```js
// in main process
const mainWindow = new BrowserWindow({....})
mainMessageHub
  .emit(mainWindow.webContents, 'some-method', 'arg1', 'arg2')
  .then(res => console.log('success', res))
  .catch(err => console.warn('error', err))

// in renderer process
rendererMessageHub
  .emit('stop-download')
  .then(res => console.log('success', res))
  .catch(err => console.warn('error', err))
```

Notice:
1. look into [Error](#error) when you catch an error
2. omit args if no arguments are required, e.g `rendererMessageHub.emit('some-method')`
3. you may need to handle the promise returned by `emit` if some lint warning unhandled promise(or floating promise)

### on
Listen messages sent from peer, it has following forms:

```ts
// in main process
// register(listen)) one handler for methodName when message received from renderer
//  * means all renderers, same as below
mainMessageHub.on(peer: WebContents | '*', methodName: string, handler: Function)
// register(listen)) multi handlers
mainMessageHub.on(peer: WebContents | '*', handlerMap: Record<string, Function>)
// register only one handler to deal with all messages from renderer
mainMessageHub.on(peer: WebContents | '*', singleHandler: Function)


// in renderer process
// register(listen)) one handler for methodName when message received from main process
rendererMessageHub.on(methodName: string, handler: Function)
// register(listen)) multi handlers
rendererMessageHub.on(handlerMap: Record<string, Function>)
// register only one handler to deal with all messages from process
rendererMessageHub.on(singleHandler: Function)
```

e.g.
```js
// in main process
const mainWindow = new BrowserWindow({....})
// listen multi messages from mainWindow  by passing a handler map
mainMessageHub.on(mainWindow.webContents, {
  hi (name) {
    console.log(`name ${name}`)
    // response by return
    return `hi ${name}`
  },
  'some-method': function (a, b) {
    ...
  }
})
// listen 'get-token' from all renderers
mainMessageHub.on('*', 'get-token', () => Math.random().toString(36).slice(2) )


// in renderer process
rendererMessageHub.on('async-add', async function (a, b) {
  return new Promise((resolve, reject) => {
    resolve(a + b)
  })
})

rendererMessageHub.on({
  'method1': function () {...},
  'method2': function (a, b, c) {...}
})

// listen all messages from  main process with one handler
anotherWindowRendererMessageHub.on((methodName, ...args) => {
  ...
})
```

Notice:
1. for `mainMessageHub`:  the specified callback will be called if you listen same `methodName` in specified peer and `*`

### progress
If you need progress feedback when peer handling you requests, you can do it by setting the first argument as an object and has a function property named `onprogress` when `emit` messages, and call `onprogress` in `on` on the peer's side.

e.g.
```js
// in main process
// listen download from all renderer processes
mainMessageHub.on('*', {
  // download with progress support
  download: (msg) => {
    return new Promise((resolve, reject) => {
      let hiCount = 0
      const tid = setInterval(() => {
        if (hiCount >= 100) {
          clearInterval(tid)
          return resolve('done')
        }
        // send feedback by calling onprogress if it exists
        msg && msg.onprogress && msg.onprogress({count: hiCount += 10})
      }, 200)
    })
  }
}

// in renderer process
rendererMessageHub.emit('download', {
 onprogress(p) {console.log('progress: ' + p.count)}
}).then(e => {
 console.log('success: ', e)
}).catch(err => {
  console.log('error: ' + err)
})
```

### off
Remove message handlers, if `methodName` presented, remove `methodName`'s listener, or remove the whole peer's listener

```ts
// in main process
mainMessageHub.off(peer: WebContents | '*', methodName?: string)


// in renderer process
rendererMessageHub.off(methodName?: string)
```

### Error
when you catch an error from `emit`, it conforms the following structure `IError`

```ts
/** error object could be caught via emit().catch(err) */
interface IError {
  /** none-zero error code */
  code: EErrorCode
  /** error message */
  message: string
  /** error object if it could pass through via the message channel underground*/
  error?: Error
}

/** enum of error code */
enum EErrorCode {
  /** handler on other side encounter an error  */
  HANDLER_EXEC_ERROR = 1,
  /** peer not found */
  PEER_NOT_FOUND = 2,
  /** message not responded in time */
  TIMEOUT = 3,
  /** message has invalid content, can't be sent  */
  INVALID_MESSAGE = 4,
  /** other unspecified error */
  UNKNOWN = 5,
}
```
