import { AbstractHub, IResponse, IHandlerMap, IRequest } from './abstract'

export class StorageMessageHub extends AbstractHub {
  
  protected readonly _responseCallbacks: Function[]
  protected _isEventAttached: boolean
  constructor () {
    // tslint:disable-next-line
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      throw new Error('StorageMessageHub only available in normal browser context, nodejs/worker are not supported')
    }
    super()
    this._responseCallbacks = []
    this._onMessageReceived = this._onMessageReceived.bind(this)
    this._isEventAttached = false
  }

  on (handlerMap: Function | IHandlerMap)
  on (handlerMap: string, handler: Function)
  on (handlerMap: IHandlerMap | Function | string, handler?: Function) {
    // @ts-ignore
    super._on('*', handlerMap, handler)
    if (this._isEventAttached) return
    window.addEventListener('storage', this._onMessageReceived)
    this._isEventAttached = true
  }

  emit (methodName: string, ...args: any[]) {
    return super._emit('*', methodName, ...args)
  }

  off (methodName?: string) {
    super._off('*', methodName)
    if (!this._hasListeners() || (methodName && this._isEventAttached)) {
      window.removeEventListener('storage', this._onMessageReceived)
      this._isEventAttached = false
    }
  }

  protected sendMessage (target: string, msg: IRequest | IResponse) {
    const msgKey = StorageMessageHub._getMsgKey(msg)
    localStorage.setItem(msgKey, JSON.stringify(msg))
  }

  protected listenResponse (target: any, reqMsg: IRequest, callback: (resp: IResponse) => boolean) {
    // callback handled via onMessageReceived
    const evtCallback = (msg: IResponse) => {
      if (!callback(msg)) return false
      localStorage.removeItem(StorageMessageHub._getMsgKey(msg))
      return true
    }
    this._responseCallbacks.push(evtCallback)
  }

   protected async _onMessageReceived (evt: StorageEvent) {
    console.warn('storage event', evt)
    const msg = StorageMessageHub._getMsgFromEvent(evt)
    if (!msg) return
    if (!this._isRequest(msg)) {
      const idx = this._responseCallbacks.findIndex(fn => fn(msg))
      if (idx >= 0) {
        this._responseCallbacks.splice(idx, 1)
      } else {
        // clean unhandled responses
        if (msg.toInstance === this.instanceID && msg.type === 'response') {
          localStorage.removeItem(StorageMessageHub._getMsgKey(msg))
        }
      }
      return
    }

    // clear storage
    setTimeout(() => {
      if (localStorage.getItem(evt.key!) === null) return
      localStorage.removeItem(evt.key!)
    }, 100 + Math.floor(1000 * Math.random()))

    let response: IResponse

    try {
      response = await this.onRequest('*', msg)
    } catch (error) {
      response = error
    }
    this.sendMessage('*', response)
  }

  protected static _getMsgFromEvent (evt: StorageEvent) {
    if (!evt.key || !/^\$\$msghub\-/.test(evt.key) || !evt.newValue ) return
    let msg
    try { msg = JSON.parse(evt.newValue) } catch (error) { return }
    return msg
  }

  protected static _getMsgKey (msg: IRequest | IResponse) {
    return `$$msghub-${msg.type}-${msg.fromInstance}-${msg.toInstance || ''}-${msg.messageID}`
  }
}