import { AbstractHub, IResponse, IHandlerMap, IRequest } from './abstract';
export declare class StorageMessageHub extends AbstractHub {
    protected readonly _responseCallbacks: Function[];
    protected _isEventAttached: boolean;
    constructor();
    on(handlerMap: Function | IHandlerMap): any;
    on(handlerMap: string, handler: Function): any;
    emit(methodName: string, ...args: any[]): Promise<unknown>;
    off(methodName?: string): void;
    protected sendMessage(target: string, msg: IRequest | IResponse): void;
    protected listenResponse(target: any, reqMsg: IRequest, callback: (resp: IResponse) => boolean): void;
    protected _onMessageReceived(evt: StorageEvent): Promise<void>;
    protected static _getMsgFromEvent(evt: StorageEvent): any;
    protected static _getMsgKey(msg: IRequest | IResponse): string;
}
