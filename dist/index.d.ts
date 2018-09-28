/** middleware define */
interface IMiddleWare {
    (ctx: any, next: Function): any;
}
/** worker route map */
interface IRouters {
    [k: string]: IMiddleWare[];
}
/** param for route */
interface IRouteParam {
    [k: string]: IMiddleWare[] | IMiddleWare;
}
/** event callback */
interface ICallback {
    (response: any): any;
}
/** event callbacks map */
interface IEvtCallbacks {
    [k: string]: ICallback[];
}
/** message request */
interface IMessageRequest {
    id: number;
    type: 'request';
    method: string;
    data: any;
    event: Event;
    transfers?: any[];
}
/** message response */
interface IMessageResponse {
    id: number;
    type: 'response';
    resolved: boolean;
    method: string;
    data: any;
    event: Event;
}
/** message union */
declare type IMessage = IMessageRequest | IMessageResponse;
/** promise pair to resolve response */
interface IPromisePairs {
    [k: number]: [Function, Function];
}
/** request context for middleware */
interface IContext {
    id: number;
    type: 'request';
    method: string;
    request: any;
    event: Event;
    [k: string]: any;
}
/**
 * Worker Server Class
 */
export default class WorkerServer {
    count: number;
    worker: any;
    middlewares: IMiddleWare[];
    routers: IRouters;
    evtsCbs: IEvtCallbacks;
    promisePairs: IPromisePairs;
    /** */
    constructor(src?: string);
    /**
     * add global middleware
     * @param cb middleware
     */
    use(cb: IMiddleWare): void;
    /**
     * add router
     * @param routers router map
     */
    route(routers: IRouteParam): any;
    /**
     * add router
     * @param method method name
     * @param cbs method handlers
     */
    route(method: string, ...cbs: IMiddleWare[]): any;
    /**
     * request other side for a response
     * @param method method name
     * @param data params to the method
     * @param transfers object array want to transfer
     */
    fetch(method: string, data: any, transfers?: any[]): Promise<{}> | undefined;
    /**
     * listen event from other side
     * @param method method name
     * @param cb callback function
     */
    on(method: string, cb: ICallback): void;
    /**
     * remove event listener
     * @param method method name
     * @param cb callback function
     */
    off(method: string, cb?: ICallback): void;
    /**
     * emit event that will be listened from on
     * @param method method name
     * @param data params
     * @param transfers object array want to transfer
     */
    emit(method: string, data: any, transfers?: any[]): void;
    /**
     * compose middlewares into one function
     *  copy form https://github.com/koajs/compose/blob/master/index.js
     * @param middlewares middlewares
     */
    protected composeMiddlewares(middlewares: IMiddleWare[]): (context: IContext, next?: Function | undefined) => Promise<any>;
    /**
     * create context used by middleware
     * @param evt message event
     */
    protected createContext(evt: MessageEvent): IContext;
    /**
     * listen original message event
     * @param evt message event
     */
    protected onMessage(evt: MessageEvent): Promise<void>;
    /**
     * send message to the other side
     * @param message meesage object to send
     * @param needResp whether need response from other side
     */
    protected postMessage(message: IMessage, needResp?: boolean): Promise<{}> | undefined;
}
export {};
