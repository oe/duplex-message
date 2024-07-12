<h1 align="center">Duplex-Message</h1>

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


<h4 align="center">A tinny(~3kb) utility that can simplify cross window / iframes / workers communications, even with progress feedback support.</h4>

## 📝 Table of Contents
- [Features](#features)
- [Install](#install)
- [Example](#example)
- [Usage](#usage)
  - [PostMessageHub](#postmessagehub) for windows / iframes / workers
    - [postMessageHub.emit](#postmessagehubemit)
    - [postMessageHub.on](#postmessagehubon)
    - [progress for PostMessageHub](#progress-for-postmessagehub)
    - [postMessageHub.off](#postmessagehuboff)
    - [postMessageHub.createDedicatedMessageHub](#postmessagehubcreatededicatedmessagehub)
    - [postMessageHub.createProxy](#postmessagehubcreateproxy)
  - [StorageMessageHub](#storagemessagehub) for same-origin pages messaging via sessionStorage
    - [storageMessageHub.emit](#storagemessagehubemit)
    - [storageMessageHub.on](#storagemessagehubon)
    - [progress for storageMessageHub](#progress-for-storagemessagehub)
    - [storageMessageHub.off](#storagemessagehuboff)
  - [PageScriptMessageHub](#pagescriptmessagehub) for isolated js environment in same window context
    - [pageScriptMessageHub.emit](#pagescriptmessagehubemit)
    - [pageScriptMessageHub.on](#pagescriptmessagehubon)
    - [progress for PageScriptMessageHub](#progress-for-pagescriptmessagehub)
    - [pageScriptMessageHub.off](#pagescriptmessagehuboff)
  - [Error](#error)
  - [Debug](#debug)

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

in main window
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

in iframe window

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
## Usage

### PostMessageHub
`PostMessageHub` works in browser and use `postMessage` under the hood, it enable you:
1. communicate between multi **windows / iframes / workers / window.openers** easily at the same time
2. listen and respond messages with the same code.


When to use it:  
> 1. you have iframes / workers / windows opened by another window
> 2. you need to communicate between them.

`PostMessageHub` is a class, `new` an instance before using it 
```js
import { PostMessageHub } from "duplex-message"

const postMessageHub = new PostMessageHub()
```

Tips:
> in most cases, you only need one instance in a window/worker context, you can use  
>>   `PostMessageHub.shared` instead of new an instance.   
>   e.g.:   
>     `PostMessageHub.shared.on(peerWin, 'xxx', () => {...})`

#### postMessageHub.emit
Send a message to peer, invoking `methodName` registered on the peer via [`on`](#postmessagehubon) with all its arguments `args`:

```ts
// in typescript, use ResponseType to specify response type
postMessageHub.emit<ResponseType = unknown>(peer: Window | Worker, methodName: string, ...args: any[]) => Promise<ResponseType>
```

This api return a promise, you can get the response or catch an exception via it.

e.g.
```js
// for ts 
postMessageHub
  .emit<string>(peerWindow, 'some-method', 'arg1', 'arg2', 'otherArgs')
  // res will be inferred as a string
  .then(res => console.log('success', res))
  .catch(err => console.warn('error', err))

// for js
postMessageHub
  .emit(peerWindow, 'some-method', 'arg1', 'arg2', 'otherArgs')
  // res will be inferred as a string
  .then(res => console.log('success', res))
  .catch(err => console.warn('error', err))
```

Notice:
1. If there are multi peers listening to the same message, you'll only get the first one who respond, others will be ignored.
2. look into [Error](#error) when you catch an error
3. set `peer` to `self` if you want to send message from worker to outside
4. omit args if no args are required, e.g `postMessageHub.emit(peerWindow, 'some-method')`
5. you may need to handle the promise returned by `emit` if some linters warning unhandled promise(or floating promise)


#### postMessageHub.on
Listen messages sent from peer, it has following forms:
```ts
// register(listen)) one handler for methodName when message received from peer
//  * means all peers, same as below
postMessageHub.on(peer: Window | Worker | '*', methodName: string, handler: Function)
// register(listen)) multi handlers
postMessageHub.on(peer: Window | Worker | '*', handlerMap: Record<string, Function>)
// register only one handler to deal with all messages from peer
postMessageHub.on(peer: Window | Worker | '*', singleHandler: Function)
```

e.g.
```js
// listen multi messages from peerWindow  by passing a handler map
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

// listen 'some-other-method' from peerWindow with an async callback
postMessageHub.on(peerWindow, 'some-other-method', async function (a, b, c) {
  try {
    const result = await someAsyncFn(a, b, c)
    return result
  } catch (e) {
    throw e
  }
})

// listen all peers' 'some-common-method' with a same callback
postMessageHub.on('*', 'some-common-method', async function (a, b) {
  ...
})

// listen all messages to peerWindow2 with on callback (first arg is the methodName)
postMessageHub.on(peerWindow2, async function (methodName, ...args) {
  ...
})
```

Notice:
1. you should only listen a message once, it will override existing listener when do it again
2. set `peer` to `self` if you want to listen messages in worker
3. set `peer` to a `Worker` instance(e.g `new Worker('./xxxx.js')`) if you want to listen its messages in a normal window context
4. the specified callback will be called if you listen same `methodName` in specified peer and `*`
5. if you want worker's messages handled by callbacks registered via peer `*` , **you must call `postMessageHub.on` with worker(e.g `postMessageHub.on(worker, {})`) to register worker due to worker's restrictions**


#### progress for PostMessageHub
If you need progress feedback when peer handling you requests, you can do it by setting the first argument as an object and has a function property named `onprogress` when `emit` messages, and call `onprogress` in `on` on the peer's side.

e.g.
```js
// in normal window, send message to worker, get progress
postMessageHub.emit(workerInstance, 'download', {
 onprogress(p) {console.log('progress: ' + p.count)}
}).then(e => {
 console.log('success: ', e)
}).catch(err => {
  console.log('error: ' + err)
})

// in worker thread
// listen download from main window
workerMessageHub.on(self, {
  // download with progress support
  download: (msg) => {
    return new Promise((resolve, reject) => {
      let hiCount = 0
      const tid = setInterval(() => {
        if (hiCount >= 100) {
          clearInterval(tid)
          return resolve('done')
        }
        // call onprogress if exists 
        msg && msg.onprogress && msg.onprogress({count: hiCount += 10})
      }, 200)
    })
  }
}

```

#### postMessageHub.off
Remove message handlers, if `methodName` presented, remove `methodName`'s listener, or remove the whole peer's listener

```ts
postMessageHub.off(peer: Window | Worker | '*', methodName?: string)
```

#### postMessageHub.destroy
Destroy instance: remove all message handlers and references of objects.
Any invoking of destroyed instance's methods will throw an exception

```ts
postMessageHub.destroy()
```

#### postMessageHub.createDedicatedMessageHub
Create a dedicated message-hub for specified peer, so that you won't need to pass peer every time:   

```ts
/**
* @param peer peer window to communicate with, or you can set it later via `setPeer`
* @param silent when peer not exists, keep silent instead of throw an error when call emit, on, off
*/
postMessageHub.createDedicatedMessageHub (peer?: Window | Worker, silent?: boolean) => IDedicatedMessageHub

interface IDedicatedMessageHub {
  /** if you didn't set a peer when invoking createDedicatedMessageHub, then you can use `setPeer` to set it when it's ready*/
  setPeer: (peer: Window | Worker) => void;
  // in typescript, use ResponseType to specify response type
  emit: <ResponseType = unknown>(methodName: string, ...args: any[]) => Promise<ResponseType>;
  on: (methodName: string, handler: Function) => void;
  on: (handlerMap: Record<string, Function>) => void;
  off: (methodName?: string) => any;
}
```

e.g.
```js
// create without a peer
const dedicatedMessageHub = postMessageHub.createDedicatedMessageHub (null, true)

// this won't work, but won't throw an error neither
dedicatedMessageHub.on('a', () => {...})

dedicatedMessageHub.setPeer(someWorker)

dedicatedMessageHub.on('xx', () => {...})
// in ts, specify response type
dedicatedMessageHub.emit<{title: string}>('some-method', 'xx', 'xxx').then((res) => {
  console.log(res.title)
}).catch(() => {...})

// in js
dedicatedMessageHub.emit<{title: string}>('some-method', 'xx', 'xxx').then((res) => {
  console.log(res.title)
}).catch(() => {...})
```

#### postMessageHub.createProxy
Forward all messages from `fromWin` to `toWin` then forward `toWin`'s response to the `fromWin`, instead of handle messages by self

```ts
postMessageHub.createProxy(fromWin: Window | Worker, toWin: Window | Worker) 
```

e.g.
```ts
// forward all messages from `someWorker` to `someIframeWin`
postMessageHub.createProxy(someWorker, someIframeWin) 

```

There is a funny use case(transparent proxy):  
If you got two iframes in your page, you can make them communicate directly by following code
```ts
postMessageHub.createProxy(frame1Win, frame2Win) // forward message from frame1Win to frame2Win
postMessageHub.createProxy(frame2Win, frame1Win) // forward message from frame2Win to frame1Win
```

### StorageMessageHub
`StorageMessageHub` works in browser and use `storage` event(trigger via changing localStorage) under the hood, it enable you communicating between pages with the [same origin](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)(aka with the same `location.origin`(protocol + domain + port)) in a simple way.

When to use it:
> 1. pages you want to share messages are with the same origin
> 2. they are not(all) managed(opened) by a same page

`StorageMessageHub` is a class, new an instance before using it:
```js
import { StorageMessageHub } from "duplex-message"

const storageMessageHub = new StorageMessageHub(options?: IStorageMessageHubOptions)

interface IStorageMessageHubOptions {
  /** custom instance id for communicating in emit  */
  instanceID?: string
  /** timeout number(millisecond as unit) when no response is received, default: 1000 milliseconds */
  timeout?: number
  /** localStorage key prefix to store message, default: $$xiu */
  keyPrefix?: string
  /** a customable identity that can make your self identified by others, will be used by StorageMessageHub.getPeerIdentifies  */
  identity?: any
}
```

Tips:
> in most cases, you only need one instance in one page, you can use  
>>   `StorageMessageHub.shared` instead of new an instance.   
>   e.g.:   
>     `StorageMessageHub.shared.on('xxx', () => {...})`

Notice:  
> Web pages in browser with same origin are weak connected, they just share one same localStorage area. Sending a message via localStorage just like sending a broadcast, there maybe no listener, or more than one listeners. So, a `timeout` is necessary in case of there is no listener can respond your messages, or they don't respond in time.

#### storageMessageHub.emit
Broadcast(or you can also send to specified peer) a message, invoking `methodName` registered on the peers via [`on`](#storageMessageHubbon) with all its arguments `args`, return a promise with result.


```ts
// send a message and get response
// 
// if no toInstance specified, promise resolve when `first success` response received(
//      there may be more than one peers, they all will respond this message,
//      you will get the first success response,  rest responses will be discarded)
// or the specified instance will respond your call
//
// in typescript, use ResponseType to specify response type
storageMessageHub.emit<ResponseType = unknown>(methodName: string | IMethodNameConfig, ...args: any[]) => Promise<ResponseType>

interface IMethodNameConfig {
  methodName: string
  /** peer's instance id */
  toInstance?: string
}
```
Notice:
1. you should only listen a message once, it will override existing listener when do it again
2. If there are multi webpages listening to the same message, you'll only get the first one who respond, others will be ignored.
3. look into [Error](#error) when you catch an error
4. arguments must be stringify-able, due to localStorage's restrictions
5. you may need to handle the promise returned by `emit` if some linters warning unhandled promise(or floating promise)


e.g.
```js
// broadcast that user has logout
storageMessageHub.emit('user-logout')

// send a message and get the first success response
//  in ts, specify response type
storageMessageHub.emit<{name: string, email: string}>('get-some-info').then(res => {
  console.log(res.name)
}).catch(err => { console.error(err)})
//  in js
storageMessageHub.emit('get-some-info').then(res => {
  console.log(res.name)
}).catch(err => { console.error(err)})
```

#### storageMessageHub.on
Listen messages sent from peer, it has following forms:
```ts
// register(listen)) one handler for methodName when message received from main process
storageMessageHub.on(methodName: string, handler: Function)
// register(listen)) multi handlers
storageMessageHub.on(handlerMap: Record<string, Function>)
// register only one handler to deal with all messages from process
storageMessageHub.on(singleHandler: Function)
```
e.g.
```js
storageMessageHub.on('async-add', async function (a, b) {
  return new Promise((resolve, reject) => {
    resolve(a + b)
  })
})

storageMessageHub.on({
  'method1': function () {...},
  'method2': function (a, b, c) {...}
})

// listen all messages
anotherStorageMessageHub.on((methodName, ...args) => {
  ...
})
```
#### progress for storageMessageHub
If you need progress feedback when peer handling you requests, you can do it by setting the first argument as an object and has a function property named `onprogress` when `emit` messages, and call `onprogress` in `on` on the peer's side.

e.g.
```js
// in normal window, send message to worker, get progress
//  you must get peer's instanceID via `storageMessageHub.getPeerIdentifies` before using it
storageMessageHub.emit('download', {
 onprogress(p) {console.log('progress: ' + p.count)}
}).then(e => {
 console.log('success: ', e)
}).catch(err => {
  console.log('error: ' + err)
})

// listen download from another window that has instance id 'kh9uxd11iyc-kh9uxd11iyc'
anotherWindowStorageMessageHub.on({
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
```

#### storageMessageHub.off
Remove message handlers, if `methodName` presented, remove `methodName`'s listener, or remove the whole peer's listener

```ts
storageMessageHub.off(methodName?: string)
```

#### storageMessageHub.destroy
Destroy instance: remove all message handlers and references of objects.
Any invoking of destroyed instance's methods will throw an exception

```ts
storageMessageHub.destroy()
```

### PageScriptMessageHub
`PageScriptMessageHub` works in browser and use `customEvent` under the hood, it enable you:
1. communicate between isolated javascript environment in same window context
2. listen and respond messages with the same code.


When to use it:  
> 1. when your javascript codes are isolated in same window context, e.g. chrome extension's content script with webpage's js code
> 2. you need to communicate between them.
> **3. you may also use it as an event-bus. The difference is that, it create a new client every time when `new`**

`PageScriptMessageHub` is a class, `new` an instance in every peer before using it 
```js
import { PageScriptMessageHub } from "duplex-message"

const pageScriptMessageHub = new PageScriptMessageHub(options?: IPageScriptMessageHubOptions)

interface IPageScriptMessageHubOptions {
  /** custom event name, default: message-hub */
  customEventName?: string
  /** custom instance id for communicating in emit  */
  instanceID?: string
}
```

Tips:
> in most cases, you only need one instance in one javascript context, you can use  
>>   `PageScriptMessageHub.shared` instead of new an instance.   
>   e.g.:   
>     `PageScriptMessageHub.shared.on('xxx', () => {...})`  
> if you want to use it as an event-bus, you should use `new PageScriptMessageHub()` to create clients

#### pageScriptMessageHub.emit
Send a message to peer, invoking `methodName` registered on the peer via [`on`](#pagescriptmessagehubon) with all its arguments `args`:

```ts
// in typescript, use ResponseType to specify response type
pageScriptMessageHub.emit<ResponseType = unknown>(methodName: string | IMethodNameConfig, ...args: any[]) => Promise<ResponseType>

interface IMethodNameConfig {
  methodName: string
  /** peer's instance id */
  toInstance?: string
}
```

e.g.
```ts
// in ts
pageScriptMessageHub
  .emit<{status: string, message: string}>('stop-download')
  .then(res => console.log('status', res.status))
  .catch(err => console.warn('error', err))
// in js
pageScriptMessageHub
  .emit('stop-download')
  .then(res => console.log('status', res.status))
  .catch(err => console.warn('error', err))
```

Notice:
1. you should only listen a message once, it will override existing listener when do it again
2. If there are multi instances listening to the same message, you'll only get the first one who respond, others will be ignored.
3. look into [Error](#error) when you catch an error
4. omit args if no args are required, e.g `pageScriptMessageHub.emit('some-method')`
5. you may need to handle the promise returned by `emit` if some lint tools warning unhandled promise(or floating promise)


#### pageScriptMessageHub.on
Listen messages sent from peer, it has following forms:

```ts
// register(listen)) one handler for methodName when message received from main process
pageScriptMessageHub.on(methodName: string, handler: Function)
// register(listen)) multi handlers
pageScriptMessageHub.on(handlerMap: Record<string, Function>)
// register only one handler to deal with all messages from process
pageScriptMessageHub.on(singleHandler: Function)
```

e.g.
```js
// in renderer process
pageScriptMessageHub.on('async-add', async function (a, b) {
  return new Promise((resolve, reject) => {
    resolve(a + b)
  })
})

pageScriptMessageHub.on({
  'method1': function () {...},
  'method2': function (a, b, c) {...}
})

// listen all messages from peer with one handler
anotherPageScriptMessageHub.on((methodName, ...args) => {
  ...
})
```


#### progress for PageScriptMessageHub
If you need progress feedback when peer handling you request, you can do it by setting the first argument as an object and has a function property named `onprogress` when `emit` messages, and call `onprogress` in `on` on the peer's side.

e.g.
```js
// listen download from peer
pageScriptMessageHub.on({
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

// in the peer's code
peerPageScriptMessageHub.emit('download', {
 onprogress(p) {console.log('progress: ' + p.count)}
}).then(e => {
 console.log('success: ', e)
}).catch(err => {
  console.log('error: ' + err)
})
```

#### pageScriptMessageHub.off
Remove message handlers, if `methodName` presented, remove `methodName`'s listener, or remove the whole peer's listener

```ts
// in renderer process
pageScriptMessageHub.off(methodName?: string)
```

#### pageScriptMessageHub.destroy
Destroy instance: remove all message handlers and references of objects.
Any invoking of destroyed instance's methods will throw an exception

```ts
pageScriptMessageHub.destroy()
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

