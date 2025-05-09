export type IFn = (...args: any[]) => any

export type IHandlerMap = Record<string, IFn[] | IFn>

type IHandlerMapInner = Record<string, IFn[]>
export interface IMessageBase<T> {
  /**
   * message source, peer id
   */
  from: string
  /**
   * message target, peer id
   */
  to?: string
  /**
   * message id
   */
  messageID: number
  /**
   * message type
   */
  type: 'request' | 'response' | 'progress'
  /**
   * message data
   */
  data: T
}

/**
 * request message
 */
export interface IRequest<T extends any[] = any[]> extends IMessageBase<T> {
  /**
   * message target, peer id
   * * empty for default behavior, may vary in different implementations
   */
  to?: string
  /**
   * message type
   */
  type: 'request'
  /**
   * method name
   */
  methodName: string,
  /**
   * method arguments
   */
  data: T
  /**
   * whether message need progress callback
   */
  progress?: boolean
}

export interface IResponse<T = any> extends IMessageBase<T> {
  to: string
  type: 'response'
  /**
   * whether response is success
   */
  isSuccess: boolean
  /**
   * response data
   */
  data: T
}

export interface IProgress<T = any> extends IMessageBase<T> {
  to: string
  type: 'progress'
  data: T
}

/** enum of error code */
export const enum EErrorCode {
  /** handler on other side encounter an error  */
  HANDLER_EXEC_ERROR = 1,
  /** peer not found */
  PEER_NOT_FOUND = 2,
  /** method not found in peer */
  METHOD_NOT_FOUND = 3,
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
  /** peer instance id */
  to?: string
  [k: string]: any
}

export function setConfig() {
  console.log('[duplex-message] setConfig is deprecated, please remove it')
}

/**
 * heartbeat message
 */
const CONTINUE_INDICATOR = '--message-hub-to-be-continued--'
/**
 * timeout for waiting heartbeat message
 */
const DEFAULT_HEARTBEAT_WAIT_TIMEOUT = 500

/**
 * enable debug mode when env `NODE_ENV` is not production
 */
const ENABLE_DEBUG = typeof process !== 'undefined'
  && process.env.NODE_ENV !== 'production'

export interface IAbstractHubOptions {
  /**
   * custom instance id
   */
  instanceID?: string | null
  /**
   * timeout(milliseconds) for waiting heartbeat message, default 500ms
   * 1. A heartbeat message will be sent to peer immediately when a request message is received 
   *    and there is at least one handler for it. Or the `emit` method will catch a no handler error
   *    It has nothing to do with the time of handler execution, there is no timeout
   *    for handler execution
   * 2. Normally, a heartbeat message will be sent to peer in less then 10 ms,
   *    but you may still need to set a longer timeout if browser is heavy loaded
   *    and the native apis are slow
   */
  heartbeatTimeout?: number
}

export abstract class AbstractHub {
  /**
   * hub instance
   */
  readonly instanceID: string

  protected _responseCallbackMap: Record<string, (...args: any[]) => number>

  protected _messageID: number

  /**
   * message handler map
   *  array item struct: eventTarget, {eventName: eventHandler } | handler4AllEvents
   */
  protected readonly _eventHandlerMap: Array<[any, IHandlerMapInner | IFn]>

  /**
   * designed response map
   *  key: messageID
   *  value: instanceID which respond the heartbeat message earliest
   */
  protected _designedResponse: Record<string, string>

  /**
   * timeout for waiting heartbeat message
   */
  protected _heartbeatTimeout: number

  /**
   * inner props to store whether instance is destroyed
   */
  protected isDestroyed: boolean

