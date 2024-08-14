<h1 align="center"></h1>

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


<h4 align="center">A tinny(~4kb) utility that can simplify cross window / iframes / workers communications, even with progress feedback support.</h4>

>[!NOTE]
> This utility is designed to simplify the communication between different window/node contexts(windows, iframes, workers, etc) in the browser, it's a peer-to-peer communication tool, that means you can send messages to a peer and get its response, or listen to messages from a peer and respond to it, but it's not a traditional pub/sub tool, you won't be able to listen message from it self.

## 📖Table of Contents
- [Features](#features)
- [Install](#install)
- [Example](#example)
- [Usage](#usage)
  - [Constructor](#constructor)
  - [Shared instance](#shared-instance)
  - [on](#on)
  - [emit](#emit)
  - [off](#off)
  - [destroy](#destroy)
  - [progress](#progress)
  - [proxy for PostMessageHub](#proxy-for-postmessagehub)
  - [dedicated instance for PostMessageHub](#dedicated-instance-for-postmessagehub)
  - [Error](#error)
  - [Debug](#debug)
- [Development](#development)


## Features
* **Simple API**: `on` `emit` and `off` are all you need
* **Responsible**: `emit` will return a promise with the response from the other side
* **Progress feedback**: get response with progress feedback easily
* **Multi-scenario**: builtin [`PostMessageHub`](#postmessagehub) [`StorageMessageHub`](#storagemessagehub) and [`PageScriptMessageHub`](#pagescriptmessagehub) for different scenarios
* **Tinny**: less than 3kb gzipped(even smaller with tree-shaking), no external dependencies required
* **Consistency**: same api every where 
* **Typescript support**: this utility is written in typescript, has type definition inborn

It also has an electron version that can simplify IPC messaging, check [Simple-Electron-IPC
](https://github.com/oe/duplex-message/tree/master/packages/simple-electron-ipc) for more details.

## Install
using yarn
```sh
yarn add duplex-message
```

or npm
```sh
npm install duplex-message -S
```

## Example

The following example shows you how to use it to make normal window and its iframe communicate easily

**in main window**
```js
import { PostMessageHub } from "duplex-message"

const postMessageHub = new PostMessageHub()

// get child iframe's window, peerWin could be `self.parent` or `new Worker('./worker.js')` in other situation
const peerWin = document.getElementById('child-iframe-1').contentWindow

// ----- listen messages from peer ----

// listen the message pageTitle from peerWin, and respond it
postMessageHub.on(peerWin, 'pageTitle', () => {
  return document.title
})
//  respond to message getHead from peerWin
postMessageHub.on(peerWin, 'add', async (a, b) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(a + b)
    }, 1000)
  })
})

// listen multi messages by passing a handler map
postMessageHub.on(peerWin, {
  // mock a download
  download (msg) {
    return new Promise((resolve, reject) => {
      let progress = 0
      const tid = setInterval(() => {
        if (progress >= 100) {
          clearInterval(tid)
          return resolve('done')
        }
        // send progress if msg has onprogress property
        msg.onprogress && msg.onprogress({progress: progress += 10})
      }, 200)
    })
  },
  method2() {}
})

// ---- send message to peer ---
// send a message to peerWin, and get the response by `.then`
postMessageHub.emit(peerWin, "fib", 10).then(resp => {
  console.log("fibonacci of 10 is", resp)
})

// sending a message not handled by the peer will catch an error
postMessageHub.emit(peerWin, "some-not-existing-method").then(resp => {
  console.log('response', resp) // this won't run
}).catch(err => {
  console.warn('error', err) // bang!
})
```

**in iframe window**

```js
import { PostMessageHub } from "duplex-message"

const postMessageHub = new PostMessageHub()
const peerWin = window.parent


// send a message to the parent and get its response
postMessageHub.emit(peerWin, "pageTitle")
  .then(title => {
    console.log("page title of main thread", title)
  })
  .catch(err => console.error(err))

// create a dedicated message hub, so you won't need to pass `peerWin` every time
const dedicatedMessageHub = postMessageHub.createDedicatedMessageHub(peerWin)

// send message to the parent, don't need the response
dedicatedMessageHub.emit("add", 1, 3).then(res => console.log(res))

dedicatedMessageHub.emit("download", {
  // pass onprogress so it can receive progress updates
  onprogress: (p) => console.log('progress', p)
}).then(res => console.log(res))


// calc fibonacci, respond by a return
dedicatedMessageHub.on("fib", async (num) => {
  // emit a message and wait its response
  const title = await dedicatedMessageHub.emit("pageTitle")
  console.log(title)
  return fib(num)
});


// use a recursive algorithm which will take more than half a minute when n big than 50
function fib(n) {
  if (n < 2) return n
  return fib(n - 1) + fib(n - 2)
}
```

For more examples, check the [demo folder](./demo/).

## Usage

This utility has 4 classes for different scenarios:
* `PostMessageHub` for windows / iframes / workers communication, via `postMessage`
* `StorageMessageHub` for same-origin pages messaging via localStorage's `storage` event
* `PageScriptMessageHub` for isolated js environment(e.g. userscripts) in same window context, via `customEvent`, or it can be used an event bus in the same window context
* `BroadcastMessageHub` for broadcast messaging in the same-origin pages(documents) or different nodejs thread(worker), via `BroadcastChannel`

They all have implemented the same class `AbstractHub`, so they have the similar api, you can use them in the same way.

### Constructor
All classes have a constructor with an optional `options` object, you can set some options when creating an instance

>[!WARNING]
>instances from different classes can't communicate with each other, they are isolated

```ts
// all classes have the following options
//  different classes may its own options
interface IAbstractHubOptions {
  /**
   * custom instance id, used for identifying different instances
   * if not set, a random id will be generated
   */
  instanceID?: string | null
}

// new an instance with options
const postMessageHub = new PostMessageHub({ instanceID: 'some-id' })
// or use default options
const pageScriptMessageHub = new PageScriptMessageHub()

// StorageMessageHub has its own options keyPrefix
interface IStorageMessageHubOptions extends IAbstractHubOptions {
  /** localStorage key prefix to store message, default: $$xiu */
  keyPrefix?: string
}

// new an instance with keyPrefix and instanceID
//  different instances must have same keyPrefix to communicate
const storageMessageHub = new StorageMessageHub({ instanceID: 'some-other-id', keyPrefix: 'my-key-prefix' })
// const storageMessageHub = new StorageMessageHub() // use default options also works

// BroadcastMessageHub has its own options channelName
interface IBroadcastMessageHubOptions extends IAbstractHubOptions {
  /** custom broadcast channel name, default: message-hub */
  channelName?: string
}

// new an instance with channelName and instanceID
// different instances must have same channelName to communicate
const broadcastMessageHub = new BroadcastMessageHub({ instanceID: 'some-other-id', channelName: 'my-channel-name' })
// const broadcastMessageHub = new BroadcastMessageHub() // use default options also works
```

### Shared instance
Each class has a shared instance, you can use it directly without new an instance.

```ts
const postMessageHub = PostMessageHub.shared
const storageMessageHub = StorageMessageHub.shared
const pageScriptMessageHub = PageScriptMessageHub.shared
const broadcastMessageHub = BroadcastMessageHub.shared
```

You will always get the same instance when you use `shared` property in the same context, it's a singleton.


### on
Listen messages sent from peer then respond it by return a value in handler, it has following forms:

```ts
// listen one message from peer, and respond it by return in handler
instance.on(peer: any, methodName: string, handler: Function)
// listen multi messages from peer by passing a handler map, and respond it by return in handler.
// * multi handlers are supported for one message
instance.on(peer: any, handlerMap: Record<string, Function | Function[]>)
// listen all messages from peer with one handler, and respond it by return in handler, the first arg of the generalHandler is the methodName
instance.on(peer: any, generalHandler: Function)
```

The parameter `peer` may be ignored in some instances, e.g. `PageScriptMessageHub`, because it's isolated in the same window context.

```ts
// PostMessageHub requires a `peer` to listen messages from, it could be a `Window`, `Worker`, or '*'(any window/worker)
postMessageHub.on(peerWindow, {
  hi (name) {
    console.log(`name ${name}`)
    // response by return
    return `hi ${name}`
  },
  'some-method': function (a, b) {
    ...
  }
})
// listen a message from a worker
postMessageHub.on(workerInstance, 'some-other-method', console.log)
// listen message from a iframe
postMessageHub.on(someIframe.contentWindow, 'some-iframe-method', console.log)
// in worker context itself, just set peer to self to listen messages from outside
postMessageHub.on(self, 'some-worker-method', console.log)
// listen all messages from all workers/windows. if the methodName has been listened by a specific peer, the handlers from * will be ignored
postMessageHub.on('*', 'some-common-method', console.log)
// listen all message from win in one handler
postMessageHub.on(win, async function (methodName, ...args) {
  ...
})

// -------------------

// StorageMessageHub doesn't require a `peer` to listen messages from, it's isolated in the same window context
storageMessageHub.on('async-add', async function (a, b) {
  return new Promise((resolve, reject) => {
    resolve(a + b)
  })
})

// -------------------

// PageScriptMessageHub doesn't require a `peer` to listen messages from, it's isolated in the same window context
pageScriptMessageHub.on('async-add', async function (a, b) {
  return new Promise((resolve, reject) => {
    resolve(a + b)
  })
})

// -------------------

// BroadcastMessageHub doesn't require a `peer` to listen messages from, it's required to set the same channelName to communicate(and same-origin in browser)
broadcastMessageHub.on('async-add', async function (a, b) {
  return new Promise((resolve, reject) => {
    resolve(a + b)
  })
})

```


>[!WARNING]
>Although a message can be listened by multi handlers, but only one response from a handler will be sent to the peer, it follows the first-come-first-serve rule:
> 1. all handlers will be called when a message received at the same time
> 2. the first handler that successfully called return a `none-undefined` value will be the response, others will be ignored
> 3. if no handler return a `none-undefined` value, then the response will be `undefined`
> 4. error thrown by a handler will be ignored if there is a successful call
> 5. if all handlers throw an error, the last error will be caught and sent to the peer


### emit
Emit a message to peer, invoking `methodName` registered on the peer via [`on`](#on) with all its arguments `args`, return a promise with the response from the peer.

```ts

interface IMethodNameConfig {
  methodName: string
  /** peer instance id that can receive the message */
  to?: string
}

// in typescript, use ResponseType to specify response type
// send a message and get response
instance.emit<ResponseType = unknown>(peer: any, methodName: string | IMethodNameConfig, ...args: any[]) => Promise<ResponseType>
```

Just like `on`, the parameter `peer` may be ignored in some instances, e.g. `PageScriptMessageHub`, because it's isolated in the same window context.

```ts
// PostMessageHub requires a `peer` to send messages to, it could be a `Window`, `Worker`. (`*` is not allowed when emit messages)
postMessageHub.emit(peerWindow, 'some-method', 'arg1', 'arg2', 'otherArgs').then(res => {
  console.log('success', res)
}).catch(err => {
  console.warn('error', err)
})
// send a message to a worker that has instance id 'custom-instanceID', if instance id not matched, an error will be thrown
postMessageHub.emit(workerInstance, { methodName: 'some-method', instanceID: 'custom-instanceID'}, 'arg1', 'arg2', 'otherArgs').then(res => {
  console.log('success', res)
}).catch(err => {
  console.warn('error', err)
})

// in worker context itself, just set peer to self to send messages to outside
postMessageHub.emit(self, 'another-method', 'arg1', 'arg2', 'otherArgs').then(res => {
  console.log('success', res)
}).catch(err => {
  console.warn('error', err)
})

// -------------------

// StorageMessageHub doesn't require a `peer` to send messages to, it's isolated in the same window context
storageMessageHub.emit('async-add', 23, 12).then(res => {
  console.log('success', res)
}).catch(err => {
  console.warn('error', err)
})

// -------------------

// PageScriptMessageHub doesn't require a `peer` to send messages to, it's isolated in the same window context
pageScriptMessageHub.emit('async-add', 223, 89).then(res => {
  console.log('success', res)
}).catch(err => {
  console.warn('error', err)
})

// -------------------

// BroadcastMessageHub doesn't require a `peer` to send messages to, it's required to set the same channelName to communicate(and same-origin in browser)
broadcastMessageHub.emit('async-add', 223, 89).then(res => {
  console.log('success', res)
}).catch(err => {
  console.warn('error', err)
})

```

>[!WARNING]
> 1. If there are multi peers listening to the same message, you'll only get the first one who respond, others will be ignored. but all handlers from different peers will be called.
> 2. If you want to send a message to a specific peer, you should set the `to` property in the `methodName` object, and the peer must have the same instance id as the `to` property.
> 3. If the message has no listener, the promise will be rejected with an error `no listener for message: ${methodName}`
> 4. If the handler throws an error, the promise will be rejected with the error thrown by the handler(error object may be lost in some cases due to serialization issues)
> 5. Please always handle the promise rejection returned by `emit` to avoid unhandled promise warnings

### off
Remove message handlers.

```ts
// 1. if handler presented, remove the handler
// 2. if handlerName presented, remove all handlers for the handlerName
// 3. if no handlerName presented, remove all handlers for the peer
instance.off(peer: any, methodName?: string, handler?: Function)
```

Just like `on`, the parameter `peer` may be ignored in some instances, e.g. `PageScriptMessageHub`, because it's isolated in the same window context.

```ts
postMessageHub.off(peerWindow, 'some-method', someHandler)
postMessageHub.off(peerWindow, 'some-method')
postMessageHub.off(peerWindow)

storageMessageHub.off('async-add', someHandler)
storageMessageHub.off('async-add')
storageMessageHub.off()

pageScriptMessageHub.off('async-add', someHandler)
pageScriptMessageHub.off('async-add')
pageScriptMessageHub.off()

broadcastMessageHub.off('async-add', someHandler)
broadcastMessageHub.off('async-add')
broadcastMessageHub.off()
```

### destroy
Destroy instance: remove all message handlers and references of objects.

```ts
// you can't use the instance after destroy, it will throw an exception
instance.destroy()
```

### progress
Get progress feedback when peer handling you requests.

If you need progress feedback when peer handling you requests, you can do it by setting the first argument as an object and has a function property named `onprogress` when `emit` messages, and call `onprogress` in `on` on the peer's side.

```ts
instance.emit(peer, methodName: string, {
  onprogress: (progressData: any) => void
  ...
}, ...args: any[])


peer.on(instance, methodName: string, async (msg, ...args) => {
  // call onprogress if exists
  msg.onprogress && msg.onprogress({progress: 10})
  // update progress
  ...
  await someAsyncFn()
  return 'done'
})
```

Just like `on`, the parameter `peer` may be ignored in some instances, e.g. `PageScriptMessageHub`, because it's isolated in the same window context.


### proxy for PostMessageHub
PostMessageHub has a `createProxy` method that can forward all messages from `fromWin` to `toWin` then forward `toWin`'s response to the `fromWin`, instead of handle messages by self, it's useful when you want to make two windows communicate directly.

```ts
// create proxy message from `fromWin` to `toWin`
postMessageHub.createProxy(fromWin: Window | Worker, toWin: Window | Worker) 
// stop proxy  message from a peer
postMessageHub.stopProxy(fromWin: Window | Worker)



// forward all messages from `someWorker` to `someIframeWin`
postMessageHub.createProxy(someWorker, someIframeWin) 
// then forward all messages from `someIframeWin` to `someWorker`
postMessageHub.createProxy(someIframeWin, someWorker)
//  with above two lines, `someWorker` and `someIframeWin` can communicate directly, postMessageHub will be a transparent proxy(bridge) between them

// stop proxy
postMessageHub.stopProxy(someWorker)
postMessageHub.stopProxy(someIframeWin)

```


### dedicated instance for PostMessageHub
PostMessageHub has a `createDedicatedMessageHub` method that can create a dedicated message-hub for specified peer, so that you won't need to pass peer every time.

```ts

/**
* @param peer peer window to communicate with, or you can set it later via `setPeer`
* @param silent when peer not exists, keep silent instead of throw an error when call emit, on, off
*/
const dedicatedMessageHub = postMessageHub.createDedicatedMessageHub (peer?: Window | Worker, silent?: boolean) => IDedicatedMessageHub

interface IDedicatedMessageHub {
  /** if you didn't set a peer when invoking createDedicatedMessageHub, then you can use `setPeer` to set it when it's ready*/
  setPeer: (peer: Window | Worker) => void;
  // in typescript, use ResponseType to specify response type
  emit: <ResponseType = unknown>(methodName: string, ...args: any[]) => Promise<ResponseType>;
  on: (methodName: string, handler: Function) => void;
  on: (handlerMap: Record<string, Function>) => void;
  off: (methodName?: string) => any;
}

dedicatedMessageHub.emit('some-method', 'arg1', 'arg2').then(res => {
  console.log('success', res)
}).catch(err => {
  console.warn('error', err)
})

dedicatedMessageHub.on('some-method', console.log)
dedicatedMessageHub.off('some-method')
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
  /** method not found in peer */
  METHOD_NOT_FOUND = 3,
  /** message has invalid content, can't be sent  */
  INVALID_MESSAGE = 4,
  /** other unspecified error */
  UNKNOWN = 5,
}
```

### Debug
if you has some issues when using this lib, you can enable debug mode to see debug logs in console:

```ts
import { setConfig } from 'duplex-message'
setConfig({ debug: true })
```


## Development



```sh
# install dependencies, exec in root of the repo
pnpm install
# dev
pnpm dev
# test
pnpm test
#!! make sure install chromium before running playwright tests by following command
pnpm playwright install chromium

# build
pnpm build
```