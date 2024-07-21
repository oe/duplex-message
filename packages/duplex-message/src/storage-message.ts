import {
  AbstractHub,
  IResponse,
  IHandlerMap,
  IRequest,
  IFn,
  IProgress,
  IAbstractHubOptions,
  IMethodNameConfig,
} from './abstract'

export interface IStorageMessageHubOptions extends IAbstractHubOptions {
  /** localStorage key prefix to store message, default: $$xiu */
  keyPrefix?: string
}

const DEFAULT_KEY_PREFIX = '$$xiu'

let sharedMessageHub: StorageMessageHub

export class StorageMessageHub extends AbstractHub {
  protected readonly _keyPrefix: string

  constructor(options?: IStorageMessageHubOptions) {
    // tslint:disable-next-line
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      throw new Error(
        'StorageMessageHub only available in normal browser context, nodejs/worker are not supported',
      )
    }
    super(options)
    // eslint-disable-next-line no-param-reassign
    options = { keyPrefix: DEFAULT_KEY_PREFIX, ...options }
    this._onMessageReceived = this._onMessageReceived.bind(this)
    this._keyPrefix = options.keyPrefix!
    window.addEventListener('storage', this._onMessageReceived)
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
  on(handlerMap: string, handler: IFn): void;
  on(handlerMap: IHandlerMap | IFn): void
  on(handlerMap: IHandlerMap | IFn | string, handler?: IFn): void {
    // @ts-expect-error fix type error
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

  override destroy() {
    if (this.isDestroyed) return
    super.destroy()
    window.removeEventListener('storage', this._onMessageReceived)
  }

  protected sendMessage(peer: string, msg: IRequest | IResponse) {
    const msgKey = this._getMsgKey(msg)
    try {
      localStorage.setItem(msgKey, JSON.stringify(msg))
      // clean storage key after 100ms
      setTimeout(() => {
        localStorage.removeItem(msgKey)
      }, 100)
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[duplex-message] unable to stringify message, message not sent',
          e, 'message:', msg,
        )
      }
      throw e
    }
  }

  protected _onMessageReceived(evt: StorageEvent) {
    const msg = this._getMsgFromEvent(evt)
    if (!msg) return
    this.onMessage(this.instanceID, msg)
  }

  protected _getMsgFromEvent(evt: StorageEvent): any {
    if (
      !evt.key
      || !evt.newValue
      || evt.storageArea !== localStorage
      || !evt.key.startsWith(`${this._keyPrefix}-`)
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
    return `${this._keyPrefix}-${msg.type}-${msg.from}-${
      msg.to || ''
    }-${msg.messageID}`
  }

  /** shared StorageMessageHub instance */
  public static get shared() {
    if (!sharedMessageHub) {
      sharedMessageHub = new StorageMessageHub()
    }
    return sharedMessageHub
  }
}
