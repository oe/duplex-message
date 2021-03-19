import { AbstractHub, IResponse, IHandlerMap, IRequest } from './abstract';
export declare class StorageMessageHub extends AbstractHub {
    private responseCallbacks;
    constructor();
    on(handlerMap: Function | IHandlerMap): any;
    on(handlerMap: string, handler: Function): any;
    emit(method: string, ...args: any[]): Promise<unknown>;
    off(): void;
    protected onMessageReceived(evt: StorageEvent): Promise<void>;
    protected sendMessage(target: string, msg: IRequest | IResponse): void;
    protected listenResponse(target: any, reqMsg: IRequest, callback: (resp: IResponse) => boolean): void;
    private getMsgFromEvent;
}
