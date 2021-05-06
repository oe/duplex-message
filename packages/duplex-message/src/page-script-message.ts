import {
  AbstractHub,
  IResponse,
  IHandlerMap,
  IRequest,
} from './abstract'

export interface IPageScriptMessageHubOptions {
  /** custom event name, default: message-hub */
  customEventName?: string
}

export class PageScriptMessageHub extends AbstractHub {
  protected readonly _customEventName: string

  constructor(options?: IPageScriptMessageHubOptions) {
    // tslint:disable-next-line
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      throw new Error(
        'PageScriptMessageHub only available in normal browser context, nodejs/worker are not supported',
      )
    }
    // eslint-disable-next-line no-param-reassign
    options = { customEventName: 'message-hub', ...options }

    super()
    this._customEventName = options.customEventName!
    this._onMessageReceived = this._onMessageReceived.bind(this)
    // @ts-ignore
    window.addEventListener(this._customEventName, this._onMessageReceived)
  }

  /**
   * listen all messages with one handler; or listen multi message via a handler map
   * @param handlerMap handler or a map of handlers
   */
  on(handlerMap: Function | IHandlerMap): void;
  /**
   * listen `methodName` with a handler
   * @param methodName method name
   * @param handler handler for the method name
   */
  on(methodName: string, handler: Function): void;
  on(handlerMap: IHandlerMap | Function | string, handler?: Function): void {
    // @ts-ignore
    super._on(this.instanceID, handlerMap, handler)
  }

  /**
   * call peer's `methodName` with arguments
   * @param methodName `methodName` to call
   * @param args arguments for that method
   * @returns Promise<unknown>
   */
  emit(methodName: string, ...args: any[]) {
    return super._emit(this.instanceID, methodName, ...args)
  }

  /**
   * remove handler for `methodName`; remove all handlers if `methodName` absent
   * @param methodName method name
   */
  off(methodName?: string) {
    super._off(this.instanceID, methodName)
  }

  protected _onMessageReceived(evt: CustomEvent) {
    this._onMessage(this.instanceID, evt.detail)
  }

  protected sendMessage(peer: string, msg: IRequest | IResponse) {
    const evt = new CustomEvent(this._customEventName, { detail: msg })
    window.dispatchEvent(evt)
  }
}
