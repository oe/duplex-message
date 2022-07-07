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
  /** peer not found */
  PEER_NOT_FOUND = 2,
  /** message not responded in time */
  TIMEOUT = 3,
  /** message has invalid content, can't be sent  */
  INVALID_MESSAGE = 4,
  /** other unspecified error */
  UNKNOWN = 5,
}

/** error object could be caught via emit().catch(err) */
export interface IError {
  /** none-zero error code */
  code: EErrorCode
  /** error message */
  message: string
  /** error object if it could pass through via the message channel underground */
  error?: Error
}

export interface IMethodNameConfig {
  methodName: string
  [k: string]: any
}

export interface ILibConfig {
  debug: boolean
}

const libConfig: ILibConfig = {
  debug: false,
}

export function setConfig(options: Partial<ILibConfig>) {
  Object.assign(libConfig, options)
}

const CONTINUE_INDICATOR = '--message-hub-to-be-continued--'

export interface IAbstractHubOptions {
  /** how long to wait for response before erroring out with TIMEOUT. */
  waitTimeout?: number;
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
   * designed response map
   *  key: messageID
   *  value: instanceID which will respond
   */
  protected _designedResponse: Record<string, string>

  /**
   * How long to wait for response before erroring out with TIMEOUT.
   */
  private _waitTimeout: number

  /**
   * init Hub, subclass should implement its own constructor
   */
  constructor(options?: IAbstractHubOptions) {
    // eslint-disable-next-line no-param-reassign
    options = { ...options, waitTimeout: 200 }
    this._waitTimeout = options.waitTimeout!
    this.instanceID = AbstractHub.generateInstanceID()
    this._eventHandlerMap = []
    this._responseCallbacks = []
    this._messageID = 0
    this._designedResponse = {}
    if (libConfig.debug) {
      console.warn(`[duplex-message] create instance of ${this.constructor.name}, instanceID: ${this.instanceID}`)
    }
  }

  /**
   * subclass' own off method, should use _off to implements it
   * @param args args to off method, normally are peer and methodName
   */
  abstract off(...args: any[]): void

  /**
   * subclass' own on method, should use _on to implements it
   * @param args args to listen method, normally are peer, methodName and method
   */
  abstract on(...args: any[]): void

  /**
   * subclass' own emit method, should use _emit to implements it
   * @param args args to emit message, normally are peer, methodName and method's params
   */
  abstract emit(...args: any[]): void

  /**
   * subclass' own send message method, should send msg to peer
   * @param peer peer to receive message. if only one/no specified peer, peer will be *
   * @param msg message send to peer
   */
  protected abstract sendMessage(
    peer: any,
    msg: IRequest | IProgress | IResponse
  ): void

  protected _hasListeners() {
    return this._eventHandlerMap.length > 0
  }

  /**
   * add listener for peer
   */
  protected _on(peer: any, handlerMap: Function | IHandlerMap): void;
  protected _on(peer: any, methodName: string, handler: Function): void;
  protected _on(
    peer: any,
    handlerMap: IHandlerMap | Function | string,
    handler?: Function,
  ): void {
    const pair = this._eventHandlerMap.find((item) => item[0] === peer)
    let handlerResult: Function | IHandlerMap
    if (typeof handlerMap === 'string') {
      handlerResult = { [handlerMap]: handler! }
    } else {
      handlerResult = handlerMap
    }
    if (pair) {
      const existingMap = pair[1]
      if (libConfig.debug) {
        const msg = `[duplex-message]${this.constructor.name}`
        if (typeof existingMap === 'function') {
          console.warn(`${msg} general handler for`, peer, 'will be overridden by', handlerResult)
        } else if (typeof handlerResult === 'function') {
          console.warn(`${msg} existing handlers`, existingMap, 'for peer(', peer, ') will be overridden by general function', handlerResult)
        // @ts-ignore
        } else if (existingMap) {
          const newKeys = Object.keys(handlerResult)
          const oldKeys = Object.keys(existingMap)
          const overrideKeys = newKeys.filter((k) => oldKeys.indexOf(k) > -1)
          if (overrideKeys.length) {
            console.warn(`${msg} existing handlers of `, overrideKeys.join(','), 'for peer(', peer, ') will be overridden by handler', handlerResult)
          }
        }
      }
      // merge existing handler map
      // @ts-ignore
      pair[1] = typeof existingMap === 'function'
        ? handlerResult
        : typeof handlerResult === 'function'
          ? handlerResult
          : ({ ...existingMap, ...handlerResult })

      return
    }
    this._eventHandlerMap[peer === '*' ? 'unshift' : 'push']([
      peer,
      handlerResult,
    ])
  }

