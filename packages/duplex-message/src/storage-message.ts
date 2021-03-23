import { AbstractHub, IResponse, IHandlerMap, IRequest, IProgress } from './abstract'

export interface IStorageMessageHubOptions {
  timeout?: number
  keyPrefix?: string
  identity?: any
}

export interface IStorageMessageHubEmit {
  needAllResponses?: boolean
  toInstance?: string
  methodName: string
}

export interface IPeerIdentity {
  instanceID: string
  identity?: any
}

const GET_PEERS_EVENT_NAME = '--get-all-peers-to-xiu--'

export class StorageMessageHub extends AbstractHub {
  protected readonly _keyPrefix: string
  protected readonly _identity?: string
  /** timeout when no response sent back */
  protected readonly _responseTimeout: number
  constructor (options?: IStorageMessageHubOptions) {
    // tslint:disable-next-line
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      throw new Error('StorageMessageHub only available in normal browser context, nodejs/worker are not supported')
    }
    super()
    options = Object.assign({timeout: 1000, keyPrefix: '$$xiu'}, options)
    this._onMessageReceived = this._onMessageReceived.bind(this)
    this._identity = options.identity
    this._responseTimeout = options.timeout!
    this._keyPrefix = options.keyPrefix!
    window.addEventListener('storage', this._onMessageReceived)
  }

  on (handlerMap: Function | IHandlerMap): void
  on (handlerMap: string, handler: Function): void
  on (handlerMap: IHandlerMap | Function | string, handler?: Function): void {
    // @ts-ignore
    super._on(this.instanceID, handlerMap, handler)
  }

  emit (methodName: string | IStorageMessageHubEmit, ...args: any[]) {
    // if no specified toInstance, then should not have progress event
    const target = methodName && typeof methodName === 'object' && methodName.toInstance || '*'
    return super._emit(target, methodName, ...args)
  }

  off (methodName?: string) {
    super._off(this.instanceID, methodName)
  }

  getPeerIdentifies () {
    return this.emit({
      methodName: GET_PEERS_EVENT_NAME,
      needAllResponses: true
    }) as Promise<Record<string, IPeerIdentity>>
  }

  protected sendMessage (target: string, msg: IRequest | IResponse) {
    const msgKey = this._getMsgKey(msg)
    try {
      localStorage.setItem(msgKey, JSON.stringify(msg))
    } catch (e) {
      console.warn('[StorageMessageHub] unable to stringify message, message not sent', e)
      throw e
    }
  }

  protected _listenResponse (target: any, reqMsg: IRequest, callback: (resp: IResponse | IProgress) => number) {
    let hasResp = false
    const needAllResponses = reqMsg.needAllResponses
    const msgs: Record<string, IResponse> = {}
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
    const evtCallback = (msg: IResponse | IProgress) => {
      console.log('reqMsg', reqMsg, msg, this._isProgress(reqMsg, msg))
      if (this._isProgress(reqMsg, msg)) {
        console.warn('is progress', msg)
        hasResp = true
        return callback(msg)
      }
      if (!this._isResponse(reqMsg, msg)) return 0
      if (!needAllResponses) {
        return callback(msg)
      } else if (!allMsgReceived) {
        if (!this._isResponse(reqMsg, msg)) return 0
        // save response by fromInstance id
        msgs[msg.fromInstance] = msg.data

        // waiting for others to respond
        clearTimeout(tid)
        // @ts-ignore
        tid = setTimeout(() => {
          allMsgReceived = true
          const resp = this._buildRespMessage(msgs, reqMsg, true)
          this._runResponseCallback(resp)
        }, this._responseTimeout)
        return 2
      }
      hasResp = true
      localStorage.removeItem(this._getMsgKey(msg))
      reqMsg.progress && localStorage.removeItem(this._getMsgKey(Object.assign({}, msg, {type: 'progress'})))
      return callback(msg)
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
    if (!super._runResponseCallback(resp)) {
      // clean unhandled responses
      if (resp.toInstance === this.instanceID && resp.type === 'response') {
        localStorage.removeItem(this._getMsgKey(resp))
      }
      return false
    }
    return true
  }

  protected _onMessageReceived (evt: StorageEvent) {
    const msg = this._getMsgFromEvent(evt)
    if (!msg) return
    console.warn('onMessageReceived', msg)
    if (this._isRequest(msg)) {
      // clear received message after proceeded
      setTimeout(() => {
        if (localStorage.getItem(evt.key!) === null) return
        localStorage.removeItem(evt.key!)
      }, 100 + Math.floor(1000 * Math.random()))

      if (msg.methodName === GET_PEERS_EVENT_NAME) {
        let response: IResponse
        response = this._buildRespMessage({ instanceID: this.instanceID, identity: this._identity }, msg, true)
        this.sendMessage(this.instanceID, response)
        return
      }
    }
    this._onMessage(this.instanceID, msg)
  }

  protected _getMsgFromEvent (evt: StorageEvent) {
    if (!evt.key || evt.key.indexOf(this._keyPrefix + '-') !== 0 || !evt.newValue ) return
    let msg
    try { msg = JSON.parse(evt.newValue) } catch (error) { return }
    return msg
  }

  protected _getMsgKey (msg: IRequest | IResponse) {
    return `${this._keyPrefix}-${msg.type}-${msg.fromInstance}-${msg.toInstance || ''}-${msg.messageID}`
  }
}
