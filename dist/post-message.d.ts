import { AbstractHub, IResponse, IRequest, IHandlerMap } from './abstract';
declare type IOwnPeer = Window | Worker | undefined;
declare class PostMessageHub extends AbstractHub {
    constructor();
    on(target: any, handlerMap: Function | IHandlerMap): any;
    on(target: any, handlerMap: string, handler: Function): any;
    off(target: Window | Worker | '*'): void;
    /**
     * create a dedicated MessageHub that focus on communicate with the specified peer
     * @param peer peer window to communicate with, or you can set it later via `setPeer`
     */
    createDedicatedMessageHub(peer?: IOwnPeer): {
        setPeer: (peer: IOwnPeer) => void;
        emit: (methodName: string, ...args: any[]) => Promise<unknown>;
        on: (methodName: string | object, handler?: Function | undefined) => void;
        off: (methodName?: string | undefined) => void;
    };
    /**
     * forward message from `fromWin` to `toWin`
     * @param fromWin message source win
     * @param toWin message target win
     */
    createProxy(fromWin: Window | Worker, toWin: Window | Worker): void;
    proxyMessage(destWin: Window | Worker): (...args: any[]) => Promise<unknown>;
    /**
     * proxy all message from peer to parent window
     * @deprecated use createProxy instead
     * @param peer
     */
    createProxyFor(peer: Window | Worker): void;
    protected onMessageReceived(evt: MessageEvent): Promise<void>;
    protected sendMessage(peer: Window | Worker, msg: any): void;
    protected onResponse(target: any, reqMsg: IRequest, callback: (resp: IResponse) => void): void;
}
export declare const postMessageHub: PostMessageHub;
export {};
