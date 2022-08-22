import {
  AbstractHub,
  IResponse,
  IHandlerMap,
  IRequest,
  IProgress,
  IAbstractHubOptions,
  IMethodNameConfig,
} from './abstract'

export interface IStorageMessageHubOptions extends IAbstractHubOptions {
  /** localStorage key prefix to store message, default: $$xiu */
  keyPrefix?: string
  /**
   * a customable identity that can make your self identified by others
   * will be used by StorageMessageHub.getPeerIdentifies
   */
  identity?: any
}

let sharedStorageMessageHub: StorageMessageHub

export class StorageMessageHub extends AbstractHub {
  protected readonly _keyPrefix: string

  protected readonly _identity?: string

  constructor(options?: IStorageMessageHubOptions) {
    // tslint:disable-next-line
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      throw new Error(
        'StorageMessageHub only available in normal browser context, nodejs/worker are not supported',
      )
    }
    super(options)
    // eslint-disable-next-line no-param-reassign
    options = { keyPrefix: '$$xiu', ...options }
    this._onMessageReceived = this._onMessageReceived.bind(this)
    this._identity = options.identity
    this._keyPrefix = options.keyPrefix!
    window.addEventListener('storage', this._onMessageReceived)
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
  on(handlerMap: string, handler: Function): void;
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
  emit<ResponseType = unknown>(methodName: string | IMethodNameConfig, ...args: any[]) {
    return super._emit<ResponseType>(this.instanceID, methodName, ...args)
  }

  /**
   * remove handler for `methodName`; remove all handlers if `methodName` absent
   * @param methodName method name
   */
  off(methodName?: string) {
    super._off(this.instanceID, methodName)
  }

  destroy() {
    if (this._isDestroyed) return
    super.destroy()
    window.removeEventListener('storage', this._onMessageReceived)
  }

  protected sendMessage(peer: string, msg: IRequest | IResponse) {
    const msgKey = this._getMsgKey(msg)
    try {
      localStorage.setItem(msgKey, JSON.stringify(msg))
    } catch (e) {
      console.warn(
        '[duplex-message] unable to stringify message, message not sent',
        e,
      )
      throw e
    }
  }

  protected _listenResponse(
    peer: any,
    reqMsg: IRequest,
    callback: (resp: IResponse | IProgress) => number,
  ) {
    const timeoutObj: Record<string, any> = {}
    const clearStorage = (k: string) => {
      clearTimeout(timeoutObj[k])
      timeoutObj[k] = setTimeout(() => {
        localStorage.removeItem(k)
        delete timeoutObj[k]
      }, 100)
    }

    const wrappedCallback = AbstractHub._wrapCallback(this, reqMsg, callback)
    /**
     * callback handled via onMessageReceived
     *  returns:  0 not a corresponding response
     *            1 corresponding response and everything get proceeded
     *            2 corresponding response and need waiting for rest responses
     * @param msg
     * @returns number
     */
    const evtCallback = (msg: IResponse | IProgress) => {
      const msgKey = this._getMsgKey({ ...msg, type: 'progress' })
      if (this._isProgress(reqMsg, msg)) {
        const res = wrappedCallback(msg)
        if (!res || !reqMsg.progress) {
          clearStorage(msgKey)
        }
        return res
      }
      if (!this._isResponse(reqMsg, msg)) return 0
      clearStorage(this._getMsgKey(msg))
      clearStorage(msgKey)
      return wrappedCallback(msg)
    }
    super._listenResponse(peer, reqMsg, evtCallback, true)
  }

  protected _runResponseCallback(resp: IResponse) {
    if (!super._runResponseCallback(resp)) {
      // clean unhandled responses
      if (resp.toInstance === this.instanceID && resp.type === 'response') {
        localStorage.removeItem(this._getMsgKey(resp))
      }
      return false
    }
    return true
  }

  protected _onMessageReceived(evt: StorageEvent) {
    const msg = this._getMsgFromEvent(evt)
    if (!msg) return
    if (this._isRequest(msg)) {
      // clear received message after proceeded
      setTimeout(() => {
        if (localStorage.getItem(evt.key!) === null) return
        localStorage.removeItem(evt.key!)
      }, 100 + Math.floor(1000 * Math.random()))
    }
    this._onMessage(this.instanceID, msg)
  }

  protected _getMsgFromEvent(evt: StorageEvent): any {
    if (
      !evt.key
      || evt.key.indexOf(`${this._keyPrefix}-`) !== 0
      || !evt.newValue
    ) return
    try {
      const msg = JSON.parse(evt.newValue)
      // eslint-disable-next-line consistent-return
      return msg
    } catch (error) {
      /** */
    }
  }

  protected _getMsgKey(msg: IRequest | IResponse | IProgress) {
    return `${this._keyPrefix}-${msg.type}-${msg.fromInstance}-${
      msg.toInstance || ''
    }-${msg.messageID}`
  }

  /** shared StorageMessageHub instance */
  public static get shared() {
    if (!sharedStorageMessageHub) {
      sharedStorageMessageHub = new StorageMessageHub()
    }
    return sharedStorageMessageHub
  }
}
