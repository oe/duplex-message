/**
 * BroadcastChannel works for different browser-tabs or nodejs-processes
 */
import {
  AbstractHub,
  IResponse,
  IRequest,
  IProgress,
  IFn,
  IHandlerMap,
  IAbstractHubOptions,
  IMethodNameConfig,
} from './abstract'

let sharedMessageHub: BroadcastMessageHub

const DEFAULT_CHANNEL_NAME = 'message-hub'

export interface IBroadcastMessageHubOptions extends IAbstractHubOptions {
  /** BroadcastChannel name, default: message-hub */
  channelName?: string
}

export class BroadcastMessageHub extends AbstractHub {
  protected readonly bc: BroadcastChannel

  constructor(options?: IBroadcastMessageHubOptions) {
    if (typeof BroadcastChannel === 'undefined') {
      throw new Error(
        'BroadcastMessageHub only available in normal browser context with BroadcastChannel supported',
      )
    }
    super(options)
    this.bc = new BroadcastChannel(options?.channelName || DEFAULT_CHANNEL_NAME)
    this._onMessageReceived = this._onMessageReceived.bind(this)
    this.bc.addEventListener('message', this._onMessageReceived)
  }

  /**
   * listen `methodName` from `peer` with a handler
   * @param peer messages that sent from, * for any peer
   * @param methodName method name
   * @param handler handler for the method name
   */
  on(methodName: string, handler: IFn): void;
  on(handlerMap: IHandlerMap | IFn): void
  on(handlerMap: IHandlerMap | IFn | string, handler?: IFn): void {
    // @ts-expect-error fix type error
    super._on(this.instanceID, handlerMap, handler)
  }

  /**
   * call peer's `methodName` with arguments
   * @peer peer that will receive the message
   * @param methodName `methodName` to call
   * @param args arguments for that method
   * @returns Promise<unknown>
   */
  emit<ResponseType = unknown>(methodName: string | IMethodNameConfig, ...args: any[]) {
    return this._emit<ResponseType>(this.instanceID, methodName, ...args)
  }

  /**
   * remove handler for `methodName` registered for `peer`
   *  remove all handlers registered for `peer` if `methodName` absent
   * @param peer peer that own handlers
   * @param methodName method name
   */
  off(methodName?: string) {
    super._off(this.instanceID, methodName)
  }

  override destroy() {
    if (this.isDestroyed) return
    this.bc.removeEventListener('message', this._onMessageReceived)
    this.bc.close()
    // @ts-expect-error fix type error
    this.bc = null
    super.destroy()
  }

  protected _onMessageReceived(evt: MessageEvent) {
    this.onMessage(this.instanceID, evt.data)
  }

  protected sendMessage(
    peer: Window | Worker,
    msg: IRequest | IResponse | IProgress,
  ) {
    this.bc.postMessage(msg)
  }

  /** shared PostMessageHub instance */
  public static get shared() {
    if (!sharedMessageHub) {
      sharedMessageHub = new BroadcastMessageHub()
    }
    return sharedMessageHub
  }
}
