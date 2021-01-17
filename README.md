<h1 align="center">MessageHub</h1>

<h5 align="center">A tinny(~2kb) utility than can simplify cross window(iframes, even workers) communications over `postMessage`</h5>
<div align="center">
  <a href="https://travis-ci.com/oe/messagehub">
    <img src="https://travis-ci.com/oe/messagehub.svg?branch=master" alt="Travis CI">
  </a>
  <a href="#readme">
    <img src="https://badges.frapsoft.com/typescript/code/typescript.svg?v=101" alt="code with typescript" height="20">
  </a>
  <a href="#readme">
    <img src="https://badge.fury.io/js/%40evecalm%2Fmessage-hub.svg" alt="npm version" height="20">
  </a>
  <a href="https://www.npmjs.com/package/@evecalm/message-hub">
    <img src="https://img.shields.io/npm/dm/@evecalm/message-hub.svg" alt="npm downloads" height="20">
  </a>
</div>

## Features
* **Tinny**: less than ~2kb gzipped, no external dependences required
* **Compatibility**: use `postMessage` under the hood, support all modern browser(even IE8)
* **Consistency**: use same api every where(parent window, iframe window, worker, etc)
* **Simple API**: use api `on` `emit` `off` to handle all messages in current context from any window(parent window, child window, workers)
* **Dedicated API**: use api `createDedicatedMessageHub` to create a dedicated message-hub to communicate with specified window(parent window, child window, workers)
* **Responsible**: `emit` will return a promise that you can get response from the other side, you can return that response by return it in `on`'s callback
* **Proxy Message**: with api `createProxyFor`, you can proxy all message from child window(iframe, webworker, etc) to parent window, or parent's parent window
* **Typescript support**: this utility is written in typescript, has type definitions inborn

## Install

There are too many packages with similar names, and it's so hard to pick a pretty package name, so I use [scoped package](https://docs.npmjs.com/misc/scope) :)

```sh
npm install @evecalm/message-hub -S
```

or

```sh
yarn add @evecalm/message-hub
```

## Usage

The following demo show you how to use it with iframe

in main window
```js
import MessageHub from "@evecalm/messagehub"
// get child iframe's window, peerWin could be `self.parent` or `new Worker('./worker.js')`
const iframeWin1 = document.getElementById('child-iframe-1').contentWindow
const iframeWin2 = document.getElementById('child-iframe-2').contentWindow

// ----- listen message from peer ----

// listen the message pageTitle from iframeWin1, and response it
MessageHub.on(iframeWin1, 'pageTitle', () => {
  return document.title
})
//  response to message getHead from iframeWin2
MessageHub.on(iframeWin2, 'getHead', () => {
  return document.head.outHTML
})

// listen multi message by passing a handler map
MessageHub.on(iframeWin1, {
  // no return, then the response is undefined
  notice: (name, msg) => {
    console.log(`notice message from ${name} with message ${msg}`)
  },
  getToken () {
    return Math.random()
  }
})

// ---- send message to peer ---
// send a message to iframeWin1, and get the response by `.then`
MessageHub.emit(iframeWin1, "fib", 10).then(resp => {
  console.log("fibonacci of 10 is", resp)
})

// sending a message not handled by the peer  will catch an error
MessageHub.emit(iframeWin1, "some-not-existing-method").then(resp => {
  console.log('response', resp) // this won't run
}).catch(err => {
  console.warn('error', err) // bang!
})
```

in iframe window

```js
import MessageHub from "@evecalm/messagehub"
const peerWin = window.parent


// send message to the parent and get its response
MessageHub.emit(peerWin, "pageTitle").then(title => {
  console.log("page title of main thread", title)
})

// create a dedicated message hub, so we won't need to pass `peerWin` every time
const messageHub = MessageHub.createDedicatedMessageHub(peerWin)

// send message to the parent, don't need the response
messageHub.emit("notice", 'Jim', 'hello!')

// calc fibonacci, return the result to parent
messageHub.on("fib", num => {
  return fib(num)
});
// listen multi message by passing a handler map
messageHub.on({
  method1 () {},
  method2 () {},
})

// use a recursion algorithm which will take more than half a minute when n big than 50
function fib(n) {
  if (n < 2) return n
  return fib(n - 1) + fib(n - 2)
}
```

To see a real world example, you may:

1.  clone [this repo](https://github.com/evecalm/messagehub)
2.  check the code in folder `test`
3.  run `yarn` to install the project dependences
4.  run `yarn run dev` to view the sample
5.  navigate to <http://localhost:1234/worker/index.html> to see worker example
6.  navigate to <http://localhost:1234/frame/index.html> to see iframe example

## API

### MessageHub.emit(peer: Window | Worker, methodName: string, ...args: any[])
send message to peer, invoking `methodName` and all its arguments `args`.

this api return a promise, you can get response or catch the exception via it.

### MessageHub.on
listen message send from peer, it has following forms:
```ts
MessageHub.on(peer: Window | Worker | '*', methodName: string, handler: Function)
MessageHub.on(peer: Window | Worker | '*', handlerMap: Record<string, Function>)
MessageHub.on(peer: Window | Worker | '*', singleHandler: Function)
```

### MessageHub.off(peer: Window | Worker | '*', methodName?: string)
remove message listener. if `methodName` presented, remove `methodName`'s listener, or remove the whole peer's listener

### MessageHub.createDedicatedMessageHub(peer?: Window | Worker)
create a dedicated message-hub for specified peer, so that you won't need to pass peer every time. 

It return a new messageHub with following properties:
```ts
{
  /** if you didn't set a peer when invoking createDedicatedMessageHub, then you can use `setPeer` to set it when it's ready*/
  setPeer: (peer: Window | Worker) => void;
  emit: (methodName: string, ...args: any[]) => any;
  on: (methodName: string, handler: Function) => void;
  on: (handlerMap: Record<string, Function>) => void;
  off: (methodName?: string) => any;
}
```

### MessageHub.createProxyFor(peer: Window | Worker)
forward all messages from peer to parent window then forward parent's response to the peer, instead of handle messages by self