import { AbstractHub, IResponse, IHandlerMap, IRequest } from './abstract'
import { StorageMessageHub } from './storage-message'
export interface IPageScriptMessageHubOptions {
  /** custom event name, default: message-hub */
  customEventName?: string
}

export class PageScriptMessageHub extends StorageMessageHub {
  protected readonly _customEventName: string;
  constructor(options?: IPageScriptMessageHubOptions) {
    // tslint:disable-next-line
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      throw new Error(
        "StorageMessageHub only available in normal browser context, nodejs/worker are not supported"
      );
    }
    options = Object.assign({ customEventName: "message-hub" }, options);

    super();
    this._customEventName = options.customEventName!;
    this._onMessageReceived = this._onMessageReceived.bind(this);
    // @ts-ignore
    window.addEventListener(this._customEventName, this._onMessageReceived);
  }

  /**
   * call peer's `methodName` with arguments
   * @param methodName `methodName` to call
   * @param args arguments for that method
   * @returns Promise<unknown>
   */
  emit(methodName: string, ...args: any[]) {
    return super._emit(this.instanceID, methodName, ...args);
  }

  // @ts-ignore
  protected _onMessageReceived(evt: CustomEvent) {
    this._onMessage(this.instanceID, evt.detail);
  }

  protected sendMessage(peer: string, msg: IRequest | IResponse) {
    const evt = new CustomEvent(this._customEventName, { detail: msg });
    window.dispatchEvent(evt);
  }
}