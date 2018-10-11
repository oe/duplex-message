import { IRouteParam, IContext as IComposieContext, IMiddleware as IComposieMiddleware } from 'composie';
/** event callbacks map */
export interface IEvtCallbacks {
    [k: string]: ICallback[];
}
/** message request */
export interface IMessageRequest {
    id: number;
    type: 'request';
    channel: string;
    data: any;
    event: Event;
    transfers?: any[];
}
/** message response */
export interface IMessageResponse {
    id: number;
    type: 'response';
    resolved: boolean;
    channel: string;
    data: any;
    event: Event;
}
/** message union */
export declare type IMessage = IMessageRequest | IMessageResponse;
/** request context for middleware */
export interface IContext extends IComposieContext {
    id: number;
    type: 'request';
    event: MessageEvent;
}
/** event callback */
export interface ICallback {
    (response: any): any;
}
/** middleware */
export interface IMiddleware extends IComposieMiddleware {
    (ctx: IContext, next: Function): any;
}
/** constructor init params for worker */
export interface IMsgInitWorker {
    type: 'worker';
    peer?: Worker;
}
/** constructor init params for frame */
export interface IMsgInitIframe {
    type: 'frame';
    peer: Window;
    targetOrigin?: string;
}
/** constructor init params */
export declare type IMsgInit = IMsgInitWorker | IMsgInitIframe;
/**
 * MessageHub Class
 */
export default class MessageHub {
    private count;
    private context;
    private peer;
    private type;
    private isWorker;
    private targetOrigin;
    private evtsCbs;
    private promisePairs;
    private composie;
    private isReady;
    constructor(options: IMsgInit);
    /**
     * wait for peer ready
     *  use it especially work with iframe
     * return a promise
     */
    ready(): Promise<{}>;
    /**
     * add global middleware
     * @param cb middleware
     */
    use(cb: IMiddleware): this;
    /**
     * add router
     * @param routers router map
     */
    route(routers: IRouteParam): any;
    /**
     * add router
     * @param channel channel name
     * @param cbs channel handlers
     */
    route(channel: string, ...cbs: IMiddleware[]): any;
    /**
     * request other side for a response
     * @param channel channel name
     * @param data params to the channel
     * @param transfers object array want to transfer
     */
    fetch(channel: string, data?: any, transfers?: any[]): Promise<any> | undefined;
    /**
     * listen event from other side
     * @param channel channel name
     * @param cb callback function
     */
    on(channel: string, cb: ICallback): void;
    /**
     * remove event listener
     * @param channel channel name
     * @param cb callback function
     */
    off(channel: string, cb?: ICallback): void;
    /**
     * emit event that will be listened from on
     * @param channel channel name
     * @param data params
     * @param transfers object array want to transfer
     */
    emit(channel: string, data?: any, transfers?: any[]): void;
    destroy(): void;
    /**
     * create context used by middleware
     * @param evt message event
     */
    protected createContext(evt: MessageEvent): IContext;
    /**
     * listen original message event
     * @param evt message event
     */
    protected onMessage(evt: MessageEvent): void;
    /** respond fetch request */
    private respond;
    /** resolve fetch request */
    protected resolveFetch(msg: IMessage): true | undefined;
    /**
     * validate origin in cross frame communicate is match
     * @param origin origin url
     */
    protected isValidateOrigin(origin: any): boolean;
    /**
     *
     * send message to the other side
     * @param message meesage object to send
     * @param needResp whether need response from other side
     */
    protected postMessage(message: IMessage, needResp?: boolean): Promise<any> | undefined;
}
