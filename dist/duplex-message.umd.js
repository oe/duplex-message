/*!
 * duplex-message
 * Copyright© 2021 Saiya https://github.com/oe/duplex-message
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.DuplexMessage = {}));
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
        /**
         * init Hub, subclass should implement its own constructor
         */
        constructor() {
            this.instanceID = AbstractHub.generateInstanceID();
            this._eventHandlerMap = [];
            this._messageID = 0;
        }
        _hasListeners() {
            return this._eventHandlerMap.length > 0;
        }
        _on(target, handlerMap, handler) {
            const pair = this._eventHandlerMap.find(pair => pair[0] === target);
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
            this._eventHandlerMap[target === '*' ? 'unshift' : 'push']([target, handlerResult]);
        }
        _off(target, methodName) {
            const index = this._eventHandlerMap.findIndex(pair => pair[0] === target);
            if (index === -1)
                return;
            if (!methodName) {
                this._eventHandlerMap.splice(index, 1);
                return;
            }
            const handlerMap = this._eventHandlerMap[index][1];
            if (typeof handlerMap === 'object') {
                delete handlerMap[methodName];
                // nothing left
                if (!Object.keys(handlerMap).length) {
                    this._eventHandlerMap.splice(index, 1);
                }
            }
        }
        onRequest(target, reqMsg) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const matchedMap = this._eventHandlerMap.find(wm => wm[0] === target) || this._eventHandlerMap[0];
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
                    return this._buildRespMessage(data, reqMsg, true);
                }
                catch (error) {
                    throw this._buildRespMessage(error, reqMsg, false);
                }
            });
        }
        _emit(target, methodName, ...args) {
            const msg = this._buildReqMessage(methodName, args);
            this.sendMessage(target, msg);
            return new Promise((resolve, reject) => {
                const callback = (response) => {
                    if (!this._isResponse(msg, response))
                        return false;
                    response.isSuccess ? resolve(response.data) : reject(response.data);
                    return true;
                };
                this.listenResponse(target, msg, callback);
            });
        }
        _buildReqMessage(methodName, args) {
            return AbstractHub.buildReqMsg(this.instanceID, ++this._messageID, methodName, args);
        }
        _buildRespMessage(data, reqMsg, isSuccess) {
            return AbstractHub.buildRespMsg(this.instanceID, data, reqMsg, isSuccess);
        }
        _isRequest(reqMsg) {
            return Boolean(reqMsg && reqMsg.fromInstance &&
                reqMsg.fromInstance !== this.instanceID &&
                (!reqMsg.toInstance || (reqMsg.toInstance === this.instanceID)) &&
                reqMsg.messageID && reqMsg.type === 'request');
        }
        _isResponse(reqMsg, respMsg) {
            return reqMsg && reqMsg &&
                respMsg.toInstance === this.instanceID &&
                respMsg.toInstance === reqMsg.fromInstance &&
                respMsg.messageID === reqMsg.messageID &&
                respMsg.type === 'response';
        }
        static generateInstanceID() {
            return Math.random().toString(36).slice(2);
        }
        static buildReqMsg(instanceID, messageID, methodName, args, toInstance) {
            return {
                fromInstance: instanceID,
                toInstance,
                messageID: messageID,
                type: 'request',
                methodName,
                args
            };
        }
        static buildRespMsg(instanceID, data, reqMsg, isSuccess) {
            return {
                fromInstance: instanceID,
                toInstance: reqMsg.fromInstance,
                messageID: reqMsg.messageID,
                type: 'response',
                isSuccess,
                data
            };
        }
    }

    // save current window it's self
    const WIN = self;
    // tslint:disable-next-line
    const isWorker = typeof document === 'undefined';
    class PostMessageHub extends AbstractHub {
        constructor() {
            super();
            this._hostedWorkers = [];
            this._onMessageReceived = this._onMessageReceived.bind(this);
            this.proxyMessage = this.proxyMessage.bind(this);
            WIN.addEventListener('message', this._onMessageReceived);
        }
        on(target, handlerMap, handler) {
            // @ts-ignore
            super._on(target, handlerMap, handler);
            if (target instanceof Worker && !this._hostedWorkers.includes(target)) {
                this._hostedWorkers.push(target);
                target.addEventListener('message', this._onMessageReceived);
            }
        }
        emit(peer, methodName, ...args) {
            return this._emit(peer, methodName, args);
        }
        off(target, methodName) {
            super._off(target, methodName);
            if (target instanceof Worker) {
                target.removeEventListener('message', this._onMessageReceived);
                const idx = this._hostedWorkers.indexOf(target);
                idx > -1 && this._hostedWorkers.splice(idx, 1);
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
                const matchedMap = this._eventHandlerMap.find(wm => wm[0] === ownPeer);
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
        _onMessageReceived(evt) {
            return __awaiter(this, void 0, void 0, function* () {
                const data = evt.data;
                if (!this._isRequest(data))
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
        listenResponse(target, reqMsg, callback) {
            const win = (isWorker || !(target instanceof Worker)) ? WIN : target;
            const evtCallback = (evt) => {
                if (!callback(evt.data))
                    return;
                // @ts-ignore
                win.removeEventListener('message', evtCallback);
            };
            // @ts-ignore
            win.addEventListener('message', evtCallback);
        }
    }

    class StorageMessageHub extends AbstractHub {
        constructor() {
            // tslint:disable-next-line
            if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
                throw new Error('StorageMessageHub only available in normal browser context, nodejs/worker are not supported');
            }
            super();
            this._responseCallbacks = [];
            this._onMessageReceived = this._onMessageReceived.bind(this);
            this._responseTimeout = 200;
            this._isEventAttached = false;
        }
        on(handlerMap, handler) {
            // @ts-ignore
            super._on('*', handlerMap, handler);
            if (this._isEventAttached)
                return;
            window.addEventListener('storage', this._onMessageReceived);
            this._isEventAttached = true;
        }
        emit(methodName, ...args) {
            return super._emit('*', methodName, ...args);
        }
        off(methodName) {
            super._off('*', methodName);
            if (!this._hasListeners() || (methodName && this._isEventAttached)) {
                window.removeEventListener('storage', this._onMessageReceived);
                this._isEventAttached = false;
            }
        }
        sendMessage(target, msg) {
            const msgKey = StorageMessageHub._getMsgKey(msg);
            localStorage.setItem(msgKey, JSON.stringify(msg));
        }
        listenResponse(target, reqMsg, callback) {
            let hasResp = false;
            const msgs = [];
            let allMsgReceived = false;
            let tid = 0;
            // callback handled via onMessageReceived
            const evtCallback = (msg) => {
                {
                    if (!this._isResponse(reqMsg, msg))
                        return 0;
                    if (allMsgReceived) {
                        callback(msg);
                        return 1;
                    }
                    msgs.push(msg.data);
                    clearTimeout(tid);
                    // @ts-ignore
                    tid = setTimeout(() => {
                        allMsgReceived = true;
                        const resp = this._buildRespMessage(msgs, reqMsg, true);
                        console.warn('response', resp);
                        this._runResponseCallback(resp);
                    }, this._responseTimeout);
                }
                hasResp = true;
                localStorage.removeItem(StorageMessageHub._getMsgKey(msg));
                return  2 ;
            };
            this._responseCallbacks.push(evtCallback);
            // timeout when no response, callback get a failure
            setTimeout(() => {
                if (hasResp)
                    return;
                const resp = this._buildRespMessage({ message: 'timeout' }, reqMsg, false);
                this._runResponseCallback(resp);
            }, this._responseTimeout);
        }
        _runResponseCallback(resp) {
            let mc = 0;
            const idx = this._responseCallbacks.findIndex(fn => {
                mc = fn(resp);
                return Boolean(mc);
            });
            if (idx >= 0) {
                if (mc > 1)
                    return;
                this._responseCallbacks.splice(idx, 1);
            }
            else {
                // clean unhandled responses
                if (resp.toInstance === this.instanceID && resp.type === 'response') {
                    localStorage.removeItem(StorageMessageHub._getMsgKey(resp));
                }
            }
        }
        _onMessageReceived(evt) {
            return __awaiter(this, void 0, void 0, function* () {
                console.warn('storage event', evt);
                const msg = StorageMessageHub._getMsgFromEvent(evt);
                if (!msg)
                    return;
                if (!this._isRequest(msg)) {
                    this._runResponseCallback(msg);
                    return;
                }
                // clear received message after proceeded
                setTimeout(() => {
                    if (localStorage.getItem(evt.key) === null)
                        return;
                    localStorage.removeItem(evt.key);
                }, 100 + Math.floor(1000 * Math.random()));
                let response;
                try {
                    response = yield this.onRequest('*', msg);
                }
                catch (error) {
                    response = error;
                }
                this.sendMessage('*', response);
            });
        }
        static _getMsgFromEvent(evt) {
            if (!evt.key || !/^\$\$msghub\-/.test(evt.key) || !evt.newValue)
                return;
            let msg;
            try {
                msg = JSON.parse(evt.newValue);
            }
            catch (error) {
                return;
            }
            return msg;
        }
        static _getMsgKey(msg) {
            return `$$msghub-${msg.type}-${msg.fromInstance}-${msg.toInstance || ''}-${msg.messageID}`;
        }
    }

    class PageScriptMessageHub extends AbstractHub {
        constructor(customEventName = 'message-hub') {
            // tslint:disable-next-line
            if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
                throw new Error('StorageMessageHub only available in normal browser context, nodejs/worker are not supported');
            }
            super();
            this._customEventName = customEventName;
            this._responseCallbacks = [];
            this._onMessageReceived = this._onMessageReceived.bind(this);
            this._isEventAttached = false;
        }
        on(handlerMap, handler) {
            // @ts-ignore
            super._on('*', handlerMap, handler);
            if (this._isEventAttached)
                return;
            // @ts-ignore
            window.addEventListener(this._customEventName, this._onMessageReceived);
        }
        emit(method, ...args) {
            return super._emit('*', method, ...args);
        }
        off(methodName) {
            super._off('*', methodName);
            if (!this._hasListeners() || (!methodName && this._isEventAttached)) {
                // @ts-ignore
                window.removeEventListener(this._customEventName, this._onMessageReceived);
                this._isEventAttached = false;
            }
        }
        _onMessageReceived(evt) {
            return __awaiter(this, void 0, void 0, function* () {
                const msg = evt.detail;
                if (!msg)
                    return;
                if (!this._isRequest(msg)) {
                    const idx = this._responseCallbacks.findIndex(fn => fn(msg));
                    if (idx >= 0)
                        this._responseCallbacks.splice(idx, 1);
                    return;
                }
                let response;
                try {
                    response = yield this.onRequest('*', msg);
                }
                catch (error) {
                    response = error;
                }
                this.sendMessage('*', response);
            });
        }
        sendMessage(target, msg) {
            const evt = new CustomEvent(this._customEventName, { detail: msg });
            window.dispatchEvent(evt);
        }
        listenResponse(target, reqMsg, callback) {
            this._responseCallbacks.push(callback);
        }
    }

    exports.AbstractHub = AbstractHub;
    exports.PageScriptMessageHub = PageScriptMessageHub;
    exports.PostMessageHub = PostMessageHub;
    exports.StorageMessageHub = StorageMessageHub;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
