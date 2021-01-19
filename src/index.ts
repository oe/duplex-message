type IHandlerMap = Record<string, Function>

const WINDOW_ID = Math.random().toString(36).slice(2)
// save current window it's self
const WIN: Window = self

let msgID = 0
// tslint:disable-next-line
const isWorker = typeof document === 'undefined'

const WinHandlerMap: Array<[any, IHandlerMap | Function]> = [
  ['*', {}]
]

const hostedWorkers: Worker[] = []

type IOwnPeer = Window | Worker | undefined

WIN.addEventListener('message', onMessageReceived)

const MessageHub = {
  WINDOW_ID: WINDOW_ID,
  on (peer: Window | Worker | '*', handlerMap: IHandlerMap | Function | string, handler?: Function) {
    const pair = WinHandlerMap.find(pair => pair[0] === peer)
    if (typeof handlerMap === 'string') {
      // @ts-ignore
      handlerMap = {[handlerMap]: handler}
    }
    if (pair) {
      const existingMap = pair[1]
      // merge existing handler map
      // @ts-ignore
      pair[1] = typeof existingMap === 'function' ?
        handlerMap : typeof handlerMap === 'function' ?
          handlerMap : Object.assign({}, existingMap, handlerMap)

      return
    }
    if (peer instanceof Worker && !hostedWorkers.includes(peer)) {
      hostedWorkers.push(peer)
      peer.addEventListener('message', onMessageReceived)
    }
    // @ts-ignore
    WinHandlerMap[peer === '*' ? 'unshift' : 'push']([peer, handlerMap])
  },
  off (peer: Window | Worker | '*') {
    const index = WinHandlerMap.findIndex(pair => pair[0] === peer)
    if (index !== -1) {
      if (peer === '*') {
        // clear * (general) handler, instead of remove it
        WinHandlerMap[index][1] = {}
      } else {
        WinHandlerMap.splice(index, 1)
      }
    }
    if (peer instanceof Worker) {
      peer.removeEventListener('message', onMessageReceived)
      const idx = hostedWorkers.indexOf(peer)
      idx > -1 && hostedWorkers.splice(idx, 1)
    }
  },
  emit (peer: Window | Worker, methodName: string, ...args: any[]) {
    const msg = buildReqMsg(methodName, args)
    // @ts-ignore
    postMessageWith(peer, msg)
    return new Promise((resolve, reject) => {
      const win = (isWorker || !(peer instanceof Worker)) ? WIN : peer
      const onCallback = (evt: MessageEvent) => {
        const response = evt.data
        // console.log('response', evt, response, WIN)
        if (!isResponse(msg, response)) return
        // @ts-ignore
        win.removeEventListener('message', onCallback)
        response.isSuccess ? resolve(response.data) : reject(response.data)
      }
      // @ts-ignore
      win.addEventListener('message', onCallback)
    })
  },
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
      MessageHub.on(ownPeer, handlerMap)
    }
    /**
     * call method and pass reset arguments to the peer
     * @param methodName
     * @param args 
     */
    const emit = (methodName: string, ...args: any[]) => {
      checkPeer()
      // @ts-ignore
      return MessageHub.emit(ownPeer, methodName, ...args)
    }
    /**
     * remove method from messageHub. remove all listeners if methodName not presented
     * @param methodName method meed to remove
     */
    const off = (methodName?: string) => {
      checkPeer()
      // @ts-ignore
      if (!methodName) return MessageHub.off(ownPeer)
      const matchedMap = WinHandlerMap.find(wm => wm[0] === ownPeer)
      if (matchedMap) {
        delete matchedMap[methodName]
      }
    }
    return { setPeer, emit, on, off }
  },
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
    MessageHub.on(fromWin, proxyMessage(toWin))
  },
  /**
   * proxy all message from peer to parent window
   * @deprecated use createProxy instead
   * @param peer 
   */
  createProxyFor (peer: Window | Worker) {
    MessageHub.createProxy(peer, WIN.parent)
  }
}

function buildReqMsg (methodName: string, args: any[]) {
  return {
    winID: WINDOW_ID,
    msgID: ++msgID,
    type: 'request',
    methodName,
    args
  }
}

export type IRequest = ReturnType<typeof buildReqMsg>

function buildRespMsg (data: any, reqMsg: IRequest, isSuccess: boolean) {
  return {
    winID: reqMsg.winID,
    msgID: reqMsg.msgID,
    type: 'response',
    isSuccess,
    data
  }
}

export type IResponse = ReturnType<typeof buildRespMsg>

function isRequest (reqMsg: IRequest) {
  return reqMsg && reqMsg.winID &&
    reqMsg.winID !== WINDOW_ID &&
    reqMsg.msgID &&
    reqMsg.type === 'request'
}

function isResponse (reqMsg: IRequest, respMsg: any) {
  return reqMsg && reqMsg && 
    respMsg.winID === reqMsg.winID && 
    respMsg.msgID === reqMsg.msgID &&
    respMsg.type === 'response'
}

async function onMessageReceived (evt: MessageEvent) {
  const reqMsg = evt.data
  const sourceWin = evt.source || evt.currentTarget || WIN
  if (!isRequest(reqMsg) || !sourceWin) return
  try {
    const matchedMap = WinHandlerMap.find(wm => wm[0] === sourceWin) || WinHandlerMap[0]
    const { methodName, args } = reqMsg
    const handlerMap = matchedMap && matchedMap[1]
    // handler map could be a function
    let method: Function
    if (typeof handlerMap === 'function') {
      method = handlerMap
      // add methodName as the first argument if handlerMap is a function
      args.unshift(methodName)
    } else {
      method = handlerMap && handlerMap[methodName]
    }
    // tslint:disable-next-line
    if (typeof method !== 'function') {
      console.warn(`[MessageHub] no corresponding handler found for ${methodName}, message from`, sourceWin)
      throw new Error(`[MessageHub] no corresponding handler found for ${methodName}`)
    }
    const data = await method.apply(null, args)
    // @ts-ignore
    postMessageWith(sourceWin, buildRespMsg(data, reqMsg, true))
  } catch (error) {
    // @ts-ignore
    postMessageWith(sourceWin, buildRespMsg(error, reqMsg, false))
  }
}

function proxyMessage (destWin: Window | Worker) {
  return (...args: any[]) => {
    // @ts-ignore
    return MessageHub.emit(destWin, ...args)
  }
}

function postMessageWith (peer: Window | Worker, msg: any) {
  const args = [msg]
  // tslint:disable-next-line
  if (typeof Window === 'function' && peer instanceof Window) {
    args.push('*')
  }
  // @ts-ignore
  peer.postMessage(...args)
}

export default MessageHub