export type IHandlerMap = Record<string, Function>

export interface IRequest {
  fromInstance: string
  toInstance?: string
  messageID: number
  type: 'request'
  methodName: string,
  args: any[]
  progress?: boolean
  [k: string]: any
}

export interface IResponse {
  fromInstance: string
  toInstance: string
  messageID: number
  type: 'response'
  isSuccess: boolean
  data: any
}

export interface IMethodNameConfig {
  methodName: string
  [k: string]: any
}

export abstract class AbstractHub {
  /**
   * hub instance 
   */
  readonly instanceID: string

  protected _messageID: number
  /**
   * message handler map
   *  array item struct: eventTarget, {eventName: eventHandler } | handler4AllEvents
   */
  protected readonly _eventHandlerMap: Array<[any, IHandlerMap | Function]>

  /**
   * init Hub, subclass should implement its own constructor
   */
  constructor () {
    this.instanceID = AbstractHub.generateInstanceID()
    this._eventHandlerMap = []
    this._messageID = 0
  }

  /**
   * subclass' own off method, should use _off to implements it
   * @param args args to off method, normally are target and methodName
   */
  abstract off (...args: any[]): void
  
  /**
   * subclass' own on method, should use _on to implements it
   * @param args args to listen method, normally are target, methodName and method
   */
  abstract on (...args: any[]): void

  /**
   * subclass' own emit method, should use _emit to implements it
   * @param args args to emit message, normally are target, methodName and method's params
   */
  abstract emit (...args: any[]): void

  /**
   * subclass' own send message method, should send msg to target
   * @param target peer to receive message. if only one/no specified peer, target will be *
   * @param msg message send to peer
   */
  protected abstract sendMessage (target: any, msg: IRequest): void

  /**
   * subclass' own listenResponse method, should get response from target and pass response to callback
   * @param target peer that respond message
   * @param reqMsg message sent to peer
   * @param callback when get the response, pass it to callback
   */
  protected abstract listenResponse (target: any, reqMsg: IRequest, callback: (resp: IResponse) => boolean): void

  protected _hasListeners () {
    return this._eventHandlerMap.length > 0
  }
  /**
   * add listener for target
   */
  protected _on (target: any, handlerMap: Function | IHandlerMap): void
  protected _on (target: any, methodName: string, handler: Function): void
  protected _on (target: any, handlerMap: IHandlerMap | Function | string, handler?: Function): void {
    const pair = this._eventHandlerMap.find(pair => pair[0] === target)
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
    this._eventHandlerMap[target === '*' ? 'unshift' : 'push']([target, handlerResult])
  }


  protected _off (target: any, methodName?: string) {
    const index = this._eventHandlerMap.findIndex(pair => pair[0] === target)
    if (index === -1) return
    if (!methodName) {
      this._eventHandlerMap.splice(index, 1)
      return
    }
    const handlerMap = this._eventHandlerMap[index][1]
    if (typeof handlerMap === 'object') {
      delete handlerMap[methodName]
      // nothing left
      if (!Object.keys(handlerMap).length) {
        this._eventHandlerMap.splice(index, 1)
      }
    }
  }

  async onRequest (target: any, reqMsg: IRequest) {
    try {
      const matchedMap = this._eventHandlerMap.find(wm => wm[0] === target) ||
        // use * for default
        (this._eventHandlerMap[0] && this._eventHandlerMap[0][0] === '*' && this._eventHandlerMap[0])
      const { methodName, args } = reqMsg
      const handlerMap = matchedMap && matchedMap[1]
      // handler map could be a function
      let method: Function
      if (typeof handlerMap === 'function') {
        method = handlerMap
        // add methodName as the first argument if handlerMap is a function
        args.unshift(methodName)
      } else {
        // @ts-ignore
        method = handlerMap && handlerMap[methodName]
      }
      // tslint:disable-next-line
      if (typeof method !== 'function') {
        console.warn(`[MessageHub] no corresponding handler found for ${methodName}, message from`, target)
        throw new Error(`[MessageHub] no corresponding handler found for ${methodName}`)
      }
      const data = await method.apply(null, args)
      return this._buildRespMessage(data, reqMsg, true)
    } catch (error) {
      throw this._buildRespMessage(error, reqMsg, false)
    }
  }

  protected _emit (target: any, methodName: string | IMethodNameConfig, ...args: any[]) {
    const msg = this._buildReqMessage(methodName, args)
    this.sendMessage(target, msg)
    return new Promise((resolve, reject) => {
      const callback = (response: IResponse) => {
        if (!this._isResponse(msg, response)) return false
        response.isSuccess ? resolve(response.data) : reject(response.data)
        return true
      }
      this.listenResponse(target, msg, callback)
    })
  }

  protected _buildReqMessage (methodName: string | IMethodNameConfig, args: any[]): IRequest {
    const basicCfg = typeof methodName === 'string' ? { methodName } : methodName
    // @ts-ignore
    return Object.assign(basicCfg, {
      fromInstance: this.instanceID,
      // toInstance,
      messageID: ++this._messageID,
      type: 'request',
      args
    })
  }

  protected _buildRespMessage (data: any, reqMsg: IRequest, isSuccess: boolean): IResponse {
    return {
      fromInstance: this.instanceID,
      toInstance: reqMsg.fromInstance,
      messageID: reqMsg.messageID,
      type: 'response',
      isSuccess,
      data
    }
  }

  protected _isRequest (reqMsg: any): reqMsg is IRequest {
    return Boolean(reqMsg && reqMsg.fromInstance &&
      reqMsg.fromInstance !== this.instanceID &&
      (!reqMsg.toInstance || (reqMsg.toInstance === this.instanceID)) &&
      reqMsg.messageID && reqMsg.type === 'request')
  }

  protected _isResponse (reqMsg: IRequest, respMsg: any): respMsg is IResponse {
    return reqMsg && reqMsg && 
      respMsg.toInstance === this.instanceID &&
      respMsg.toInstance === reqMsg.fromInstance && 
      respMsg.messageID === reqMsg.messageID &&
      respMsg.type === 'response'
  }

  static generateInstanceID () {
    return Math.random().toString(36).slice(2)
  }
}