  /**
   * init Hub, subclass should implement its own constructor
   */
  constructor(options?: IAbstractHubOptions) {
    this.instanceID = (options && options.instanceID) || AbstractHub.generateInstanceID()
    this._eventHandlerMap = []
    this._responseCallbackMap = {}
    this._messageID = 0
    this._designedResponse = {}
    this._heartbeatTimeout = (options && options.heartbeatTimeout) || DEFAULT_HEARTBEAT_WAIT_TIMEOUT
    this.isDestroyed = false
    if (ENABLE_DEBUG) {
      console.log(`[duplex-message] create instance of ${this.constructor.name}, instanceID: ${this.instanceID}`)
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
  abstract emit(...args: any[]): Promise<any>

  /**
   * subclass' own send message method, should send msg to peer
   * @param peer peer to receive message. if only one/no specified peer, peer will be *
   * @param msg message send to peer
   */
  protected abstract sendMessage(
    peer: any,
    msg: IRequest | IProgress | IResponse
  ): void

  /**
   * check whether instance is usable
   */
  protected checkInstance() {
    if (this.isDestroyed) throw new Error('instance has been destroyed')
  }

  /**
   * add listener for peer
   */
  protected _on(peer: any, handlerMap: IFn | IHandlerMap): void;
  protected _on(peer: any, methodName: string, handler: IFn): void;
  protected _on(
    peer: any,
    handlerMap: IHandlerMap | IFn | string,
    handler?: IFn,
  ): void {
    this.checkInstance()
    const pair = this.getEventHandlers(peer)
    let handlerResult: IFn | IHandlerMap
    if (typeof handlerMap === 'string') {
      handlerResult = { [handlerMap]: [handler!] }
    } else {
      handlerResult = handlerMap
    }
    if (pair) {
      const existingMap = pair[1]
      if (ENABLE_DEBUG) {
        const msg = `[duplex-message]${this.constructor.name}`
        if (typeof existingMap === 'function') {
          console.warn(`${msg} general handler for`, peer, 'will be overridden by', handlerResult)
        } else if (typeof handlerResult === 'function') {
          console.warn(`${msg} existing handlers`, existingMap, 'for peer(', peer, ') will be overridden by general function', handlerResult)
        }
      }
      // merge existing handler map
      pair[1] = typeof handlerResult === 'function'
        ? handlerResult
        : AbstractHub.mergeEventMap(typeof existingMap === 'function' ? {} : existingMap || {}, handlerResult)

      return
    }
    /**
     * * for general handler, will be executed if no specific handler found
     */
    this._eventHandlerMap[peer === '*' ? 'unshift' : 'push']([
      peer,
      typeof handlerResult === 'function'
        ? handlerResult
        : AbstractHub.mergeEventMap({}, handlerResult),
    ])
  }

  protected _off(peer: any, methodName?: string, handler?: IFn): void {
    this.checkInstance()
    const index = this._eventHandlerMap.findIndex((pair) => pair[0] === peer)
    if (index === -1) return
    if (!methodName) {
      this._eventHandlerMap.splice(index, 1)
      return
    }
    const handlerMap = this._eventHandlerMap[index][1]
    if (typeof handlerMap !== 'object') return
    const handlers = handlerMap[methodName]
    if (!handlers) return
    if (typeof handler === 'function') {
      handlerMap[methodName] = handlers.filter((fn: IFn) => fn !== handler)
      if (!handlerMap[methodName].length) {
        delete handlerMap[methodName]
      }
    } else {
      delete handlerMap[methodName]
    }
    // nothing left
    if (!Object.keys(handlerMap).length) {
      this._eventHandlerMap.splice(index, 1)
    }
  }

  /** destroy instance  */
  destroy() {
    this._eventHandlerMap.length = 0
    this._responseCallbackMap = {}
    this._designedResponse = {}
    this.isDestroyed = true
  }

  /**
   * listen message from peer
   */
  protected async onMessage(peer: any, msg: any) {
    this.checkInstance()
    if (!this.isMessage(msg)) return
    // then it is a response or progress message
    if (!this.isRequestMessage(msg)) {
      // @ts-expect-error ignore
      this.runResponseCallback(msg)
      return
    }
    // then it is a request message from a peer

    // check if there is a handler for the request message
    const callbackInfo = this.getMessageCallbacks(peer, msg)

    if (!callbackInfo) {
      return
    }
    // send a heartbeat message to peer, in case of response takes too long
    this.sendMessage(
      peer,
      this.buildProgressMessage(CONTINUE_INDICATOR, msg),
    )

    const response = await this.runMessageCallbacks(peer, callbackInfo, msg)
    this.sendMessage(peer, response)
  }

  protected runResponseCallback(resp: IResponse | IProgress) {
    const callback = this._responseCallbackMap[resp.messageID]
    if (!callback) return false
    const ret = callback(resp)
    // not match
    if (!ret) return false
    // need to be continued
    if (ret > 1) return true
    // done
    // clean up
    delete this._responseCallbackMap[resp.messageID]
    delete this._designedResponse[resp.messageID]
    return true
  }

  /**
   * run message's callbacks when receive request from peer
   * * first none undefined response will be returned
   * * if all callbacks occur error, the last error will be returned
   * * if at least one callback success, and no none undefined response,  
   *  success response(undefined) will be returned
   */
  protected runMessageCallbacks(
    peer: any,
    callbackInfo: NonNullable<ReturnType<typeof AbstractHub.getMethodCallbacks>>,
    reqMsg: IRequest
  ) {
    const { methodName, data } = reqMsg
    const [method, isGeneral] = callbackInfo
    const newArgs = data.slice(0)
    if (reqMsg.progress && newArgs[0]) {
      const newArg = { ...newArgs[0] }
      newArg.onprogress = (d: any) => {
        this.sendMessage(peer, this.buildProgressMessage(d, reqMsg))
      }
      newArgs[0] = newArg
    }
    let methods: IFn[]

    // add methodName as the first argument if handlerMap is a function
    if (isGeneral) {
      newArgs.unshift(methodName)
      methods = [method]
    } else {
      methods = method
    }
    let responded = false
    let lastError: IError | undefined
    let hasSuccess = false
    let count = 0

    return new Promise<IResponse>((resolve) => {
      methods.forEach(async (fn) => {
        if (typeof fn !== 'function') {
          console.warn('[duplex-message] invalid method', method, 'for', methodName)
        } else {
          try {
            // eslint-disable-next-line no-await-in-loop
            const res = await fn(...newArgs)
            if (res !== undefined && !responded) {
              resolve(this._buildRespMessage(res, reqMsg, true))
              responded = true
            }
            hasSuccess = true
          } catch (error) {
            if (ENABLE_DEBUG) {
              console.warn('[duplex-message] run handler error', method, 'with arguments', newArgs, error)
            }
            if (responded) return
            // error object may be untransferable via postMessage, so it will be ignored
            lastError = {
              code: EErrorCode.HANDLER_EXEC_ERROR,
              // @ts-expect-error ignore
              message: error.message || error.stack,
            }
          }
        }
        count += 1
        if (!responded && count === methods.length) {
          resolve(this._buildRespMessage(hasSuccess ? undefined : lastError, reqMsg, hasSuccess))
        }
      })
    })
  }

  /**
   * get message callbacks
   * * return a tuple of [callbacks, isGeneral], or undefined when no callbacks found
   * * when General is true, callbacks will receive methodName as the first argument  
   */
  protected getMessageCallbacks(peer: any, reqMsg: IRequest) {
    const { methodName } = reqMsg
    if (!this._eventHandlerMap.length) return undefined
    const result = AbstractHub.getMethodCallbacks(
      methodName, this.getEventHandlers(peer),
    )
    if (result) return result
    if (this._eventHandlerMap[0][0] !== '*') return undefined
    return AbstractHub.getMethodCallbacks(methodName, this._eventHandlerMap[0])
  }

  protected getEventHandlers(peer: any) {
    return this._eventHandlerMap.find((wm) => wm[0] === peer)
  }

  protected _emit<ResponseType>(
    peer: any,
    methodName: string | IMethodNameConfig,
    ...args: any[]
  ) {
    this.checkInstance()
    const reqMsg = this.buildReqMessage(methodName, args)
    const result = new Promise<ResponseType>((resolve, reject) => {
      // 0 for not match
      // 1 for response, done
      // 2 for progress, need to be continue
      const callback = (response: IResponse | IProgress) => {
        if (this.isProgressMessage(reqMsg, response)) {
          try {
            reqMsg.data[0].onprogress(response.data)
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
          return 2
        }
        if (this.isResponseMessage(reqMsg, response)) {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          response.isSuccess ? resolve(response.data) : reject(response.data)
          return 1
        }
        return 0
      }
      this.listenResponse(peer, reqMsg, callback)
    })
    try {
      this.sendMessage(peer, AbstractHub.normalizeRequest(peer, reqMsg))
    } catch (error) {
      if (ENABLE_DEBUG) {
        console.warn(
          '[duplex-message] unable to serialize message, message not sent',
          error, ', message:', reqMsg,
        )
      }
      delete this._responseCallbackMap[reqMsg.messageID]
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
  protected listenResponse(
    peer: any,
    reqMsg: IRequest,
    callback: (resp: IResponse | IProgress) => number,
    // withoutWrapper = false,
  ) {
    const wrappedCallback = AbstractHub.wrapResponseCallback(this, reqMsg, callback)

    this._responseCallbackMap[reqMsg.messageID] = wrappedCallback
    // timeout when no response, callback get a failure
    setTimeout(() => {
      if (this._designedResponse[reqMsg.messageID]) return
      const resp = this._buildRespMessage(
        { code: EErrorCode.METHOD_NOT_FOUND, message: `no corresponding handler found for method ${reqMsg.methodName}` },
        reqMsg,
        false,
      )
      this.runResponseCallback(resp)
    }, this._heartbeatTimeout)
  }

  protected buildReqMessage(
    methodName: string | IMethodNameConfig,
    args: any[],
  ): IRequest {
    const basicCfg = typeof methodName === 'string' ? { methodName } : methodName
    const options = args[0]
    const progress = Boolean(
      options && typeof options.onprogress === 'function',
    )

    return Object.assign(basicCfg, {
      from: this.instanceID,
      // toInstance,
      // eslint-disable-next-line no-plusplus
      messageID: ++this._messageID,
      type: 'request' as const,
      data: args,
      progress,
    })
  }

  protected _buildRespMessage(
    data: any,
    reqMsg: IRequest,
    isSuccess: boolean,
  ): IResponse {
    return {
      from: this.instanceID,
      to: reqMsg.from,
      messageID: reqMsg.messageID,
      type: 'response',
      isSuccess,
      data,
    }
  }

  protected buildProgressMessage(data: any, reqMsg: IRequest): IProgress {
    return {
      from: this.instanceID,
      to: reqMsg.from,
      messageID: reqMsg.messageID,
      type: 'progress',
      data,
    }
  }

  protected isMessage(msg: any): msg is IMessageBase<any> {
    return msg
      && (msg.to === this.instanceID || !msg.to)
      && msg.messageID
      && msg.from
      && msg.type
  }

  protected isRequestMessage(msg: any): msg is IRequest {
    return this.isMessage(msg)
      && msg.from !== this.instanceID
      && msg.type === 'request'
      && (!msg.to || msg.to === this.instanceID)
  }

  protected isResponseMessage(reqMsg: IRequest, msg: any): msg is IResponse {
    return this.isMessage(msg)
      && msg.to === this.instanceID
      && msg.to === reqMsg.from
      && msg.messageID === reqMsg.messageID
      && msg.type === 'response'
  }

  protected isProgressMessage(reqMsg: IRequest, msg: any): msg is IProgress {
    return this.isMessage(msg)
      && msg.to === this.instanceID
      && msg.to === reqMsg.from
      && msg.messageID === reqMsg.messageID
      && msg.type === 'progress'
  }

  protected static wrapResponseCallback(
    instance: AbstractHub,
    reqMsg: IRequest,
    callback: IFn,
  ) {
    return (resp: IResponse | IProgress) => {
      if (!instance.isMessage(resp)) return 0
      const designedPeerID = instance._designedResponse[reqMsg.messageID]
      // ignore not designed resp
      if (designedPeerID && resp.from !== designedPeerID) {
        if (
          ENABLE_DEBUG
          && instance.isProgressMessage(reqMsg, resp)
          && resp.data === CONTINUE_INDICATOR
        ) {
          console.warn(
            '[duplex-message] message',
            reqMsg.methodName,
            'already processing, but handled by another peer',
            designedPeerID, ', message', resp, 'will be ignored',
          )
        }
        /** ignore */
        return 0
      }

      if (instance.isProgressMessage(reqMsg, resp) && resp.data === CONTINUE_INDICATOR) {
        if (!designedPeerID) {
          // eslint-disable-next-line no-param-reassign
          instance._designedResponse[reqMsg.messageID] = resp.from
        }
        /** continue */
        return 2
      }
      return callback(resp)
    }
  }

  /**
   * normalize progress callback on message
   * * remove onprogress in first argument
   */
  protected static normalizeRequest(peer: any, msg: IRequest) {
    // skip if peer is *
    if (peer === '*' || !msg.progress) {
      return msg
    }
    const options = msg.data[0]
    const newMsg = { ...msg }
    newMsg.data = newMsg.data.slice()
    const copied = { ...options }
    delete copied.onprogress
    newMsg.data[0] = copied
    return newMsg
  }

  protected static getMethodCallbacks(methodName: string,
    handlerTuple?: [any, IFn | IHandlerMapInner]): [IFn[], false] | [IFn, true] | undefined {
    if (!handlerTuple) return undefined
    const handlerMap = handlerTuple[1]
    if (!handlerMap) return undefined
    if (typeof handlerMap === 'function') {
      return [handlerMap, true]
    }
    const callbacks = handlerMap[methodName]
    return callbacks ? [callbacks, false] : undefined
  }

  protected static generateInstanceID() {
    return Array(3)
      .join(`${Math.random().toString(36).slice(2)}-`)
      .slice(0, -1)
  }

  private static mergeEventMap(
    existingMap: IHandlerMapInner,
    newMap: IHandlerMap,
  ): IHandlerMapInner {
    const result = { ...existingMap }
    const newKeys = Object.keys(newMap)
    newKeys.forEach((key) => {
      const callbacks = Array.isArray(newMap[key]) ? newMap[key] : [newMap[key]]
      if (existingMap[key]) {
        result[key].push(...callbacks)
      } else {
        result[key] = callbacks
      }
    })
    return result
  }
}
