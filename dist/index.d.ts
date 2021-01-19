declare type IHandlerMap = Record<string, Function>;
declare type IOwnPeer = Window | Worker | undefined;
declare const MessageHub: {
    WINDOW_ID: string;
    on(peer: Window | Worker | '*', handlerMap: IHandlerMap | Function | string, handler?: Function | undefined): void;
    off(peer: Window | Worker | '*'): void;
    emit(peer: Window | Worker, methodName: string, ...args: any[]): Promise<unknown>;
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
    /**
     * proxy all message from peer to parent window
     * @deprecated use createProxy instead
     * @param peer
     */
    createProxyFor(peer: Window | Worker): void;
};
declare function buildReqMsg(methodName: string, args: any[]): {
    winID: string;
    msgID: number;
    type: string;
    methodName: string;
    args: any[];
};
export declare type IRequest = ReturnType<typeof buildReqMsg>;
declare function buildRespMsg(data: any, reqMsg: IRequest, isSuccess: boolean): {
    winID: string;
    msgID: number;
    type: string;
    isSuccess: boolean;
    data: any;
};
export declare type IResponse = ReturnType<typeof buildRespMsg>;
export default MessageHub;
