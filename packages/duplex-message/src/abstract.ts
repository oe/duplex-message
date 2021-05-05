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

export interface IProgress {
  fromInstance: string
  toInstance: string
  messageID: number
  type: 'progress'
  data: any
}

/** enum of error code */
export enum EErrorCode {
  /** handler on other side encounter an error  */
  HANDLER_EXEC_ERROR = 1,
  /** no corresponding handler found */
  HANDLER_NOT_EXIST = 2,
  /** peer not found*/
  PEER_NOT_FOUND = 3,
  /** message not responded in time */
  TIMEOUT = 4,
  /** message has invalid content, can't be sent  */
  INVALID_MESSAGE = 5,
  /** other unspecified error */
  UNKNOWN = 6,
}

/** error object could be caught via emit().catch(err) */
export interface IError {
  /** none-zero error code */
  code: EErrorCode
  /** error message */
  message: string
  /** error object if it could pass through via the message channel underground*/
  error?: Error
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

  protected readonly _responseCallbacks: ((...args: any[]) => number)[]

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
    this._responseCallbacks = []
    this._messageID = 0
  }

  /**
   * subclass' own off method, should use _off to implements it
   * @param args args to off method, normally are peer and methodName
   */
  abstract off (...args: any[]): void
  
  /**
   * subclass' own on method, should use _on to implements it
   * @param args args to listen method, normally are peer, methodName and method
   */
  abstract on (...args: any[]): void

  /**
   * subclass' own emit method, should use _emit to implements it
   * @param args args to emit message, normally are peer, methodName and method's params
   */
  abstract emit (...args: any[]): void

  /**
   * subclass' own send message method, should send msg to peer
   * @param peer peer to receive message. if only one/no specified peer, peer will be *
   * @param msg message send to peer
   */
  protected abstract sendMessage (peer: any, msg: IRequest | IProgress | IResponse): void


  protected _hasListeners () {
    return this._eventHandlerMap.length > 0
  }
  /**
   * add listener for peer
   */
  protected _on (peer: any, handlerMap: Function | IHandlerMap): void
  protected _on (peer: any, methodName: string, handler: Function): void
  protected _on (peer: any, handlerMap: IHandlerMap | Function | string, handler?: Function): void {
    const pair = this._eventHandlerMap.find(pair => pair[0] === peer)
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
    this._eventHandlerMap[peer === '*' ? 'unshift' : 'push']([peer, handlerResult])
  }


  protected _off (peer: any, methodName?: string) {
    const index = this._eventHandlerMap.findIndex(pair => pair[0] === peer)
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

  protected async _onMessage (peer: any, msg: any) {
    if (!msg) return
    if (!this._isRequest(msg)) {
      this._runResponseCallback(msg)
      return
    }
    if (msg.progress && msg.args[0]) {
      msg.args[0].onprogress = (data: any) => {
        this.sendMessage(peer, this._buildProgressMessage(data, msg))
      }
    }
    let response: IResponse
    try {
      response = await this._runMsgHandler(peer, msg)
    } catch (error) {
      response = error
    }
    this.sendMessage(peer, response)
  }

  protected _runResponseCallback (resp: IResponse) {
    let ret = 0
    const idx = this._responseCallbacks.findIndex(fn => {
      ret = fn(resp)
      return Boolean(ret)
    })
    if (idx >= 0) {
      if (ret > 1) return true
      this._responseCallbacks.splice(idx, 1)
      return true
    }
    return false
  }

  async _runMsgHandler (peer: any, reqMsg: IRequest) {
    try {
      const matchedMap = this._eventHandlerMap.find(wm => wm[0] === peer) ||
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
        console.warn(`[duplex-message] no corresponding handler found for ${methodName}, message from`, peer)
        const error = { code: EErrorCode.HANDLER_NOT_EXIST, message: `no corresponding handler found for ${methodName}`}
        return this._buildRespMessage(error, reqMsg, false)
      }
      const data = await method.apply(null, args)
      return this._buildRespMessage(data, reqMsg, true)
    } catch (error) {
      const data = { code: EErrorCode.HANDLER_EXEC_ERROR, message: error.message || error.stack, error }
      throw this._buildRespMessage(data, reqMsg, false)
    }
  }

  protected _emit (peer: any, methodName: string | IMethodNameConfig, ...args: any[]) {
    const reqMsg = this._buildReqMessage(methodName, args)
    const result = new Promise((resolve, reject) => {
      // 0 for not match
      // 1 for done
      // 2 for need to be continue
      const callback = (response: IResponse | IProgress) => {
        if (!this._isResponse(reqMsg, response)) {
          if (!this._isProgress(reqMsg, response)) return 0
          if (reqMsg.progress && reqMsg.args[0]) {
            try {
              reqMsg.args[0].onprogress(response.data)
            } catch (error) {
              console.warn('[duplex-message] progress callback for', reqMsg, 'response', response, ', error:', error)
            }
          }
          return 2
        }
        response.isSuccess ? resolve(response.data) : reject(response.data)
        return 1
      }
      this._listenResponse(peer, reqMsg, callback)
    })
    try {
      this.sendMessage(peer, this._normalizeRequest(peer, reqMsg))
    } catch (error) {
      console.warn('[duplex-message] unable to serialize message, message not sent', error)
      return Promise.reject({code: EErrorCode.INVALID_MESSAGE, message: 'unable to send message'})
    }
    return result
  }
  /**
   * should get response from peer and pass response to callback
   */
  protected _listenResponse (peer: any, reqMsg: IRequest, callback: (resp: IResponse | IProgress) => number) {
    this._responseCallbacks.push(callback)
  }

  // normalize progress callback on message
  protected _normalizeRequest(peer: any, msg: IRequest) {
    // skip if peer is * 
    if (peer === '*' || !msg.progress) {
      delete msg.progress
      return msg
    }
    const options = msg.args[0]
    const newMsg = Object.assign({}, msg)
    newMsg.args = newMsg.args.slice()
    const copied = Object.assign({}, options)
    delete copied.onprogress
    newMsg.args[0] = copied
    return newMsg
  }

  protected _buildReqMessage (methodName: string | IMethodNameConfig, args: any[]): IRequest {
    const basicCfg = typeof methodName === 'string' ? { methodName } : methodName
    const options = args[0]
    const progress = Boolean(options && typeof options.onprogress === 'function')
    // @ts-ignore
    return Object.assign(basicCfg, {
      fromInstance: this.instanceID,
      // toInstance,
      messageID: ++this._messageID,
      type: 'request',
      args,
      progress
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

  protected _buildProgressMessage (data: any, reqMsg: IRequest): IProgress {
    return {
      fromInstance: this.instanceID,
      toInstance: reqMsg.fromInstance,
      messageID: reqMsg.messageID,
      type: 'progress',
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
    return reqMsg && respMsg && 
      respMsg.toInstance === this.instanceID &&
      respMsg.toInstance === reqMsg.fromInstance && 
      respMsg.messageID === reqMsg.messageID &&
      respMsg.type === 'response'
  }

  protected _isProgress (reqMsg: IRequest, respMsg: any): respMsg is IProgress {
    return reqMsg && respMsg && reqMsg.progress &&
      respMsg.toInstance === this.instanceID &&
      respMsg.toInstance === reqMsg.fromInstance && 
      respMsg.messageID === reqMsg.messageID &&
      respMsg.type === 'progress'
  }

  static generateInstanceID () {
    return Array(3).join(Math.random().toString(36).slice(2) + '-').slice(0, -1)
  }
}
