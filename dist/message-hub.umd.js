/*!
 * @evecalm/message-hub v0.1.3
 * Copyright© 2019 Saiya https://github.com/oe/messagehub
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('composie')) :
  typeof define === 'function' && define.amd ? define(['composie'], factory) :
  (global.MessageHub = factory(global.Composie));
}(this, (function (Composie) { 'use strict';

  Composie = Composie && Composie.hasOwnProperty('default') ? Composie['default'] : Composie;

  var READY_CONFIG = {
      channel: 'THIS_IS_MESSAGE_SECRET_CHANNEL',
      id: -1
  };
  /**
   * MessageHub Class
   */
  var MessageHub = /** @class */ (function () {
      function MessageHub(options) {
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
                      throw new Error('[@evecalm/message-hub]a worker instance is required');
                  }
                  this.peer = options.peer;
                  this.context = options.peer;
              }
          }
          else if (options.type === 'frame') {
              if (!options.peer) {
                  throw new Error('[@evecalm/message-hub]a peer window instance is required');
              }
              if (options.peer === self) {
                  throw new Error('[@evecalm/message-hub] peer is the same of current context(window), use node module `composie` instead for messaging in the same context');
              }
              this.peer = options.peer;
              if (options.targetOrigin)
                  this.targetOrigin = options.targetOrigin;
          }
          else {
              // @ts-ignore
              throw new Error("unsupported type " + options.type);
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
      MessageHub.prototype.ready = function () {
          var _this = this;
          if (!this.context)
              return Promise.reject(new Error('This MessageHub instance has been destroyed'));
          if (this.isReady)
              return Promise.resolve(this);
          return new Promise(function (resolve, reject) {
              _this.fetch(READY_CONFIG.channel).then(function () {
                  _this.isReady = true;
                  resolve(_this);
              }, reject);
          });
      };
      /**
       * add global middleware
       * @param cb middleware
       */
      MessageHub.prototype.use = function (cb) {
          // @ts-ignore
          if (this.composie)
              this.composie.use(cb);
          return this;
      };
      MessageHub.prototype.route = function (routers) {
          var cbs = [];
          for (var _i = 1; _i < arguments.length; _i++) {
              cbs[_i - 1] = arguments[_i];
          }
          var _a;
          if (!this.composie)
              return this;
          if (typeof routers === 'string') {
              // @ts-ignore
              (_a = this.composie).route.apply(_a, [routers].concat(cbs));
          }
          else {
              this.composie.route(routers);
          }
          return this;
      };
      /**
       * request other side for a response
       * @param channel channel name
       * @param data params to the channel
       * @param transfers object array want to transfer
       */
      MessageHub.prototype.fetch = function (channel, data, transfers) {
          var msg = {
              type: 'request',
              channel: channel,
              data: data,
              transfers: transfers
          };
          return this.postMessage(msg, true);
      };
      /**
       * listen event from other side
       * @param channel channel name
       * @param cb callback function
       */
      MessageHub.prototype.on = function (channel, cb) {
          if (!this.evtsCbs[channel]) {
              this.evtsCbs[channel] = [];
          }
          this.evtsCbs[channel].push(cb);
      };
      /**
       * remove event listener
       * @param channel channel name
       * @param cb callback function
       */
      MessageHub.prototype.off = function (channel, cb) {
          if (!this.evtsCbs[channel] || !this.evtsCbs[channel].length)
              return;
          if (!cb) {
              this.evtsCbs[channel] = [];
              return;
          }
          var cbs = this.evtsCbs[channel];
          var len = cbs.length;
          while (len--) {
              if (cbs[len] === cb) {
                  cbs.splice(len, 1);
                  break;
              }
          }
      };
      /**
       * emit event that will be listened from on
       * @param channel channel name
       * @param data params
       * @param transfers object array want to transfer
       */
      MessageHub.prototype.emit = function (channel, data, transfers) {
          var msg = {
              type: 'request',
              channel: channel,
              data: data,
              transfers: transfers
          };
          this.postMessage(msg, false);
      };
      MessageHub.prototype.destroy = function () {
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
      };
      /**
       * create context used by middleware
       * @param evt message event
       */
      MessageHub.prototype.createContext = function (evt) {
          var request = evt.data;
          var context = {
              id: request.id,
              type: 'request',
              channel: request.channel,
              request: request.data,
              event: evt
          };
          return context;
      };
      /**
       * listen original message event
       * @param evt message event
       */
      MessageHub.prototype.onMessage = function (evt) {
          var _this = this;
          // ignore untargeted cross iframe origin message
          if (this.type === 'frame' &&
              // message from self or origin not match
              ((evt.source && evt.source !== this.peer) || !this.isValidateOrigin(evt.origin)))
              return;
          var request = evt.data;
          // ignore any other noises(not from MessageHub)
          if (!request || !this.composie || !request.channel)
              return;
          if (request.id) {
              if (request.type === 'response') {
                  this.resolveFetch(request);
              }
              else {
                  var ctx_1 = this.createContext(evt);
                  // try to handle ready request
                  if (this.resolveFetch(request)) {
                      this.respond(ctx_1, true);
                      return;
                  }
                  this.composie.run(ctx_1).then(function () {
                      _this.respond(ctx_1, true);
                  }, function (error) {
                      console.warn('run middleware failed', error);
                      _this.respond(ctx_1, false);
                  });
              }
          }
          else {
              // try handle ready 
              if (this.resolveFetch(request))
                  return;
              var cbs = this.evtsCbs[request.channel];
              if (!cbs || !cbs.length) {
                  console.warn('no corresponed callback for', request.channel);
                  return;
              }
              for (var index = 0; index < cbs.length; index++) {
                  var cb = cbs[index];
                  if (cb(request.data) === false)
                      break;
              }
          }
      };
      /** respond fetch request */
      MessageHub.prototype.respond = function (ctx, resolved) {
          var message = {
              resolved: resolved,
              id: ctx.id,
              channel: ctx.channel,
              type: 'response',
              data: ctx.response
          };
          this.postMessage(message);
      };
      /** resolve fetch request */
      MessageHub.prototype.resolveFetch = function (msg) {
          if (!msg.id ||
              msg.type === 'request' && msg.id !== READY_CONFIG.id)
              return;
          var msgId = msg.id;
          var promisePair = this.promisePairs[msgId];
          if (!promisePair) {
              if (msg.id === READY_CONFIG.id)
                  return true;
              console.warn('unowned message with id', msgId, msg);
              return;
          }
          // @ts-ignore
          var fn = promisePair[msg.resolved !== false ? 0 : 1];
          fn(msg.data);
          delete this.promisePairs[msgId];
          return true;
      };
      /**
       * validate origin in cross frame communicate is match
       * @param origin origin url
       */
      MessageHub.prototype.isValidateOrigin = function (origin) {
          return this.targetOrigin === '*' || origin === this.targetOrigin;
      };
      /**
       *
       * send message to the other side
       * @param message meesage object to send
       * @param needResp whether need response from other side
       */
      MessageHub.prototype.postMessage = function (message, needResp) {
          var _this = this;
          var _a;
          var requestData = [message];
          if (this.type === 'frame') {
              requestData.push(this.targetOrigin);
          }
          if (message.type === 'request') {
              // change ready message id
              // @ts-ignore
              message.id = message.channel === READY_CONFIG.channel
                  ? READY_CONFIG.id :
                  needResp ?
                      (++this.count) : 0;
              var transfers = message.transfers;
              // @ts-ignore
              delete message.transfers;
              if (transfers)
                  requestData.push(transfers);
          }
          (_a = this.peer).postMessage.apply(_a, requestData);
          if (message.type === 'response' || !message.id)
              return;
          return new Promise(function (resolve, reject) {
              _this.promisePairs[message.id] = [resolve, reject];
          });
      };
      return MessageHub;
  }());

  return MessageHub;

})));
