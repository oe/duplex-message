<h1 align="center">Duplex-Message</h1>
[WIP] A tinny(~2kb) utility that can makes one way message responsive, enhance postMessage / storageEvent / electron IPC / chrome extension scripts

---

<h5 align="center">A tinny(~2kb) utility that can simplify cross window(iframes, even workers) communications over `postMessage` and `addEventListener('message', xxx)`</h5>
<div align="center">
  <a href="https://travis-ci.com/oe/duplex-message">
    <img src="https://travis-ci.com/oe/duplex-message.svg?branch=master" alt="Travis CI">
  </a>
  <a href="#readme">
    <img src="https://badges.frapsoft.com/typescript/code/typescript.svg?v=101" alt="code with typescript" height="20">
  </a>
  <a href="#readme">
    <img src="https://badge.fury.io/js/duplex-message.svg" alt="npm version" height="20">
  </a>
  <a href="https://www.npmjs.com/package/duplex-message">
    <img src="https://img.shields.io/npm/dm/duplex-message.svg" alt="npm downloads" height="20">
  </a>
</div>

## 📝 Table of Contents
- [Features](#features)
- [Install](#install)
- [Example](#example)
- [Usage](#usage)
  - [PostMessageHub](#postmessagehub) use it when windows/frames/workers are connected(opened by on another)
  - [StorageMessageHub](#storagemessagehub) use it when windows are with same origin and are weak connected
  - [PageScriptMessageHub](#pagescriptmessagehub) use it between browser content-scripts and page-scripts(scripts running in same window but are isolated)
  - [simple-electron-ipc](../simple-electron-ipc/readme.md) use it in electron main process and renderer process

## Features
* **Simple API**: `on` `emit` `off` are all you need
* **Responsible**: `emit` will return a promise with the response from the other side
* **Progress-able**: get response with progress easily
* **Multi-scenario**: using it via `postMessage` 、 `storage` event or  customEvent on varied situations
* **Tinny**: less than 3kb gzipped(even smaller with tree-shaking), no external dependencies required
* **Consistency**: same api every where 
* **Typescript support**: this utility is written in typescript, has type definition inborn

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

// get child iframe's window, peerWin could be `self.parent` or `new Worker('./worker.js')`
const iframeWin = document.getElementById('child-iframe-1').contentWindow

// ----- listen messages from peer ----

// listen the message pageTitle from iframeWin, and respond it
postMessageHub.on(iframeWin, 'pageTitle', () => {
  return document.title
})
//  respond to message getHead from iframeWin2
postMessageHub.on(iframeWin, 'add', async (a, b) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(a + b)
    }, 1000)
  })
})

// listen multi messages by passing a handler map
postMessageHub.on(iframeWin, {
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
// send a message to iframeWin1, and get the response by `.then`
postMessageHub.emit(iframeWin1, "fib", 10).then(resp => {
  console.log("fibonacci of 10 is", resp)
})

// sending a message not handled by the peer will catch an error
postMessageHub.emit(iframeWin1, "some-not-existing-method").then(resp => {
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
postMessageHub.emit(peerWin, "pageTitle").then(title => {
  console.log("page title of main thread", title)
})

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

`PostMessageHub` is a class, new an instance before using it:
```js
import { PostMessageHub } from "duplex-message"

const postMessageHub = new PostMessageHub()
```


#### postMessageHub.emit(peer: Window | Worker, methodName: string, ...args: any[])
Send a message to peer, invoking `methodName` registered on the peer via `on` with all its arguments `args`.

This api return a promise, you can get response or catch the exception via it.

##### peer
1. if you are using it in worker thread and want to send message to parent,  just set `peer` to `self`
2. if you are using it in normal window thread and want to handle message from worker, just set `peer` to a instance of `Worker`(aka `new Worker('./xxxx.js')`) or `ServiceWorker`( not tested yet, should works fine 🧐 )

##### methodName
method name you can want to call(emit) which registered(on) in peer
##### args
`args` vary with `methodName`'s handler registered via `on` in peer's context

#### postMessageHub.on
Listen messages sent from peer, it has following forms:
```ts
// register(listen)) one handler for methodName when message received from peer
postMessageHub.on(peer: Window | Worker | '*', methodName: string, handler: Function)
// register(listen)) multi handlers
postMessageHub.on(peer: Window | Worker | '*', handlerMap: Record<string, Function>)
// register only one handler to deal with all messages from peer
postMessageHub.on(peer: Window | Worker | '*', singleHandler: Function)
```

##### peer
1. if you are using it in Worker thread and want to handle message from parent, just set `peer` to `self`
2. if you are using it in normal window thread and want to handle message from worker, just set `peer` to a instance of `Worker`(aka `new Worker('./xxxx.js')`) or `ServiceWorker`( not tested yet, should works fine 🧐 )
3. you can set `peer` to `*` to listen all messages from all peers(parent, children, workers) to current window. **Due to worker's restrictions, you need register worker so that `*` could works worker's message by `MessageHub.on(worker, {})`**

##### methodName
Method name to register, a `methodName` can only has one `handler`, the `handler` will be overrode if you set same `methodName` multi times

##### handler
1. handler could be an async function
3. if handlers with same methodName registered both in specified peer and `*`, only handler for peer will be triggered when a message sent to peer

##### handlerMap
A object of handlers, keys are methodNames, values are handlers

##### singleHandler
`singleHandler` will receive all parameters, i.e. `(methodName, ...args)`

#### postMessageHub.off(peer: Window | Worker | '*', methodName?: string)
Remove message listener. if `methodName` presented, remove `methodName`'s listener, or remove the whole peer's listener

#### postMessageHub.createDedicatedMessageHub(peer?: Window | Worker)
Create a dedicated message-hub for specified peer, so that you won't need to pass peer every time. 

It returns a new messageHub with following properties:
```ts
{
  /** if you didn't set a peer when invoking createDedicatedMessageHub, then you can use `setPeer` to set it when it's ready*/
  setPeer: (peer: Window | Worker) => void;
  emit: (methodName: string, ...args: any[]) => Promise<unknown>;
  on: (methodName: string, handler: Function) => void;
  on: (handlerMap: Record<string, Function>) => void;
  off: (methodName?: string) => any;
}
```

#### postMessageHub.createProxy(fromWin: Window | Worker, toWin: Window | Worker) 
Forward all messages from `fromWin` to `toWin` then forward `toWin`'s response to the `fromWin`, instead of handle messages by self

There is a funny use case:  
If you got two iframes in your page, you can make them communicate directly by following code
```ts
postMessageHub.createProxy(frame1Win, frame2Win) // forward message from frame1Win to frame2Win
postMessageHub.createProxy(frame2Win, frame1Win) // forward message from frame2Win to frame1Win
```

#### postMessageHub.createProxyFor(peer: Window | Worker) * deprecated *
Deprecated, but still working, you should use `MessageHub.createProxy(peer, window.parent)` instead.

Forward all messages from peer to parent window then forward parent's response to the peer, instead of handle messages by self.

### StorageMessageHub
`StorageMessageHub` works in browser and use `storage` event(trigger via changing localStorage) under the hood, it enable you to communicate between pages with the [same origin](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy), aka with the same `location.origin`(protocol/domain/port) in a simple way.

When to use it:
> 1. pages you want to share messages are with the same origin
> 2. they are not(all) managed(opened) by a same page

`StorageMessageHub` is a class, new an instance before using it:
```js
import { StorageMessageHub } from "duplex-message"

const storageMessageHub = new StorageMessageHub()
```

