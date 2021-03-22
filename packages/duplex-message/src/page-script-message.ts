import { AbstractHub, IResponse, IHandlerMap, IRequest } from './abstract'

export class PageScriptMessageHub extends AbstractHub {
  protected readonly _customEventName: string
  protected readonly _responseCallbacks: Function[]
  protected _isEventAttached: boolean
  constructor (customEventName = 'message-hub') {
    // tslint:disable-next-line
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      throw new Error('StorageMessageHub only available in normal browser context, nodejs/worker are not supported')
    }
    super()
    this._customEventName = customEventName
    this._responseCallbacks = []
    this._onMessageReceived = this._onMessageReceived.bind(this)
    this._isEventAttached = false
  }

  on (handlerMap: Function | IHandlerMap): void
  on (methodName: string, handler: Function): void
  on (handlerMap: IHandlerMap | Function | string, handler?: Function): void {
    // @ts-ignore
    super._on('*', handlerMap, handler)
    if (this._isEventAttached) return
    // @ts-ignore
    window.addEventListener(this._customEventName, this._onMessageReceived)
  }

  emit (method: string, ...args: any[]) {
    return super._emit('*', method, ...args)
  }

  off (methodName?: string) {
    super._off('*', methodName)
    if (!this._hasListeners() || (!methodName && this._isEventAttached)) {
      // @ts-ignore
      window.removeEventListener(this._customEventName, this._onMessageReceived)
      this._isEventAttached = false
    }
  }

  protected async _onMessageReceived (evt: CustomEvent) {
    const msg = evt.detail 
    if (!msg) return

    if (!this._isRequest(msg)) {
      const idx = this._responseCallbacks.findIndex(fn => fn(msg))
      if (idx >= 0) this._responseCallbacks.splice(idx, 1)
      return
    }

    let response: IResponse

    try {
      response = await this.onRequest('*', msg)
    } catch (error) {
      response = error
    }
    this.sendMessage('*', response)
  }

  protected sendMessage (target: string, msg: IRequest | IResponse) {
    const evt = new CustomEvent(this._customEventName, { detail: msg })
    window.dispatchEvent(evt)
  }

  protected listenResponse (target: any, reqMsg: IRequest, callback: (resp: IResponse) => boolean) {
    this._responseCallbacks.push(callback)
  }
}