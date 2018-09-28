/*!
 * webworker-as-api v0.0.1
 * Copyright© 2018 Saiya https://evecalm.com/
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.WorkerServer = factory());
}(this, (function () { 'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation. All rights reserved.
    Licensed under the Apache License, Version 2.0 (the "License"); you may not use
    this file except in compliance with the License. You may obtain a copy of the
    License at http://www.apache.org/licenses/LICENSE-2.0

    THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
    WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
    MERCHANTABLITY OR NON-INFRINGEMENT.

    See the Apache Version 2.0 License for specific language governing permissions
    and limitations under the License.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

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
            // global middlewares
            this.middlewares = [];
            // router map
            this.routers = {};
            // event callbacks map
            this.evtsCbs = {};
            // promise pair map
            this.promisePairs = {};
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
            this.middlewares.push(cb);
        }
        route(routers, ...cbs) {
            if (typeof routers === 'string') {
                routers = {
                    routers: cbs
                };
            }
            Object.keys(routers).forEach((k) => {
                let cbs = routers[k];
                if (!Array.isArray(cbs))
                    cbs = [cbs];
                if (!cbs.length)
                    return;
                if (!this.routers[k]) {
                    this.routers[k] = [];
                }
                this.routers[k].push(...cbs);
            });
        }
        /**
         * request other side for a response
         * @param method method name
         * @param data params to the method
         * @param transfers object array want to transfer
         */
        fetch(method, data, transfers) {
            const msg = {
                type: 'request',
                method,
                data,
                transfers
            };
            return this.postMessage(msg, true);
        }
        /**
         * listen event from other side
         * @param method method name
         * @param cb callback function
         */
        on(method, cb) {
            if (!this.evtsCbs[method]) {
                this.evtsCbs[method] = [];
            }
            this.evtsCbs[method].push(cb);
        }
        /**
         * remove event listener
         * @param method method name
         * @param cb callback function
         */
        off(method, cb) {
            if (!this.evtsCbs[method] || !this.evtsCbs[method].length)
                return;
            if (!cb) {
                this.evtsCbs[method] = [];
                return;
            }
            const cbs = this.evtsCbs[method];
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
         * @param method method name
         * @param data params
         * @param transfers object array want to transfer
         */
        emit(method, data, transfers) {
            const msg = {
                type: 'request',
                method,
                data,
                transfers
            };
            this.postMessage(msg, false);
        }
        /**
         * compose middlewares into one function
         *  copy form https://github.com/koajs/compose/blob/master/index.js
         * @param middlewares middlewares
         */
        composeMiddlewares(middlewares) {
            return function (context, next) {
                // last called middleware #
                let index = -1;
                return dispatch(0);
                function dispatch(i) {
                    if (i <= index)
                        return Promise.reject(new Error('next() called multiple times'));
                    index = i;
                    let fn = middlewares[i];
                    if (i === middlewares.length)
                        fn = next;
                    if (!fn)
                        return Promise.resolve();
                    try {
                        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
                    }
                    catch (err) {
                        return Promise.reject(err);
                    }
                }
            };
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
                method: request.method,
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
            return __awaiter(this, void 0, void 0, function* () {
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
                        const cbs = [...this.middlewares];
                        const routerCbs = this.routers[request.method] || [];
                        cbs.push(...routerCbs);
                        const ctx = this.createContext(evt);
                        let resolved = true;
                        if (cbs.length) {
                            const fnMiddlewars = this.composeMiddlewares(cbs);
                            try {
                                yield fnMiddlewars(ctx);
                            }
                            catch (error) {
                                resolved = false;
                            }
                        }
                        else {
                            console.warn(`no corresponding router for ${request.method}`);
                        }
                        const message = {
                            resolved,
                            id: ctx.id,
                            method: ctx.method,
                            type: 'response',
                            data: ctx.response
                        };
                        this.postMessage(message);
                    }
                }
                else {
                    const cbs = this.evtsCbs[request.method];
                    if (!cbs || !cbs.length) {
                        console.warn(`no corresponed callback for ${request.method}`);
                        return;
                    }
                    for (let index = 0; index < cbs.length; index++) {
                        const cb = cbs[index];
                        if (cb(request.data) === false)
                            break;
                    }
                }
            });
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
