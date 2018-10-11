<h1 align="center">MessageHub</h1>

<h5 align="center">A middleware based RPC library over `postMessage` can work with both web worker and iframe</h5>
<div align="center">
  <a href="https://travis-ci.org/evecalm/messagehub">
    <img src="https://travis-ci.org/evecalm/messagehub.svg?branch=master" alt="Travis CI">
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

This is a simple rpc library that enable you communicate between main thread and worker thread or parent page and child iframe in one-way or two-way.

You can use it just like [koa](https://github.com/koajs/koa)(with middleware support) and [koa-router](https://github.com/alexmingoia/koa-router)(with router support)

## Install

There are too many similar package, and it's so hard to pick a pretty package name, so I use [scoped package](https://docs.npmjs.com/misc/scope) :)

```sh
npm install @evecalm/message-hub
```

or

```sh
yarn add @evecalm/message-hub
```

## Example

The following example show you how to use it in webworker

in main thread(aka the normal browser context)

```js
const MessageHub = require("@evecalm/messagehub");
const messageHub = new MessageHub({
  type: "worker",
  // spefic the worker object by param `peer`
  peer: new Worker("./worker.js")
});

// add a global middleware to log all request
messageHub.use((ctx, next) => {
  console.log("request log", ctx.request);
  return next();
});

// use route to handle other side's request, and set ctx.response to reply the request
messageHub.route("pageTitle", ctx => {
  ctx.response = document.title;
});

// recive one way message, no need to reply it
messageHub.on("notice", msg => {
  console.log("notice message from worker", msg);
});

// tell worker to calc fibonacci of 10, and get result in promise
messageHub.fetch("fib", 10).then(resp => {
  console.log("fibonacci of 10 is", resp);
});

// send worker a message without message data, no care about the response
messageHub.emit("hi");
```

in worker thread

```js
const MessageHub = require("@evecalm/messagehub");
const messageHub = new MessageHub({
  type: "worker"
});

// get data from main thread
messageHub.fetch("pageTitle").then(title => {
  console.log("page title of main thread", title);
});

// send one way message, not care about the response
messageHub.emit("notice", { msg: "balala" });

// recieve one way message, no need to response it
messageHub.on("hi", () => {
  console.log("main thread say hi :(");
});

// calc fibonacci, read request data from ctx.request, response it by setting result to ctx.request
messageHub.route("fib", ctx => {
  ctx.response = fib(ctx.request);
});

// use a recursion algorithm which will take more than half a minute when n big than 50
function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}
```

To see a real world example, you may:

1.  clone [this repo](https://github.com/evecalm/messagehub)
2.  check the code in folder `test`
3.  run `yarn` to install the project dependences
4.  run `yarn run dev` to view the sample
5.  navigate to <http://localhost:1234/worker/index.html> to see worker example
6.  navigate to <http://localhost:1234/frame/index.html> to see iframe example

## Usage

To be continued
