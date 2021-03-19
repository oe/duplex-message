export type IHandlerMap = Record<string, Function>

export class AbstractHub {
  /**
   * hub instance 
   */
  protected instanceID: string

  protected messageID: number
  /**
   * message handler map
   *  array item struct: eventTarget, {eventName: eventHandler } | handler4AllEvents
   */
  protected eventHandlerMap: Array<[any, IHandlerMap | Function]>
  static generateInstanceID () {
    return Math.random().toString(36).slice(2)
  }

  constructor () {
    this.instanceID = AbstractHub.generateInstanceID()
    this.eventHandlerMap = [['*', {}]]
    this.messageID = 0
  }

  on (target: any, handlerMap: Function | IHandlerMap)
  on (target: any, handlerMap: string, handler: Function)
  on (target: any, handlerMap: IHandlerMap | Function | string, handler?: Function) {
    const pair = this.eventHandlerMap.find(pair => pair[0] === target)
    let handlerResult: Function | IHandlerMap
    if (typeof handlerMap === 'string') {      
      handlerResult = { [handlerMap]: handler! }
    } else {
      handlerResult = handlerMap
    }
    if (pair) {
      const existingMap = pair[1]
      // merge existing handler map
      // @ts-ignore
      pair[1] = typeof existingMap === 'function' ?
        handlerResult : typeof handlerResult === 'function' ?
          handlerResult : Object.assign({}, existingMap, handlerResult)

      return
    }
    this.eventHandlerMap[target === '*' ? 'unshift' : 'push']([target, handlerResult])
  }

  off (target: Window | Worker | '*') {
    const index = this.eventHandlerMap.findIndex(pair => pair[0] === target)
    if (index !== -1) {
      if (target === '*') {
        // clear * (general) handler, instead of remove it
        this.eventHandlerMap[index][1] = {}
      } else {
        this.eventHandlerMap.splice(index, 1)
      }
    }
  }

  async onRequest (target: any, reqMsg: IRequest) {
    // if (!this.isRequest(reqMsg)) return
    
    try {
      const matchedMap = this.eventHandlerMap.find(wm => wm[0] === target) || this.eventHandlerMap[0]
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
        console.warn(`[MessageHub] no corresponding handler found for ${methodName}, message from`, target)
        throw new Error(`[MessageHub] no corresponding handler found for ${methodName}`)
      }
      const data = await method.apply(null, args)
      return this.buildRespMessage(data, reqMsg, true)
    } catch (error) {
      throw this.buildRespMessage(error, reqMsg, false)
    }
  }

  emit (target: any, methodName: string, ...args: any[]) {
    const msg = this.buildReqMessage(methodName, args)
    this.sendMessage(target, msg)
    return new Promise((resolve, reject) => {
      const callback = (response: IResponse) => {
        if (!this.isResponse(msg, response)) return
        response.isSuccess ? resolve(response.data) : reject(response.data)
      }
      this.onResponse(target, msg, callback)
    })
  }

  protected sendMessage (target: any, msg: any) {
    throw new Error('you need to implements sendMessage in your own class')
  }

  protected onResponse (target: any, reqMsg: IRequest, callback: (resp: IResponse) => void) {
    throw new Error('you need to implements onMessageReceived in your own class')
  }

  protected buildReqMessage (methodName: string, args: any[]) {
    return buildReqMsg(this.instanceID, ++this.messageID, methodName, args)
  }

  protected buildRespMessage (data: any, reqMsg: IRequest, isSuccess) {
    return buildRespMsg(this.instanceID, data, reqMsg, isSuccess)
  }

  protected isRequest (reqMsg: IRequest): boolean {
    return Boolean(reqMsg && reqMsg.fromInstance &&
      reqMsg.fromInstance !== this.instanceID &&
      (reqMsg.toInstance && reqMsg.toInstance !== this.instanceID) &&
      reqMsg.messageID && reqMsg.type === 'request')
  }

  protected isResponse (reqMsg: IRequest, respMsg: IResponse): boolean {
    return reqMsg && reqMsg && 
      respMsg.toInstance === this.instanceID &&
      respMsg.toInstance === reqMsg.fromInstance && 
      respMsg.messageID === reqMsg.messageID &&
      respMsg.type === 'response'
  }
}

function buildReqMsg (instanceID: string, messageID: number, methodName: string, args: any[], toInstance?: string) {
    return {
      fromInstance: instanceID,
      toInstance,
      messageID: messageID,
      type: 'request',
      methodName,
      args
    }
  }

export type IRequest = ReturnType<typeof buildReqMsg>

function buildRespMsg (instanceID: string, data: any, reqMsg: IRequest, isSuccess: boolean) {
  return {
    fromInstance: instanceID,
    toInstance: reqMsg.fromInstance,
    messageID: reqMsg.messageID,
    type: 'response',
    isSuccess,
    data
  }
}

export type IResponse = ReturnType<typeof buildRespMsg>
