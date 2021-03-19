import { AbstractHub, IResponse, IRequest, IHandlerMap } from './abstract'

// save current window it's self
const WIN: Window = self
type IOwnPeer = Window | Worker | undefined

// tslint:disable-next-line
const isWorker = typeof document === 'undefined'

const hostedWorkers: Worker[] = []

class PostMessageHub extends AbstractHub {
  constructor () {
    super()
    this.onMessageReceived = this.onMessageReceived.bind(this)
    this.proxyMessage = this.proxyMessage.bind(this)
    WIN.addEventListener('message', this.onMessageReceived)
  }

  on (target: any, handlerMap: Function | IHandlerMap)
  on (target: any, handlerMap: string, handler: Function)
  on (target: any, handlerMap: IHandlerMap | Function | string, handler?: Function) {
    // @ts-ignore
    super.on(target, handlerMap, handler)
    if (target instanceof Worker && !hostedWorkers.includes(target)) {
      hostedWorkers.push(target)
      target.addEventListener('message', this.onMessageReceived)
    }
  }

  off (target: Window | Worker | '*') {
    super.off(target)
    if (target instanceof Worker) {
      target.removeEventListener('message', this.onMessageReceived)
      const idx = hostedWorkers.indexOf(target)
      idx > -1 && hostedWorkers.splice(idx, 1)
    }
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
      const matchedMap = this.eventHandlerMap.find(wm => wm[0] === ownPeer)
      if (matchedMap) {
        delete matchedMap[methodName]
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


  protected async onMessageReceived (evt: MessageEvent) {
    const data = evt.data as IRequest
    if (!this.isRequest(data)) return
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

  protected onResponse (target: any, reqMsg: IRequest, callback: (resp: IResponse) => void) {
    const evtCallback = (evt: MessageEvent) => {
      callback(evt.data)
      WIN.removeEventListener('message', evtCallback)
    }
    WIN.addEventListener('message', evtCallback)
  }
}

export const postMessageHub = new PostMessageHub()