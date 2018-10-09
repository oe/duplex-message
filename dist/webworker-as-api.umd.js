/*!
 * webworker-as-api v0.0.1
 * Copyright© 2018 Saiya https://evecalm.com/
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('composie')) :
  typeof define === 'function' && define.amd ? define(['composie'], factory) :
  (global.WorkerServer = factory(global.Composie));
}(this, (function (Composie) { 'use strict';

  Composie = Composie && Composie.hasOwnProperty('default') ? Composie['default'] : Composie;

  // @ts-ignore
  const glb = self;
  /**
   * Worker Server Class
   */
  class WorkerServer {
      /** */
      constructor(src) {
          // request count, to store  promise pair
          this.count = 0;
          // event callbacks map
          this.evtsCbs = {};
          // promise pair map
          this.promisePairs = {};
          this.composie = new Composie();
          //  detect is this code run in webworker context
          // tslint:disable-next-line
          const isWoker = typeof document === 'undefined';
          if (isWoker) {
              this.worker = glb;
          }
          else {
              if (!src) {
                  throw new Error('a src for worker script is required');
              }
              this.worker = new Worker(src);
          }
          this.onMessage = this.onMessage.bind(this);
          this.worker.addEventListener('message', this.onMessage);
      }
      /**
       * add global middleware
       * @param cb middleware
       */
      use(cb) {
          this.composie.use(cb);
          return this;
      }
      route(routers, ...cbs) {
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
      /**
       * create context used by middleware
       * @param evt message event
       */
      createContext(evt) {
          const request = evt.data;
          console.warn('evt', evt);
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
          const request = evt.data;
          if (request.id) {
              if (request.type === 'response') {
                  const promisePair = this.promisePairs[request.id];
                  if (!promisePair) {
                      console.warn('unowned message with id', request.id);
                      return;
                  }
                  const fn = promisePair[request.resolved ? 0 : 1];
                  fn(request.data);
              }
              else {
                  const ctx = this.createContext(evt);
                  this.composie.run(ctx).then(() => {
                      const message = {
                          resolved: true,
                          id: ctx.id,
                          channel: ctx.channel,
                          type: 'response',
                          data: ctx.response
                      };
                      this.postMessage(message);
                  }, (error) => {
                      const message = {
                          resolved: false,
                          id: ctx.id,
                          channel: ctx.channel,
                          type: 'response',
                          data: ctx.response
                      };
                      this.postMessage(message);
                  });
              }
          }
          else {
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
      /**
       * send message to the other side
       * @param message meesage object to send
       * @param needResp whether need response from other side
       */
      postMessage(message, needResp) {
          const requestData = [message];
          if (message.type === 'request') {
              message.id = needResp ? (++this.count) : 0;
              const transfers = message.transfers;
              delete message.transfers;
              if (transfers)
                  requestData.push(transfers);
          }
          this.worker.postMessage(...requestData);
          if (message.type === 'response' || !message.id)
              return;
          return new Promise((resolve, reject) => {
              this.promisePairs[message.id] = [resolve, reject];
          });
      }
  }

  return WorkerServer;

})));
