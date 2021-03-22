import { AbstractHub, IResponse, IRequest, IHandlerMap } from './abstract'

type IOwnPeer = Window | Worker | undefined
// save current window it's self
const WIN: Window = self
// tslint:disable-next-line
const isWorker = typeof document === 'undefined'
export class PostMessageHub extends AbstractHub {
  protected _hostedWorkers: Worker[]
  protected readonly _responseCallbacks: Function[]
  protected _isEventAttached: boolean
  constructor () {
    super()
    this._hostedWorkers = []
    this._responseCallbacks = []
    this._isEventAttached = false
    this._onMessageReceived = this._onMessageReceived.bind(this)
    this.proxyMessage = this.proxyMessage.bind(this)
  }

  on (target: Window | Worker | '*', handlerMap: Function | IHandlerMap): void
  on (target: Window | Worker | '*', handlerMap: string, handler: Function): void
  on (target: Window | Worker | '*', handlerMap: IHandlerMap | Function | string, handler?: Function): void {
    // @ts-ignore
    super._on(target, handlerMap, handler)
    if (target instanceof Worker && !this._hostedWorkers.includes(target)) {
      this._hostedWorkers.push(target)
      target.addEventListener('message', this._onMessageReceived)
    }
    if (this._isEventAttached) return
    WIN.addEventListener('message', this._onMessageReceived)
    this._isEventAttached = true
  }

  emit (peer: Window | Worker, methodName: string, ...args: any[]) {
    return this._emit(peer, methodName, args)
  }

  off (target: Window | Worker | '*', methodName?: string) {
    super._off(target, methodName)
    const evtMpIndx = this._eventHandlerMap.findIndex(m => m[0] === target)
    if (evtMpIndx === -1 && target instanceof Worker) {
      const idx = this._hostedWorkers.indexOf(target)
      if (idx > -1) {
        this._hostedWorkers.splice(idx, 1)
        target.removeEventListener('message', this._onMessageReceived)
      } 
    }
    if (this._eventHandlerMap.length || !this._isEventAttached) return
    WIN.removeEventListener('message', this._onMessageReceived)
    this._isEventAttached = false
  }

  /**
   * create a dedicated MessageHub that focus on communicate with the specified peer
   * @param peer peer window to communicate with, or you can set it later via `setPeer`
   */
  createDedicatedMessageHub (peer?: IOwnPeer) {
    let ownPeer = peer
    const checkPeer = () => {
      if (!ownPeer) throw new Error('peer is not set in dedicated message-hub')
    }
    /**
     * set peer that this dedicated message-hub want communicate with
     * @param peer if using in Worker thread, set peer to `self`
     */
    const setPeer = (peer: IOwnPeer) => { ownPeer = peer}
    /**
     * listen method invoking from peer
     * @param methodName method name or handler map
     * @param handler omit if methodName is handler map
     */
    const on = (methodName: string | object, handler?: Function) => {
      checkPeer()
      const handlerMap = typeof methodName === 'string' ? {[methodName]: handler} : methodName
      // @ts-ignore
      this.on(ownPeer, handlerMap)
    }
    /**
     * call method and pass reset arguments to the peer
     * @param methodName
     * @param args 
     */
    const emit = (methodName: string, ...args: any[]) => {
      checkPeer()
      // @ts-ignore
      return this.emit(ownPeer, methodName, ...args)
    }
    /**
     * remove method from messageHub. remove all listeners if methodName not presented
     * @param methodName method meed to remove
     */
    const off = (methodName?: string) => {
      checkPeer()
      // @ts-ignore
      if (!methodName) return this.off(ownPeer)
      const matchedMap = this._eventHandlerMap.find(wm => wm[0] === ownPeer)
      if (matchedMap && typeof matchedMap[1] === 'object') {
        delete matchedMap[1][methodName]
      }
    }
    return { setPeer, emit, on, off }
  }

  /**
   * forward message from `fromWin` to `toWin`
   * @param fromWin message source win
   * @param toWin message target win
   */
  createProxy (fromWin: Window | Worker, toWin: Window | Worker) {
    if (isWorker) throw new Error('[MessageHub] createProxy can only be used in a normal window context')
    if (WIN === fromWin || WIN === toWin || fromWin === toWin) {
      throw new Error('[MessageHub] can not forward message to own')
    }
    this.on(fromWin, this.proxyMessage(toWin))
  }

  proxyMessage (destWin: Window | Worker) {
    return (...args: any[]) => {
      // @ts-ignore
      return this.emit(destWin, ...args)
    }
  }

  /**
   * proxy all message from peer to parent window
   * @deprecated use createProxy instead
   * @param peer 
   */
  createProxyFor (peer: Window | Worker) {
    this.createProxy(peer, WIN.parent)
  }


  protected async _onMessageReceived (evt: MessageEvent) {
    const data = evt.data as IRequest
    if (!data) return
    if (!this._isRequest(data)) {
      const idx = this._responseCallbacks.findIndex(fn => fn(data))
      if (idx >= 0) this._responseCallbacks.splice(idx, 1)
      return
    }
    const target = evt.source || evt.currentTarget || WIN
    let response: IResponse
    try {
      response = await this.onRequest(target, data)
    } catch (error) {
      response = error
    }
    this.sendMessage(target as Window, response)
  }

  protected sendMessage (peer: Window | Worker, msg: any) {
    const args = [msg]
    // tslint:disable-next-line
    if (typeof Window === 'function' && peer instanceof Window) {
      args.push('*')
    }
    // @ts-ignore
    peer.postMessage(...args)
  }

  protected listenResponse (target: any, reqMsg: IRequest, callback: (resp: IResponse) => boolean) {
    this._responseCallbacks.push(callback)
  }
}