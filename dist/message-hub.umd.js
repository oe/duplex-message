/*!
 * @evecalm/message-hub v0.0.7
 * Copyright© 2018 Saiya https://evecalm.com/
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('composie')) :
  typeof define === 'function' && define.amd ? define(['composie'], factory) :
  (global.MessageHub = factory(global.Composie));
}(this, (function (Composie) { 'use strict';

  Composie = Composie && Composie.hasOwnProperty('default') ? Composie['default'] : Composie;

  const READY_CONFIG = {
      channel: 'THIS_IS_MESSAGE_SECRET_CHANNEL',
      id: -1
  };
  /**
   * MessageHub Class
   */
  class MessageHub {
      constructor(options) {
          // request count, to store  promise pair
          this.count = 0;
          // if type is worker, whether is in worker
          this.isWorker = false;
          // if type is frame, target origin, default any origin
          this.targetOrigin = '*';
          // event callbacks map
          this.evtsCbs = {};
          // promise pair map
          this.promisePairs = {};
          // is peer ready
          this.isReady = false;
          this.composie = new Composie();
          this.context = self;
          this.type = options.type;
          if (options.type === 'worker') {
              this.isReady = true;
              //  detect is this code run in webworker context
              // tslint:disable-next-line
              this.isWorker = typeof document === 'undefined';
              if (this.isWorker) {
                  this.peer = self;
              }
              else {
                  if (!options.peer) {
                      throw new Error('a worker instance is required');
                  }
                  this.peer = options.peer;
                  this.context = options.peer;
              }
          }
          else if (options.type === 'frame') {
              this.peer = options.peer;
              if (options.targetOrigin)
                  this.targetOrigin = options.targetOrigin;
          }
          else {
              // @ts-ignore
              throw new Error(`unsupported type ${options.type}`);
          }
          this.onMessage = this.onMessage.bind(this);
          this.context.addEventListener('message', this.onMessage);
          if (!this.isReady)
              this.emit(READY_CONFIG.channel);
      }
      /**
       * wait for peer ready
       *  use it especially work with iframe
       * return a promise
       */
      ready() {
          if (!this.context)
              return Promise.reject(new Error('This MessageHub instance has been destroyed'));
          if (this.isReady)
              return Promise.resolve(this);
          return new Promise((resolve, reject) => {
              this.fetch(READY_CONFIG.channel).then(() => {
                  this.isReady = true;
                  resolve(this);
              }, reject);
          });
      }
      /**
       * add global middleware
       * @param cb middleware
       */
      use(cb) {
          if (this.composie)
              this.composie.use(cb);
          return this;
      }
      route(routers, ...cbs) {
          if (!this.composie)
              return this;
          if (typeof routers === 'string') {
              this.composie.route(routers, ...cbs);
          }
          else {
              this.composie.route(routers);
          }
          return this;
      }
      /**
       * request other side for a response
       * @param channel channel name
       * @param data params to the channel
       * @param transfers object array want to transfer
       */
      fetch(channel, data, transfers) {
          const msg = {
              type: 'request',
              channel,
              data,
              transfers
          };
          return this.postMessage(msg, true);
      }
      /**
       * listen event from other side
       * @param channel channel name
       * @param cb callback function
       */
      on(channel, cb) {
          if (!this.evtsCbs[channel]) {
              this.evtsCbs[channel] = [];
          }
          this.evtsCbs[channel].push(cb);
      }
      /**
       * remove event listener
       * @param channel channel name
       * @param cb callback function
       */
      off(channel, cb) {
          if (!this.evtsCbs[channel] || !this.evtsCbs[channel].length)
              return;
          if (!cb) {
              this.evtsCbs[channel] = [];
              return;
          }
          const cbs = this.evtsCbs[channel];
          let len = cbs.length;
          while (len--) {
              if (cbs[len] === cb) {
                  cbs.splice(len, 1);
                  break;
              }
          }
      }
      /**
       * emit event that will be listened from on
       * @param channel channel name
       * @param data params
       * @param transfers object array want to transfer
       */
      emit(channel, data, transfers) {
          const msg = {
              type: 'request',
              channel,
              data,
              transfers
          };
          this.postMessage(msg, false);
      }
      destroy() {
          if (!this.context)
              return;
          this.context.removeEventListener('message', this.onMessage);
          this.evtsCbs = {};
          this.composie = null;
          if (this.type === 'worker') {
              if (this.isWorker) {
                  this.context.close();
              }
              else {
                  this.context.terminate();
              }
          }
          this.context = null;
          this.peer = null;
      }
      /**
       * create context used by middleware
       * @param evt message event
       */
      createContext(evt) {
          const request = evt.data;
          const context = {
              id: request.id,
              type: 'request',
              channel: request.channel,
              request: request.data,
              event: evt
          };
          return context;
      }
      /**
       * listen original message event
       * @param evt message event
       */
      onMessage(evt) {
          // ignore untargeted cross iframe origin message
          if (this.type === 'frame' &&
              // message from self or origin not match
              ((evt.source && evt.source !== this.peer) || !this.isValidateOrigin(evt.origin)))
              return;
          const request = evt.data;
          // ignore any other noises(not from MessageHub)
          if (!request || !this.composie || !request.channel)
              return;
          if (request.id) {
              if (request.type === 'response') {
                  this.resolveFetch(request);
              }
              else {
                  const ctx = this.createContext(evt);
                  // try to handle ready request
                  if (this.resolveFetch(request)) {
                      this.respond(ctx, true);
                      return;
                  }
                  this.composie.run(ctx).then(() => {
                      this.respond(ctx, true);
                  }, (error) => {
                      console.warn('run middleware failed', error);
                      this.respond(ctx, false);
                  });
              }
          }
          else {
              // try handle ready 
              if (this.resolveFetch(request))
                  return;
              const cbs = this.evtsCbs[request.channel];
              if (!cbs || !cbs.length) {
                  console.warn(`no corresponed callback for ${request.channel}`);
                  return;
              }
              for (let index = 0; index < cbs.length; index++) {
                  const cb = cbs[index];
                  if (cb(request.data) === false)
                      break;
              }
          }
      }
      /** respond fetch request */
      respond(ctx, resolved) {
          const message = {
              resolved: resolved,
              id: ctx.id,
              channel: ctx.channel,
              type: 'response',
              data: ctx.response
          };
          this.postMessage(message);
      }
      /** resolve fetch request */
      resolveFetch(msg) {
          if (!msg.id ||
              msg.type === 'request' && msg.id !== READY_CONFIG.id)
              return;
          const msgId = msg.id;
          const promisePair = this.promisePairs[msgId];
          if (!promisePair) {
              if (msg.id === READY_CONFIG.id)
                  return true;
              console.warn('unowned message with id', msgId, msg);
              return;
          }
          // @ts-ignore
          const fn = promisePair[msg.resolved !== false ? 0 : 1];
          fn(msg.data);
          delete this.promisePairs[msgId];
          return true;
      }
      /**
       * validate origin in cross frame communicate is match
       * @param origin origin url
       */
      isValidateOrigin(origin) {
          return this.targetOrigin === '*' || origin === this.targetOrigin;
      }
      /**
       *
       * send message to the other side
       * @param message meesage object to send
       * @param needResp whether need response from other side
       */
      postMessage(message, needResp) {
          const requestData = [message];
          if (this.type === 'frame') {
              requestData.push(this.targetOrigin);
          }
          if (message.type === 'request') {
              // change ready message id
              message.id = message.channel === READY_CONFIG.channel
                  ? READY_CONFIG.id :
                  needResp ?
                      (++this.count) : 0;
              const transfers = message.transfers;
              delete message.transfers;
              if (transfers)
                  requestData.push(transfers);
          }
          this.peer.postMessage(...requestData);
          if (message.type === 'response' || !message.id)
              return;
          return new Promise((resolve, reject) => {
              this.promisePairs[message.id] = [resolve, reject];
          });
      }
  }

  return MessageHub;

})));
