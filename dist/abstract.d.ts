export declare type IHandlerMap = Record<string, Function>;
export declare class AbstractHub {
    /**
     * hub instance
     */
    protected instanceID: string;
    protected messageID: number;
    /**
     * message handler map
     *  array item struct: eventTarget, {eventName: eventHandler } | handler4AllEvents
     */
    protected eventHandlerMap: Array<[any, IHandlerMap | Function]>;
    static generateInstanceID(): string;
    constructor();
    on(target: any, handlerMap: Function | IHandlerMap): any;
    on(target: any, handlerMap: string, handler: Function): any;
    off(target: Window | Worker | '*'): void;
    onRequest(target: any, reqMsg: IRequest): Promise<{
        fromInstance: string;
        toInstance: string;
        messageID: number;
        type: string;
        isSuccess: boolean;
        data: any;
    }>;
    emit(target: any, methodName: string, ...args: any[]): Promise<unknown>;
    protected sendMessage(target: any, msg: any): void;
    protected onResponse(target: any, reqMsg: IRequest, callback: (resp: IResponse) => void): void;
    protected buildReqMessage(methodName: string, args: any[]): {
        fromInstance: string;
        toInstance: string | undefined;
        messageID: number;
        type: string;
        methodName: string;
        args: any[];
    };
    protected buildRespMessage(data: any, reqMsg: IRequest, isSuccess: any): {
        fromInstance: string;
        toInstance: string;
        messageID: number;
        type: string;
        isSuccess: boolean;
        data: any;
    };
    protected isRequest(reqMsg: IRequest): boolean;
    protected isResponse(reqMsg: IRequest, respMsg: IResponse): boolean;
}
declare function buildReqMsg(instanceID: string, messageID: number, methodName: string, args: any[], toInstance?: string): {
    fromInstance: string;
    toInstance: string | undefined;
    messageID: number;
    type: string;
    methodName: string;
    args: any[];
};
export declare type IRequest = ReturnType<typeof buildReqMsg>;
declare function buildRespMsg(instanceID: string, data: any, reqMsg: IRequest, isSuccess: boolean): {
    fromInstance: string;
    toInstance: string;
    messageID: number;
    type: string;
    isSuccess: boolean;
    data: any;
};
export declare type IResponse = ReturnType<typeof buildRespMsg>;
export {};
