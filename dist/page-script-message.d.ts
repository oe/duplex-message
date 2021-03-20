import { AbstractHub, IResponse, IHandlerMap, IRequest } from './abstract';
export declare class PageScriptMessageHub extends AbstractHub {
    protected readonly _customEventName: string;
    protected readonly _responseCallbacks: Function[];
    protected _isEventAttached: boolean;
    constructor(customEventName?: string);
    on(handlerMap: Function | IHandlerMap): any;
    on(methodName: string, handler: Function): any;
    emit(method: string, ...args: any[]): Promise<unknown>;
    off(methodName?: string): void;
    protected _onMessageReceived(evt: CustomEvent): Promise<void>;
    protected sendMessage(target: string, msg: IRequest | IResponse): void;
    protected listenResponse(target: any, reqMsg: IRequest, callback: (resp: IResponse) => boolean): void;
}
