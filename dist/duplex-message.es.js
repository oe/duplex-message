/*!
 * duplex-message
 * Copyright© 2021 Saiya https://github.com/oe/duplex-message
 */
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
    async onRequest(target, reqMsg) {
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
            const data = await method.apply(null, args);
            return this.buildRespMessage(data, reqMsg, true);
        }
        catch (error) {
            throw this.buildRespMessage(error, reqMsg, false);
        }
    }
    _emit(target, methodName, ...args) {
        const msg = this.buildReqMessage(methodName, args);
        this.sendMessage(target, msg);
        return new Promise((resolve, reject) => {
            const callback = (response) => {
                if (!this.isResponse(msg, response))
                    return false;
                response.isSuccess ? resolve(response.data) : reject(response.data);
                return true;
            };
            this.listenResponse(target, msg, callback);
        });
    }
    sendMessage(target, msg) {
        throw new Error('you need to implements sendMessage in your own class');
    }
    listenResponse(target, reqMsg, callback) {
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
            // (reqMsg.toInstance && reqMsg.toInstance !== this.instanceID) &&
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
    emit(peer, methodName, ...args) {
        return this._emit(peer, methodName, args);
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
    async onMessageReceived(evt) {
        const data = evt.data;
        if (!this.isRequest(data))
            return;
        const target = evt.source || evt.currentTarget || WIN;
        let response;
        try {
            response = await this.onRequest(target, data);
        }
        catch (error) {
            response = error;
        }
        this.sendMessage(target, response);
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
        this.responseCallbacks = [];
        this.onMessageReceived = this.onMessageReceived.bind(this);
        window.addEventListener('storage', this.onMessageReceived);
    }
    on(handlerMap, handler) {
        // @ts-ignore
        super.on('*', handlerMap, handler);
    }
    emit(method, ...args) {
        return super._emit('*', method, ...args);
    }
    off() {
        super.off('*');
    }
    async onMessageReceived(evt) {
        const msg = this.getMsgFromEvent(evt);
        if (!msg)
            return;
        if (!this.isRequest(msg)) {
            const idx = this.responseCallbacks.findIndex(fn => fn(msg));
            if (idx >= 0)
                this.responseCallbacks.splice(idx, 1);
            return;
        }
        // clear storage
        setTimeout(() => {
            if (localStorage.getItem(evt.key) === null)
                return;
            localStorage.removeItem(evt.key);
        }, 100 + Math.floor(1000 * Math.random()));
        let response;
        try {
            response = await this.onRequest('*', msg);
        }
        catch (error) {
            response = error;
        }
        this.sendMessage('*', response);
    }
    sendMessage(target, msg) {
        const msgKey = getMsgKey(msg);
        localStorage.setItem(msgKey, JSON.stringify(msg));
    }
    listenResponse(target, reqMsg, callback) {
        // callback handled via onMessageReceived
        const evtCallback = (msg) => {
            if (!callback(msg))
                return false;
            localStorage.removeItem(getMsgKey(msg));
            return true;
        };
        this.responseCallbacks.push(evtCallback);
    }
    getMsgFromEvent(evt) {
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
}
function getMsgKey(msg) {
    return `$$msghub-${msg.type}-${msg.fromInstance}-${msg.toInstance || ''}-${msg.messageID}`;
}

class PageScriptMessageHub extends AbstractHub {
    constructor(customEventName = 'message-hub') {
        // tslint:disable-next-line
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
            throw new Error('StorageMessageHub only available in normal browser context, nodejs/worker are not supported');
        }
        super();
        this.customEventName = customEventName;
        this.responseCallbacks = [];
        this.onMessageReceived = this.onMessageReceived.bind(this);
        // @ts-ignore
        window.addEventListener(customEventName, this.onMessageReceived);
    }
    on(handlerMap, handler) {
        // @ts-ignore
        super.on('*', handlerMap, handler);
    }
    emit(method, ...args) {
        return super._emit('*', method, ...args);
    }
    off() {
        super.off('*');
    }
    async onMessageReceived(evt) {
        const msg = evt.detail;
        if (!msg)
            return;
        if (!this.isRequest(msg)) {
            const idx = this.responseCallbacks.findIndex(fn => fn(msg));
            if (idx >= 0)
                this.responseCallbacks.splice(idx, 1);
            return;
        }
        let response;
        try {
            response = await this.onRequest('*', msg);
        }
        catch (error) {
            response = error;
        }
        this.sendMessage('*', response);
    }
    sendMessage(target, msg) {
        const evt = new CustomEvent(this.customEventName, { detail: msg });
        window.dispatchEvent(evt);
    }
    listenResponse(target, reqMsg, callback) {
        this.responseCallbacks.push(callback);
    }
}

export { AbstractHub, PageScriptMessageHub, PostMessageHub, StorageMessageHub };
