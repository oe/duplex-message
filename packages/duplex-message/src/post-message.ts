import {
  AbstractHub,
  IResponse,
  IRequest,
  IProgress,
  IFn,
  IHandlerMap,
  EErrorCode,
  IAbstractHubOptions,
  IMethodNameConfig,
} from './abstract'

export interface IPostMessageMethodOptions extends IMethodNameConfig {
  /**
   * transferable data list
   */
  transfer?: any[]
  /**
   * target origin, default is '*'
   */
  targetOrigin?: string
}

type IOwnPeer = Window | Worker | undefined

let sharedMessageHub: PostMessageHub

const isInWorker = typeof document === 'undefined'

function isWorker(peer: any): peer is Worker {
  return !isInWorker && typeof Worker !== 'undefined' && peer instanceof Worker
}

function isWindow(peer:any): peer is Window {
  return !isInWorker && typeof window !== 'undefined' && peer && peer.window === peer
}

export class PostMessageHub extends AbstractHub {
  protected _hostedWorkers: Worker[]

  protected readonly _WIN: Window | Worker

  protected readonly _isInWorker: boolean

  constructor(options?: IAbstractHubOptions) {
    super(options)
    this._hostedWorkers = []
    // save current window it's self
    // eslint-disable-next-line no-restricted-globals
    this._WIN = self
    // tslint:disable-next-line
    this._isInWorker = isInWorker
    this._onMessageReceived = this._onMessageReceived.bind(this)
    this.proxyMessage = this.proxyMessage.bind(this)
    this._WIN.addEventListener('message', this._onMessageReceived)
  }

  /**
   * listen all messages from `peer` with one handler;
   *  or listen multi message via a handler map
   * @param peer messages that sent from, * for any peer
   * @param handlerMap handler or a map of handlers
   */
  on(peer: Window | Worker | '*', handlerMap: IFn | IHandlerMap): void;
  /**
   * listen `methodName` from `peer` with a handler
   * @param peer messages that sent from, * for any peer
   * @param methodName method name
   * @param handler handler for the method name
   */
  on(peer: Window | Worker | '*', methodName: string, handler: IFn): void;
  on(
    peer: Window | Worker | '*',
    handlerMap: IHandlerMap | IFn | string,
    handler?: IFn,
  ): void {
    // @ts-ignore
    super._on(peer, handlerMap, handler)
    this._addWorkerListener(peer)
  }

  /**
   * call peer's `methodName` with arguments
   * @peer peer that will receive the message
   * @param methodName `methodName` to call
   * @param args arguments for that method
   * @returns Promise<unknown>
   */
  emit<ResponseType = unknown>(peer: Window | Worker,
    methodName: string | IPostMessageMethodOptions, ...args: any[]) {
    if (isWindow(peer) && !peer.parent) {
      return Promise.reject({
        code: EErrorCode.PEER_NOT_FOUND,
        message: 'peer window is unloaded',
      })
    }
    this._addWorkerListener(peer)
    return this._emit<ResponseType>(peer, methodName, ...args)
  }

  /**
   * remove handler for `methodName` registered for `peer`
   *  remove all handlers registered for `peer` if `methodName` absent
   * @param peer peer that own handlers
   * @param methodName method name
   */
  off(peer: Window | Worker | '*', methodName?: string, handler?: IFn) {
    super._off(peer, methodName, handler)
    const evtMpIndx = this._eventHandlerMap.findIndex((m) => m[0] === peer)
    if (evtMpIndx === -1 && isWorker(peer)) {
      const idx = this._hostedWorkers.indexOf(peer)
      if (idx > -1) {
        this._hostedWorkers.splice(idx, 1)
        peer.removeEventListener('message', this._onMessageReceived)
      }
    }
  }

  override destroy() {
    if (this.isDestroyed) return
    super.destroy()
    // @ts-ignore
    this._WIN.removeEventListener('message', this._onMessageReceived)
    // @ts-ignore
    this._WIN = null
    this._hostedWorkers.forEach((peer) => {
      peer.removeEventListener('message', this._onMessageReceived)
    })
    this._hostedWorkers.splice(0)
  }

