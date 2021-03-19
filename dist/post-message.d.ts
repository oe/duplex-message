import { AbstractHub, IResponse, IRequest, IHandlerMap } from './abstract';
declare type IOwnPeer = Window | Worker | undefined;
export declare class PostMessageHub extends AbstractHub {
    private hostedWorkers;
    constructor();
    on(target: Window | Worker | '*', handlerMap: Function | IHandlerMap): any;
    on(target: Window | Worker | '*', handlerMap: string, handler: Function): any;
    emit(peer: Window | Worker, methodName: string, ...args: any[]): Promise<unknown>;
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
    protected listenResponse(target: any, reqMsg: IRequest, callback: (resp: IResponse) => boolean): void;
}
export {};
