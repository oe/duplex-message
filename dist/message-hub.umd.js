/*!
 * @evecalm/message-hub v1.1.2
 * Copyright© 2021 Saiya https://github.com/oe/messagehub
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.MessageHub = {}));
}(this, (function (exports) { 'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    class AbstractHub {
        constructor() {
            this.instanceID = AbstractHub.generateInstanceID();
            this.eventHandlerMap = [['*', {}]];
            this.messageID = 0;
        }
        static generateInstanceID() {
            return Math.random().toString(36).slice(2);
        }
        on(target, handlerMap, handler) {
            const pair = this.eventHandlerMap.find(pair => pair[0] === target);
            let handlerResult;
            if (typeof handlerMap === 'string') {
                handlerResult = { [handlerMap]: handler };
            }
            else {
                handlerResult = handlerMap;
            }
            if (pair) {
                const existingMap = pair[1];
                // merge existing handler map
                // @ts-ignore
                pair[1] = typeof existingMap === 'function' ?
                    handlerResult : typeof handlerResult === 'function' ?
                    handlerResult : Object.assign({}, existingMap, handlerResult);
                return;
            }
            this.eventHandlerMap[target === '*' ? 'unshift' : 'push']([target, handlerResult]);
        }
        off(target) {
            const index = this.eventHandlerMap.findIndex(pair => pair[0] === target);
            if (index !== -1) {
                if (target === '*') {
                    // clear * (general) handler, instead of remove it
                    this.eventHandlerMap[index][1] = {};
                }
                else {
                    this.eventHandlerMap.splice(index, 1);
                }
            }
        }
        onRequest(target, reqMsg) {
            return __awaiter(this, void 0, void 0, function* () {
                // if (!this.isRequest(reqMsg)) return
                try {
                    const matchedMap = this.eventHandlerMap.find(wm => wm[0] === target) || this.eventHandlerMap[0];
                    const { methodName, args } = reqMsg;
                    const handlerMap = matchedMap && matchedMap[1];
                    // handler map could be a function
                    let method;
                    if (typeof handlerMap === 'function') {
                        method = handlerMap;
                        // add methodName as the first argument if handlerMap is a function
                        args.unshift(methodName);
                    }
                    else {
                        method = handlerMap && handlerMap[methodName];
                    }
                    // tslint:disable-next-line
                    if (typeof method !== 'function') {
                        console.warn(`[MessageHub] no corresponding handler found for ${methodName}, message from`, target);
                        throw new Error(`[MessageHub] no corresponding handler found for ${methodName}`);
                    }
                    const data = yield method.apply(null, args);
                    return this.buildRespMessage(data, reqMsg, true);
                }
                catch (error) {
                    throw this.buildRespMessage(error, reqMsg, false);
                }
            });
        }
        emit(target, methodName, ...args) {
            const msg = this.buildReqMessage(methodName, args);
            this.sendMessage(target, msg);
            return new Promise((resolve, reject) => {
                const callback = (response) => {
                    if (!this.isResponse(msg, response))
                        return;
                    response.isSuccess ? resolve(response.data) : reject(response.data);
                };
                this.onResponse(target, msg, callback);
            });
        }
        sendMessage(target, msg) {
            throw new Error('you need to implements sendMessage in your own class');
        }
        onResponse(target, reqMsg, callback) {
            throw new Error('you need to implements onMessageReceived in your own class');
        }
        buildReqMessage(methodName, args) {
            return buildReqMsg(this.instanceID, ++this.messageID, methodName, args);
        }
        buildRespMessage(data, reqMsg, isSuccess) {
            return buildRespMsg(this.instanceID, data, reqMsg, isSuccess);
        }
        isRequest(reqMsg) {
            return Boolean(reqMsg && reqMsg.fromInstance &&
                reqMsg.fromInstance !== this.instanceID &&
                (reqMsg.toInstance && reqMsg.toInstance !== this.instanceID) &&
                reqMsg.messageID && reqMsg.type === 'request');
        }
        isResponse(reqMsg, respMsg) {
            return reqMsg && reqMsg &&
                respMsg.toInstance === this.instanceID &&
                respMsg.toInstance === reqMsg.fromInstance &&
                respMsg.messageID === reqMsg.messageID &&
                respMsg.type === 'response';
        }
    }
    function buildReqMsg(instanceID, messageID, methodName, args, toInstance) {
        return {
            fromInstance: instanceID,
            toInstance,
            messageID: messageID,
            type: 'request',
            methodName,
            args
        };
    }
    function buildRespMsg(instanceID, data, reqMsg, isSuccess) {
        return {
            fromInstance: instanceID,
            toInstance: reqMsg.fromInstance,
            messageID: reqMsg.messageID,
            type: 'response',
            isSuccess,
            data
        };
    }

    // save current window it's self
    const WIN = self;
    // tslint:disable-next-line
    const isWorker = typeof document === 'undefined';
    const hostedWorkers = [];
    class PostMessageHub extends AbstractHub {
        constructor() {
            super();
            this.onMessageReceived = this.onMessageReceived.bind(this);
            this.proxyMessage = this.proxyMessage.bind(this);
            WIN.addEventListener('message', this.onMessageReceived);
        }
        on(target, handlerMap, handler) {
            // @ts-ignore
            super.on(target, handlerMap, handler);
            if (target instanceof Worker && !hostedWorkers.includes(target)) {
                hostedWorkers.push(target);
                target.addEventListener('message', this.onMessageReceived);
            }
        }
        off(target) {
            super.off(target);
            if (target instanceof Worker) {
                target.removeEventListener('message', this.onMessageReceived);
                const idx = hostedWorkers.indexOf(target);
                idx > -1 && hostedWorkers.splice(idx, 1);
            }
        }
        /**
         * create a dedicated MessageHub that focus on communicate with the specified peer
         * @param peer peer window to communicate with, or you can set it later via `setPeer`
         */
        createDedicatedMessageHub(peer) {
            let ownPeer = peer;
            const checkPeer = () => {
                if (!ownPeer)
                    throw new Error('peer is not set in dedicated message-hub');
            };
            /**
             * set peer that this dedicated message-hub want communicate with
             * @param peer if using in Worker thread, set peer to `self`
             */
            const setPeer = (peer) => { ownPeer = peer; };
            /**
             * listen method invoking from peer
             * @param methodName method name or handler map
             * @param handler omit if methodName is handler map
             */
            const on = (methodName, handler) => {
                checkPeer();
                const handlerMap = typeof methodName === 'string' ? { [methodName]: handler } : methodName;
                // @ts-ignore
                this.on(ownPeer, handlerMap);
            };
            /**
             * call method and pass reset arguments to the peer
             * @param methodName
             * @param args
             */
            const emit = (methodName, ...args) => {
                checkPeer();
                // @ts-ignore
                return this.emit(ownPeer, methodName, ...args);
            };
            /**
             * remove method from messageHub. remove all listeners if methodName not presented
             * @param methodName method meed to remove
             */
            const off = (methodName) => {
                checkPeer();
                // @ts-ignore
                if (!methodName)
                    return this.off(ownPeer);
                const matchedMap = this.eventHandlerMap.find(wm => wm[0] === ownPeer);
                if (matchedMap) {
                    delete matchedMap[methodName];
                }
            };
            return { setPeer, emit, on, off };
        }
        /**
         * forward message from `fromWin` to `toWin`
         * @param fromWin message source win
         * @param toWin message target win
         */
        createProxy(fromWin, toWin) {
            if (isWorker)
                throw new Error('[MessageHub] createProxy can only be used in a normal window context');
            if (WIN === fromWin || WIN === toWin || fromWin === toWin) {
                throw new Error('[MessageHub] can not forward message to own');
            }
            this.on(fromWin, this.proxyMessage(toWin));
        }
        proxyMessage(destWin) {
            return (...args) => {
                // @ts-ignore
                return this.emit(destWin, ...args);
            };
        }
        /**
         * proxy all message from peer to parent window
         * @deprecated use createProxy instead
         * @param peer
         */
        createProxyFor(peer) {
            this.createProxy(peer, WIN.parent);
        }
        onMessageReceived(evt) {
            return __awaiter(this, void 0, void 0, function* () {
                const data = evt.data;
                if (!this.isRequest(data))
                    return;
                const target = evt.source || evt.currentTarget || WIN;
                let response;
                try {
                    response = yield this.onRequest(target, data);
                }
                catch (error) {
                    response = error;
                }
                this.sendMessage(target, response);
            });
        }
        sendMessage(peer, msg) {
            const args = [msg];
            // tslint:disable-next-line
            if (typeof Window === 'function' && peer instanceof Window) {
                args.push('*');
            }
            // @ts-ignore
            peer.postMessage(...args);
        }
        onResponse(target, reqMsg, callback) {
            const evtCallback = (evt) => {
                callback(evt.data);
                WIN.removeEventListener('message', evtCallback);
            };
            WIN.addEventListener('message', evtCallback);
        }
    }
    const postMessageHub = new PostMessageHub();

    exports.AbstractHub = AbstractHub;
    exports.postMessageHub = postMessageHub;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
