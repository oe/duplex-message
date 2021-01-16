type IHandlerMap = Record<string, Function>

const WINDOW_ID = Math.random().toString(36).slice(2)
// save current window it's self
const WIN: Window = self

let msgID = 0

const WinHandlerMap: Array<[any, IHandlerMap]> = [
  ['*', {}]
]

WIN.addEventListener('message', async (evt: MessageEvent) => {
  console.log(evt)
  const reqMsg = evt.data
  const sourceWin = evt.source || WIN
  if (!isRequest(reqMsg) || !sourceWin) return
  try {
    const matchedMap = WinHandlerMap.find(wm => wm[0] === sourceWin)
    const { methodName, args } = reqMsg
    const method = matchedMap && matchedMap[1][methodName] || WinHandlerMap[0][1][methodName]
    // tslint:disable-next-line
    if (typeof method !== 'function') {
      console.warn(`[MessageHub] no corresponding handler found for ${methodName}, message from`, sourceWin)
      throw new Error(`[MessageHub] no corresponding handler found for ${methodName}`)
    }
    const data = await method.apply(null, args)
    // @ts-ignore
    sourceWin.postMessage(buildRespMsg(data, reqMsg, true))
  } catch (error) {
    // @ts-ignore
    sourceWin.postMessage(buildRespMsg(error, reqMsg, false))
  }
})

const messageHub = {
  WINDOW_ID: WINDOW_ID,
  on (peer: Window | Worker | '*', handlerMap: IHandlerMap) {
    const pair = WinHandlerMap.find(pair => pair[0] === peer)
    if (pair) {
      pair[1] = Object.assign({}, pair[1], handlerMap)
      return
    }
    WinHandlerMap.push([peer, handlerMap])
  },

  emit (peer: Window | Worker, methodName: string, ...args: any[]) {
    const msg = buildReqMsg(methodName, args)
    // @ts-ignore
    peer.postMessage(msg)
    return new Promise((resolve, reject) => {
      const onCallback = (evt: MessageEvent) => {
        const response = evt.data
        // console.log('response', evt, response, WIN)
        if (!isResponse(msg, response)) return
        WIN.removeEventListener('message', onCallback)
        response.isSuccess ? resolve(response.data) : reject(response.data)
      }
      WIN.addEventListener('message', onCallback)
    })
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

type IRequest = ReturnType<typeof buildReqMsg>

function buildRespMsg (data: any, reqMsg: IRequest, isSuccess: boolean) {
  return {
    winID: reqMsg.winID,
    msgID: reqMsg.msgID,
    type: 'response',
    isSuccess,
    data
  }
}

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

export default messageHub