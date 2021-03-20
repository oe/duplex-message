export declare type IHandlerMap = Record<string, Function>;
export declare abstract class AbstractHub {
    /**
     * hub instance
     */
    readonly instanceID: string;
    protected _messageID: number;
    /**
     * message handler map
     *  array item struct: eventTarget, {eventName: eventHandler } | handler4AllEvents
     */
    protected readonly _eventHandlerMap: Array<[any, IHandlerMap | Function]>;
    /**
     * init Hub, subclass should implement its own constructor
     */
    constructor();
    /**
     * subclass' own off method, should use _off to implements it
     * @param args args to off method, normally are target and methodName
     */
    abstract off(...args: any[]): void;
    /**
     * subclass' own on method, should use _on to implements it
     * @param args args to listen method, normally are target, methodName and method
     */
    abstract on(...args: any[]): void;
    /**
     * subclass' own emit method, should use _emit to implements it
     * @param args args to emit message, normally are target, methodName and method's params
     */
    abstract emit(...args: any[]): void;
    /**
     * subclass' own send message method, should send msg to target
     * @param target peer to receive message. if only one/no specified peer, target will be *
     * @param msg message send to peer
     */
    protected abstract sendMessage(target: any, msg: IRequest): void;
    /**
     * subclass' own listenResponse method, should get response from target and pass response to callback
     * @param target peer that respond message
     * @param reqMsg message sent to peer
     * @param callback when get the response, pass it to callback
     */
    protected abstract listenResponse(target: any, reqMsg: IRequest, callback: (resp: IResponse) => boolean): void;
    protected _hasListeners(): boolean;
    /**
     * add listener for target
     */
    protected _on(target: any, handlerMap: Function | IHandlerMap): any;
    protected _on(target: any, methodName: string, handler: Function): any;
    protected _off(target: Window | Worker | '*', methodName?: string): void;
    onRequest(target: any, reqMsg: IRequest): Promise<{
        fromInstance: string;
        toInstance: string;
        messageID: number;
        type: string;
        isSuccess: boolean;
        data: any;
    }>;
    protected _emit(target: any, methodName: string, ...args: any[]): Promise<unknown>;
    protected _buildReqMessage(methodName: string, args: any[]): {
        fromInstance: string;
        toInstance: string | undefined;
        messageID: number;
        type: string;
        methodName: string;
        args: any[];
    };
    protected _buildRespMessage(data: any, reqMsg: IRequest, isSuccess: any): {
        fromInstance: string;
        toInstance: string;
        messageID: number;
        type: string;
        isSuccess: boolean;
        data: any;
    };
    protected _isRequest(reqMsg: IRequest): boolean;
    protected _isResponse(reqMsg: IRequest, respMsg: IResponse): boolean;
    static generateInstanceID(): string;
    static buildReqMsg(instanceID: string, messageID: number, methodName: string, args: any[], toInstance?: string): {
        fromInstance: string;
        toInstance: string | undefined;
        messageID: number;
        type: string;
        methodName: string;
        args: any[];
    };
    static buildRespMsg(instanceID: string, data: any, reqMsg: IRequest, isSuccess: boolean): {
        fromInstance: string;
        toInstance: string;
        messageID: number;
        type: string;
        isSuccess: boolean;
        data: any;
    };
}
export declare type IRequest = ReturnType<typeof AbstractHub.buildReqMsg>;
export declare type IResponse = ReturnType<typeof AbstractHub.buildRespMsg>;