  protected _off(peer: any, methodName?: string) {
    const index = this._eventHandlerMap.findIndex((pair) => pair[0] === peer)
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

  protected async _onMessage(peer: any, msg: any) {
    if (!msg || msg.fromInstance === this.instanceID) return
    if (!this._isRequest(msg)) {
      this._runResponseCallback(msg)
      return
    }

    if (!this._getMsgHandler(peer, msg)) {
      return
    }

    this.sendMessage(
      peer,
      this._buildProgressMessage(CONTINUE_INDICATOR, msg),
    )

    let response: IResponse | false
    try {
      response = await this._runMsgHandler(peer, msg)
      if (response === false) return
    } catch (error) {
      response = error
    }
    // @ts-ignore
    this.sendMessage(peer, response)
  }

  protected _runResponseCallback(resp: IResponse) {
    let ret = 0
    const idx = this._responseCallbacks.findIndex((fn) => {
      ret = fn(resp)
      return Boolean(ret)
    })
    if (idx >= 0) {
      // need to be continued
      if (ret > 1) return true
      this._responseCallbacks.splice(idx, 1)
      // timeout, in case of any delays
      setTimeout(() => {
        delete this._designedResponse[resp.messageID]
      }, 100)
      return true
    }
    return false
  }

  async _runMsgHandler(peer: any, reqMsg: IRequest) {
    const msgInfo = this._getMsgHandler(peer, reqMsg)
    const { methodName, args } = reqMsg
    if (!msgInfo) {
      return false
    }

    const newArgs = args.slice(0)
    if (reqMsg.progress && newArgs[0]) {
      const newArg = { ...newArgs[0] }
      newArg.onprogress = (data: any) => {
        this.sendMessage(peer, this._buildProgressMessage(data, reqMsg))
      }
      newArgs[0] = newArg
    }

    const [method, isGeneral] = msgInfo
    // add methodName as the first argument if handlerMap is a function
    if (isGeneral) {
      newArgs.unshift(methodName)
    }
    try {
      // eslint-disable-next-line prefer-spread
      const data = await method.apply(null, newArgs)
      return this._buildRespMessage(data, reqMsg, true)
    } catch (error) {
      if (libConfig.debug) {
        console.warn('[duplex-message] run handler error', method, 'with arguments', newArgs)
      }
      const data = {
        code: EErrorCode.HANDLER_EXEC_ERROR,
        message: error.message || error.stack,
      }
      throw this._buildRespMessage(data, reqMsg, false)
    }
  }

  protected _getMsgHandler(peer: any, reqMsg: IRequest): [Function, boolean] | false {
    const getHandler = (
      methodName: string,
      handlerTuple?: [any, Function | IHandlerMap] | false,
    ): [Function, boolean] | false => {
      if (!handlerTuple) return false
      const handlerMap = handlerTuple[1]
      if (!handlerMap) return false
      if (typeof handlerMap === 'function') {
        return [handlerMap, true]
      }
      if (typeof handlerMap[methodName] === 'function') {
        return [handlerMap[methodName], false]
      }
      return false
    }
    const { methodName } = reqMsg
    const result = getHandler(
      methodName, this._eventHandlerMap.find((wm) => wm[0] === peer),
    )
    if (result) return result
    return getHandler(methodName,
      this._eventHandlerMap[0]
        && this._eventHandlerMap[0][0] === '*'
        && this._eventHandlerMap[0])
  }

  protected _emit(
    peer: any,
    methodName: string | IMethodNameConfig,
    ...args: any[]
  ) {
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
              console.warn(
                '[duplex-message] progress callback for',
                reqMsg,
                'response',
                response,
                ', error:',
                error,
              )
            }
          }
          return 2
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        response.isSuccess ? resolve(response.data) : reject(response.data)
        return 1
      }
      this._listenResponse(peer, reqMsg, callback)
    })
    try {
      this.sendMessage(peer, AbstractHub._normalizeRequest(peer, reqMsg))
    } catch (error) {
      console.warn(
        '[duplex-message] unable to serialize message, message not sent',
        error,
      )
      return Promise.reject({
        code: EErrorCode.INVALID_MESSAGE,
        message: 'unable to send message',
      })
    }
    return result
  }

  /**
   * should get response from peer and pass response to callback
   * callback handled via onMessageReceived
   *  returns:  0 not a corresponding response
   *            1 corresponding response and everything get proceeded
   *            2 corresponding response and need waiting for rest responses
   */
  protected _listenResponse(
    peer: any,
    reqMsg: IRequest,
    callback: (resp: IResponse | IProgress) => number,
    withoutWrapper = false,
  ) {
    const wrappedCallback = withoutWrapper
      ? callback : AbstractHub._wrapCallback(this, reqMsg, callback)

    this._responseCallbacks.push(wrappedCallback)
    // timeout when no response, callback get a failure
    setTimeout(() => {
      if (this._designedResponse[reqMsg.messageID]) return
      const resp = this._buildRespMessage(
        { code: EErrorCode.TIMEOUT, message: 'timeout or no handler found' },
        reqMsg,
        false,
      )
      this._runResponseCallback(resp)
    }, this._waitTimeout)
  }

  protected static _wrapCallback(instance: AbstractHub, reqMsg: IRequest, callback: Function) {
    return (resp: IResponse | IProgress) => {
      const designedPeerID = instance._designedResponse[reqMsg.messageID]
      // ignore not designed resp
      if (designedPeerID && resp && resp.fromInstance !== designedPeerID) {
        if (
          libConfig.debug
          && instance._isProgress(reqMsg, resp)
          && resp.data === CONTINUE_INDICATOR
        ) {
          console.warn(
            '[duplex-message] message',
            reqMsg.methodName,
            'already processing, but handled by another peer',
            resp.fromInstance,
          )
        }
        /** ignore */
        return 0
      }

      if (instance._isProgress(reqMsg, resp) && resp.data === CONTINUE_INDICATOR) {
        if (!designedPeerID) {
          // eslint-disable-next-line no-param-reassign
          instance._designedResponse[reqMsg.messageID] = resp.fromInstance
        }
        /** continue */
        return 2
      }
      return callback(resp)
    }
  }

  // normalize progress callback on message
  protected static _normalizeRequest(peer: any, msg: IRequest) {
    // skip if peer is *
    if (peer === '*' || !msg.progress) {
      // eslint-disable-next-line no-param-reassign
      delete msg.progress
      return msg
    }
    const options = msg.args[0]
    const newMsg = { ...msg }
    newMsg.args = newMsg.args.slice()
    const copied = { ...options }
    delete copied.onprogress
    newMsg.args[0] = copied
    return newMsg
  }

  protected _buildReqMessage(
    methodName: string | IMethodNameConfig,
    args: any[],
  ): IRequest {
    const basicCfg = typeof methodName === 'string' ? { methodName } : methodName
    const options = args[0]
    const progress = Boolean(
      options && typeof options.onprogress === 'function',
    )
    // @ts-ignore
    return Object.assign(basicCfg, {
      fromInstance: this.instanceID,
      // toInstance,
      // eslint-disable-next-line no-plusplus
      messageID: ++this._messageID,
      type: 'request',
      args,
      progress,
    })
  }

  protected _buildRespMessage(
    data: any,
    reqMsg: IRequest,
    isSuccess: boolean,
  ): IResponse {
    return {
      fromInstance: this.instanceID,
      toInstance: reqMsg.fromInstance,
      messageID: reqMsg.messageID,
      type: 'response',
      isSuccess,
      data,
    }
  }

  protected _buildProgressMessage(data: any, reqMsg: IRequest): IProgress {
    return {
      fromInstance: this.instanceID,
      toInstance: reqMsg.fromInstance,
      messageID: reqMsg.messageID,
      type: 'progress',
      data,
    }
  }

  protected _isRequest(reqMsg: any): reqMsg is IRequest {
    return Boolean(
      reqMsg
        && reqMsg.fromInstance
        && reqMsg.fromInstance !== this.instanceID
        && (!reqMsg.toInstance || reqMsg.toInstance === this.instanceID)
        && reqMsg.messageID
        && reqMsg.type === 'request',
    )
  }

  protected _isResponse(reqMsg: IRequest, respMsg: any): respMsg is IResponse {
    return (
      reqMsg
      && respMsg
      && respMsg.toInstance === this.instanceID
      && respMsg.toInstance === reqMsg.fromInstance
      && respMsg.messageID === reqMsg.messageID
      && respMsg.type === 'response'
    )
  }

  protected _isProgress(reqMsg: IRequest, respMsg: any): respMsg is IProgress {
    return (
      reqMsg
      && respMsg
      && respMsg.toInstance === this.instanceID
      && respMsg.toInstance === reqMsg.fromInstance
      && respMsg.messageID === reqMsg.messageID
      && respMsg.type === 'progress'
    )
  }

  static generateInstanceID() {
    return Array(3)
      .join(`${Math.random().toString(36).slice(2)}-`)
      .slice(0, -1)
  }
}
