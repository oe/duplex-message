import { AbstractHub, IResponse, IHandlerMap, IRequest } from './abstract'

export interface IPageScriptMessageHubOptions {
  customEventName?: string
}

export class PageScriptMessageHub extends AbstractHub {
  protected readonly _customEventName: string
  protected _isEventAttached: boolean
  constructor (options?: IPageScriptMessageHubOptions) {
    // tslint:disable-next-line
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      throw new Error('StorageMessageHub only available in normal browser context, nodejs/worker are not supported')
    }
    options = Object.assign({ customEventName: 'message-hub'}, options)

    super()
    this._customEventName = options.customEventName!
    this._onMessageReceived = this._onMessageReceived.bind(this)
    this._isEventAttached = false
  }

  on (handlerMap: Function | IHandlerMap): void
  on (methodName: string, handler: Function): void
  on (handlerMap: IHandlerMap | Function | string, handler?: Function): void {
    // @ts-ignore
    super._on(this.instanceID, handlerMap, handler)
    if (this._isEventAttached) return
    // @ts-ignore
    window.addEventListener(this._customEventName, this._onMessageReceived)
  }

  emit (method: string, ...args: any[]) {
    return super._emit(this.instanceID, method, ...args)
  }

  off (methodName?: string) {
    super._off(this.instanceID, methodName)
    if (!this._hasListeners() || (!methodName && this._isEventAttached)) {
      // @ts-ignore
      window.removeEventListener(this._customEventName, this._onMessageReceived)
      this._isEventAttached = false
    }
  }

  protected _onMessageReceived (evt: CustomEvent) {
    this._onMessage(this.instanceID, evt.detail)
  }

  protected sendMessage (target: string, msg: IRequest | IResponse) {
    const evt = new CustomEvent(this._customEventName, { detail: msg })
    window.dispatchEvent(evt)
  }
}