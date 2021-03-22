import { AbstractHub, IResponse, IHandlerMap, IRequest } from './abstract'

export class StorageMessageHub extends AbstractHub {
  
  protected readonly _responseCallbacks: Function[]
  protected _isEventAttached: boolean
  // timeout when no response sent back
  protected _responseTimeout: number
  constructor () {
    // tslint:disable-next-line
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      throw new Error('StorageMessageHub only available in normal browser context, nodejs/worker are not supported')
    }
    super()
    this._responseCallbacks = []
    this._onMessageReceived = this._onMessageReceived.bind(this)
    this._responseTimeout = 200
    this._isEventAttached = false
  }

  on (handlerMap: Function | IHandlerMap): void
  on (handlerMap: string, handler: Function): void
  on (handlerMap: IHandlerMap | Function | string, handler?: Function): void {
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
    let hasResp = false
    const needAllResponses = true
    const msgs: IResponse[] = []
    let allMsgReceived = false
    let tid = 0
    /**
     * callback handled via onMessageReceived
     *  returns:  0 not a corresponding response
     *            1 corresponding response and everything get proceeded
     *            2 corresponding response and need waiting for rest responses
     * @param msg 
     * @returns number
     */
    const evtCallback = (msg: IResponse) => {
      if (!needAllResponses) {
        if (!callback(msg)) return 0
      } else {
        if (!this._isResponse(reqMsg, msg)) return 0
        if (allMsgReceived) {
          callback(msg)
          return 1
        }
        msgs.push(msg.data)

        // waiting for others to respond
        clearTimeout(tid)
        // @ts-ignore
        tid = setTimeout(() => {
          allMsgReceived = true
          const resp = this._buildRespMessage(msgs, reqMsg, true)
          this._runResponseCallback(resp)
        }, this._responseTimeout)
      }
      hasResp = true
      localStorage.removeItem(StorageMessageHub._getMsgKey(msg))
      return needAllResponses ? 2 : 1
    }
    this._responseCallbacks.push(evtCallback)
    // timeout when no response, callback get a failure
    setTimeout(() => {
      if (hasResp) return
      const resp = this._buildRespMessage({message: 'timeout'}, reqMsg, false)
      this._runResponseCallback(resp)
    }, this._responseTimeout)
  }

  protected _runResponseCallback (resp: IResponse) {
    let mc = 0
    const idx = this._responseCallbacks.findIndex(fn => {
      mc = fn(resp)
      return Boolean(mc)
    })
    if (idx >= 0) {
      if (mc > 1) return
      this._responseCallbacks.splice(idx, 1)
    } else {
      // clean unhandled responses
      if (resp.toInstance === this.instanceID && resp.type === 'response') {
        localStorage.removeItem(StorageMessageHub._getMsgKey(resp))
      }
    }
  }

   protected async _onMessageReceived (evt: StorageEvent) {
    console.warn('storage event', evt)
    const msg = StorageMessageHub._getMsgFromEvent(evt)
    if (!msg) return
    if (!this._isRequest(msg)) {
      this._runResponseCallback(msg)
      return
    }

    // clear received message after proceeded
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