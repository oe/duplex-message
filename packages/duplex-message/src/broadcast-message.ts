/**
 * cross window/tabs/frames in same origin communicate via BroadcastChannel
 */

import {
  AbstractHub, IResponse, IRequest, IHandlerMap,
} from './abstract'

let sharedBroadcastMessageHub: BroadcastMessageHub

const DEFAULT_BROADCAST_CHANNEL_NAME = '--xiu-duplex-message-broadcast--'

export interface IBroadcastMessageHubOptions {
  channelName?: string
}

export class BroadcastMessageHub extends AbstractHub {
  protected readonly _WIN: BroadcastChannel

  constructor(options?: IBroadcastMessageHubOptions) {
    super()
    // save current window it's self
    // eslint-disable-next-line no-restricted-globals
    this._WIN = new BroadcastChannel(
      (options && options.channelName) || DEFAULT_BROADCAST_CHANNEL_NAME,
    )

    this._onMessageReceived = this._onMessageReceived.bind(this)
    this._WIN.addEventListener('message', this._onMessageReceived)
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
  emit(methodName: string, ...args: any[]) {
    return super._emit(this.instanceID, methodName, ...args)
  }

  /**
   * remove handler for `methodName`; remove all handlers if `methodName` absent
   * @param methodName method name
   */
  off(methodName?: string) {
    super._off(this.instanceID, methodName)
  }

  protected sendMessage(peer: string, msg: IRequest | IResponse) {
    this._WIN.postMessage(msg)
  }

  protected _onMessageReceived(evt: MessageEvent) {
    this._onMessage(this.instanceID, evt.data)
  }

  /** shared PostMessageHub instance */
  public static get shared() {
    if (!sharedBroadcastMessageHub) {
      sharedBroadcastMessageHub = new BroadcastMessageHub()
    }
    return sharedBroadcastMessageHub
  }
}
