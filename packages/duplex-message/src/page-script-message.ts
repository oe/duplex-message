import {
  AbstractHub,
  IResponse,
  IHandlerMap,
  IRequest,
  IFn,
  IAbstractHubOptions,
  IMethodNameConfig,
} from './abstract'

const DEFAULT_CUSTOM_EVT_NAME = 'message-hub'

let sharedMessageHub: PageScriptMessageHub

export interface IPageScriptMessageHubOptions extends IAbstractHubOptions {
  /** custom event name, default: message-hub */
  customEventName?: string
}

export class PageScriptMessageHub extends AbstractHub {
  protected readonly _customEventName: string

  constructor(options?: IPageScriptMessageHubOptions) {
    // tslint:disable-next-line
    if (typeof window === 'undefined') {
      throw new Error(
        'PageScriptMessageHub only available in normal browser context, nodejs/worker are not supported',
      )
    }
    // eslint-disable-next-line no-param-reassign
    options = { customEventName: DEFAULT_CUSTOM_EVT_NAME, ...options }

    super(options)
    this._customEventName = options.customEventName!
    this._onMessageReceived = this._onMessageReceived.bind(this)
    // @ts-ignore
    window.addEventListener(this._customEventName, this._onMessageReceived)
  }

  /**
   * listen all messages with one handler; or listen multi message via a handler map
   * @param handlerMap handler or a map of handlers
   */
  on(handlerMap: IFn | IHandlerMap): void;
  /**
   * listen `methodName` with a handler
   * @param methodName method name
   * @param handler handler for the method name
   */
  on(methodName: string, handler: IFn): void;
  on(handlerMap: IHandlerMap | IFn | string, handler?: IFn): void {
    // @ts-ignore
    super._on(this.instanceID, handlerMap, handler)
  }

  /**
   * call peer's `methodName` with arguments
   * @param methodName `methodName` to call
   * @param args arguments for that method
   * @returns Promise<unknown>
   */
  emit<ResponseType = unknown>(methodName: string | IMethodNameConfig, ...args: any[]) {
    return super._emit<ResponseType>(this.instanceID, methodName, ...args)
  }

  /**
   * remove handler for `methodName`; remove all handlers if `methodName` absent
   * @param methodName method name
   */
  off(methodName?: string, handler?: IFn) {
    super._off(this.instanceID, methodName, handler)
  }

  override destroy() {
    if (this.isDestroyed) return
    super.destroy()
    // @ts-ignore
    window.removeEventListener(this._customEventName, this._onMessageReceived)
  }

  protected _onMessageReceived(evt: CustomEvent) {
    this.onMessage(this.instanceID, evt.detail)
  }

  protected sendMessage(peer: string, msg: IRequest | IResponse) {
    const evt = new CustomEvent(this._customEventName, { detail: msg })
    window.dispatchEvent(evt)
  }

  /** shared PageScriptMessageHub instance */
  public static get shared() {
    if (!sharedMessageHub) {
      sharedMessageHub = new PageScriptMessageHub()
    }
    return sharedMessageHub
  }
}