  /**
   * create a dedicated MessageHub that focus on communicate with the specified peer
   * @param peer peer window to communicate with, or you can set it later via `setPeer`
   * @param silent when peer not exists, keep silent instead of throw an error
   */
  createDedicatedMessageHub(peer?: IOwnPeer, silent?: boolean) {
    let ownPeer = peer
    const checkPeer = () => {
      if (!ownPeer) {
        if (silent) return false
        throw new Error(
          '[PostMessageHub] peer is not set in dedicated postMessageHub',
        )
      }
      return true
    }
    /**
     * set peer that this dedicated message-hub want communicate with
     * @param peer if using in Worker thread, set peer to `self`
     */
    const setPeer = (p: IOwnPeer) => {
      ownPeer = p
    }
    /**
     * listen method invoking from peer
     * @param methodName method name or handler map
     * @param handler omit if methodName is handler map
     */
    const on = (methodName: string | IHandlerMap, handler?: IFn) => {
      if (!checkPeer()) return
      const handlerMap = typeof methodName === 'string' ? { [methodName]: handler } : methodName
      // @ts-ignore
      this.on(ownPeer, handlerMap)
    }
    /**
     * call method and pass reset arguments to the peer
     * @param methodName
     * @param args
     */
    const emit = <ResponseType = unknown>(
      methodName: string | IPostMessageMethodOptions, ...args: any[]) => {
      if (!checkPeer()) {
        return Promise.reject({
          code: EErrorCode.PEER_NOT_FOUND,
          message: 'peer not specified',
        })
      }
      // @ts-ignore
      return this.emit<ResponseType>(ownPeer, methodName, ...args)
    }
    /**
     * remove method from messageHub. remove all listeners if methodName not presented
     * @param methodName method meed to remove
     */
    const off = (methodName?: string, handler?: IFn) => {
      if (!checkPeer()) return
      this.off(ownPeer!, methodName, handler)
    }
    return {
      setPeer,
      emit,
      on,
      off,
    }
  }

  /**
   * forward message from `fromWin` to `toWin`
   * @param fromWin message source win
   * @param toWin message target win
   */
  createProxy(fromWin: Window | Worker, toWin: Window | Worker) {
    if (this._isInWorker) {
      throw new Error(
        '[PostMessageHub] createProxy can only be used in a normal window context',
      )
    }
    if (this._WIN === fromWin || this._WIN === toWin || fromWin === toWin) {
      throw new Error('[PostMessageHub] can not forward message to own')
    }
    this.on(fromWin, this.proxyMessage(toWin))
  }

  /**
   * stop forwarding message from `fromWin`
   * * only stop when the callback is a general function and has win property
   */
  stopProxy(fromWin: Window | Worker) {
    const tuple = this.getEventHandlers(fromWin)
    if (!tuple) return
    const [, handlerMap] = tuple
    // @ts-ignore
    if (typeof handlerMap === 'function' && handlerMap.win) {
      this.off(fromWin)
    }
  }

  protected proxyMessage(destWin: Window | Worker) {
    // @ts-ignore
    const callback = (...args: any[]) => this.emit(destWin, ...args)
    callback.win = destWin
    return callback
  }

  protected _addWorkerListener(peer: Window | Worker | '*') {
    if (isWorker(peer) && !this._hostedWorkers.includes(peer)) {
      this._hostedWorkers.push(peer)
      peer.addEventListener('message', this._onMessageReceived)
    }
  }

  protected _onMessageReceived(evt: MessageEvent) {
    const peer = evt.source || evt.currentTarget || this._WIN
    this.onMessage(peer, evt.data)
  }

  protected sendMessage(
    peer: Window | Worker,
    msg: IRequest | IResponse | IProgress,
  ) {
    const args: any[] = [msg]
    if (!this._isInWorker && isWindow(peer)) {
      // @ts-ignore
      args.push(msg.targetOrigin || '*')
    }
    // add transferable data if exists
    // @ts-ignore
    if (Array.isArray(msg.transfer)) {
      // @ts-ignore
      args.push(msg.transfer)
    }
    // @ts-ignore
    peer.postMessage(...args)
  }

  /** shared PostMessageHub instance */
  public static get shared() {
    if (!sharedMessageHub) {
      sharedMessageHub = new PostMessageHub()
    }
    return sharedMessageHub
  }
}
