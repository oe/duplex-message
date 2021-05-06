import { AbstractHub, IResponse, IHandlerMap, IRequest, IProgress, EErrorCode } from './abstract'

export interface IStorageMessageHubOptions {
  /** timeout number(millisecond as unit) when no response is received, default: 1000 milliseconds */
  timeout?: number
  /** localStorage key prefix to store message, default: $$xiu */
  keyPrefix?: string
  /** a customable identity that can make your self identified by others, will be used by StorageMessageHub.getPeerIdentifies  */
  identity?: any
}

export interface IStorageMessageHubEmitConfig {
  /**
   * need all peers' responses
   * 
   *  if set true, the promise result will be an object, key is the peer's instance id, value is its response
   */
  needAllResponses?: boolean
  /**
   * peer's instance id, only send the message to `toInstance`
   * 
   *  if `toInstance` is set, `needAllResponses` won't work any more
   */
  toInstance?: string
  /** specified another timeout number for this message  */
  timeout?: number
  /** method name */
  methodName: string
}

export interface IPeerIdentity {
  /** instance id, unique, auto generated */
  instanceID: string
  /** can be custom when new StorageMessageHub */
  identity?: any
}

const GET_PEERS_EVENT_NAME = '--get-all-peers-to-xiu--'
const WAIT_TIMEOUT = 200

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
  
  /**
   * listen all messages with one handler; or listen multi message via a handler map
   * @param handlerMap handler or a map of handlers
   */
  on (handlerMap: Function | IHandlerMap): void
  /**
   * listen `methodName` with a handler
   * @param methodName method name
   * @param handler handler for the method name
   */
  on (handlerMap: string, handler: Function): void
  on (handlerMap: IHandlerMap | Function | string, handler?: Function): void {
    // @ts-ignore
    super._on(this.instanceID, handlerMap, handler)
  }

  /**
   * call peer's `methodName` with arguments
   * @param methodName `methodName` to call
   * @param args arguments for that method
   * @returns Promise<unknown>
   */
  emit (methodName: string | IStorageMessageHubEmitConfig, ...args: any[]) {
    let newMethodName = methodName
    const isObj = methodName && typeof methodName === 'object'
    // if no specified toInstance, then should not have progress event
    // @ts-ignore
    const peer = isObj && methodName.toInstance || '*'
    // @ts-ignore
    if (isObj && methodName.toInstance && methodName.needAllResponses) {
      console.warn('[duplex-message] StorageMessageHub: toInstance and needAllResponses should not specified at the same time, use `toInstance` in priority')
      newMethodName = Object.assign({}, methodName)
      // @ts-ignore
      delete newMethodName.needAllResponses
    }
    return super._emit(peer, newMethodName, ...args)
  }
  
  /**
   * remove handler for `methodName`; remove all handlers if `methodName` absent
   * @param methodName method name
   */
  off (methodName?: string) {
    super._off(this.instanceID, methodName)
  }
  /**
   * get all peers identifiers
   * @returns promise of object, object's key is peer's instance id  
   *    value is an object with struct {instanceID, identify?}
   */
  getPeerIdentifies () {
    //Promise<Record<string, IPeerIdentity>>
    return this.emit({
      methodName: GET_PEERS_EVENT_NAME,
      needAllResponses: true
    }).then((res: any) => {
      return Object.keys(res).map((key: string) => {
        const val = res[key]
        if (!val.isSuccess) throw new Error(`[duplex-message] unable to get instance ${key}' identifier: ${JSON.stringify(val.data)}`)
        return val.data
      })
    })
  }

  protected sendMessage (peer: string, msg: IRequest | IResponse) {
    const msgKey = this._getMsgKey(msg)
    try {
      localStorage.setItem(msgKey, JSON.stringify(msg))
    } catch (e) {
      console.warn('[duplex-message] unable to stringify message, message not sent', e)
      throw e
    }
  }

  protected _listenResponse (peer: any, reqMsg: IRequest, callback: (resp: IResponse | IProgress) => number) {

    const needAllResponses = reqMsg.needAllResponses
    const needWaitAllResponses = reqMsg.needAllResponses || (!reqMsg.toInstance && !reqMsg.needAllResponses)
    const msgs: IResponse[] = []
    const timeout =  reqMsg.timeout ||  this._responseTimeout 
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
      if (this._isProgress(reqMsg, msg)) {
        return callback(msg)
      }
      if (!this._isResponse(reqMsg, msg)) return 0
      localStorage.removeItem(this._getMsgKey(msg));
      if (needWaitAllResponses && !allMsgReceived) {
        // waiting for others to respond
        clearTimeout(tid)
        // run callback if succeed
        if (!needAllResponses && msg.isSuccess) return callback(msg)
        // save response by fromInstance id
        msgs.push(msg)

        // @ts-ignore
        tid = setTimeout(() => {
          allMsgReceived = true;
          let resp: IResponse;
          if (needAllResponses) {
            const finalData = msgs.reduce((acc, msg) => {
              acc[msg.fromInstance] = {
                isSuccess: msg.isSuccess,
                data: msg.data,
              };
              return acc;
            }, {} as Record<string, any>);
            resp = this._buildRespMessage(finalData, reqMsg, true);
          } else {
            resp = msgs[0];
          }
          this._runResponseCallback(resp);
        }, timeout);
        return 2
      }
      reqMsg.progress && localStorage.removeItem(this._getMsgKey(Object.assign({}, msg, { type: "progress" })))
      return callback(msg)
    }
    super._listenResponse(peer, reqMsg, evtCallback)
    
    // timeout then clear localStorage
    setTimeout(() => {
      if (this._designedResponse[reqMsg.messageID]) return;
      localStorage.removeItem(this._getMsgKey(reqMsg));
    }, WAIT_TIMEOUT);
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
