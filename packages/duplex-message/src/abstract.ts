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
  /** Explicitly separates heartbeat control messages from business progress. */
  heartbeat?: boolean
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
  /** the caller aborted the request */
  REQUEST_ABORTED = 6,
  /** the request exceeded its configured deadline */
  REQUEST_TIMEOUT = 7,
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
  /** Abort waiting locally; does not cancel the peer's handler. */
  signal?: AbortSignal
  /** Total request deadline in milliseconds; 0 disables it. Overrides the hub default. */
  requestTimeout?: number
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
   *    This only bounds heartbeat wait. Use requestTimeout to bound the total request.
   * 2. Normally, a heartbeat message will be sent to peer in less then 10 ms,
   *    but you may still need to set a longer timeout if browser is heavy loaded
   *    and the native apis are slow
   */
  heartbeatTimeout?: number
  /** Total request deadline in milliseconds, including heartbeat wait. Default 0 (disabled). */
  requestTimeout?: number
}

interface IPendingRequest {
  peer: any
  reject: (error: IError) => void
  heartbeatTimer?: ReturnType<typeof setTimeout>
  requestTimer?: ReturnType<typeof setTimeout>
  abortCleanup?: () => void
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

  protected readonly _requestTimeout: number

  /**
   * inner props to store whether instance is destroyed
   */
  protected isDestroyed: boolean

  private readonly _pendingRequests = new Map<number, IPendingRequest>()

  private readonly _pendingPeerCounts = new Map<any, number>()

  /**
   * init Hub, subclass should implement its own constructor
   */
  constructor(options?: IAbstractHubOptions) {
    this.instanceID = (options && options.instanceID) || AbstractHub.generateInstanceID()
    this._eventHandlerMap = []
    this._responseCallbackMap = Object.create(null)
    this._messageID = 0
    this._designedResponse = Object.create(null)
    this._heartbeatTimeout = options?.heartbeatTimeout || DEFAULT_HEARTBEAT_WAIT_TIMEOUT
    this._requestTimeout = options?.requestTimeout ?? 0
    if (!AbstractHub.isValidRequestTimeout(this._requestTimeout)) {
      throw new RangeError('requestTimeout must be a finite number between 0 and 2147483647')
    }
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
    if (this.isDestroyed) return
    this.isDestroyed = true
    for (const [messageID, pending] of this._pendingRequests) {
      pending.reject({ code: EErrorCode.UNKNOWN, message: 'instance has been destroyed' })
      this.clearPendingRequest(messageID)
    }
    this._eventHandlerMap.length = 0
    this._responseCallbackMap = Object.create(null)
    this._designedResponse = Object.create(null)
  }

  /**
   * listen message from peer
   */
  protected async onMessage(peer: any, msg: any) {
    if (this.isDestroyed) return
    if (!this.isMessage(msg)) return
    // then it is a response or progress message
    if (!this.isRequestMessage(msg)) {
      this.runResponseCallback(msg as IResponse | IProgress, peer)
      return
    }
    // then it is a request message from a peer

    // check if there is a handler for the request message
    const callbackInfo = this.getMessageCallbacks(peer, msg)

    if (!callbackInfo) {
      return
    }
    // send a heartbeat message to peer, in case of response takes too long
    try {
      this.sendMessage(peer, this.buildProgressMessage(CONTINUE_INDICATOR, msg, true))
      const response = await this.runMessageCallbacks(peer, callbackInfo, msg)
      if (this.isDestroyed) return
      try {
        this.sendMessage(peer, response)
      } catch {
        this.sendMessage(peer, this._buildRespMessage({
          code: EErrorCode.INVALID_MESSAGE,
          message: 'unable to send response',
        }, msg, false))
      }
    } catch (error) {
      // Native event listeners cannot consume a rejected async callback.
      if (ENABLE_DEBUG) console.warn('[duplex-message] unable to respond to message', error)
    }
  }

  protected runResponseCallback(resp: IResponse | IProgress, peer?: any) {
    if (peer !== undefined && this._pendingRequests.get(resp.messageID)?.peer !== peer) return false
    const callback = this._responseCallbackMap[resp.messageID]
    if (!callback) return false
    const ret = callback(resp)
    // not match
    if (!ret) return false
    // need to be continued
    if (ret > 1) {
      this.clearHeartbeatTimer(resp.messageID)
      return true
    }
    // done
    // clean up
    this.clearPendingRequest(resp.messageID)
    return true
  }

  private clearHeartbeatTimer(messageID: number) {
    const pending = this._pendingRequests.get(messageID)
    if (pending?.heartbeatTimer !== undefined) {
      clearTimeout(pending.heartbeatTimer)
      pending.heartbeatTimer = undefined
    }
  }

  private clearPendingRequest(messageID: number) {
    const pending = this._pendingRequests.get(messageID)
    if (!pending) return
    // Remove state before invoking cleanup hooks so reentrant settlement is harmless.
    this._pendingRequests.delete(messageID)
    const { peer, heartbeatTimer, requestTimer, abortCleanup } = pending
    const count = this._pendingPeerCounts.get(peer)! - 1
    if (count) this._pendingPeerCounts.set(peer, count)
    else this._pendingPeerCounts.delete(peer)
    if (heartbeatTimer !== undefined) clearTimeout(heartbeatTimer)
    if (requestTimer !== undefined) clearTimeout(requestTimer)
    delete this._responseCallbackMap[messageID]
    delete this._designedResponse[messageID]
    abortCleanup?.()
    this.onRequestSettled(peer)
  }

  private rejectPendingRequest(messageID: number, error: IError) {
    const pending = this._pendingRequests.get(messageID)
    if (!pending) return
    pending.reject(error)
    this.clearPendingRequest(messageID)
  }

  protected hasPendingRequests(peer: any) {
    return this._pendingPeerCounts.has(peer)
  }

  /** Allow transports to release listeners once a peer has no pending calls. */
  protected onRequestSettled(_peer: any): void {}

  /** Attach transport listeners only when a request is ready to be sent. */
  protected onRequestStarted(_peer: any): void {}

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
        if (!this.isDestroyed) this.sendMessage(peer, this.buildProgressMessage(d, reqMsg))
      }
      newArgs[0] = newArg
    }
    let methods: IFn[]

    // add methodName as the first argument if handlerMap is a function
    if (isGeneral) {
      newArgs.unshift(methodName)
      methods = [method]
    } else {
      methods = method.slice()
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
            let message = 'handler threw an unreadable error'
            try {
              message = String(error instanceof Error ? error.message : (
                error && typeof error === 'object'
                  ? (error as { message?: unknown; stack?: unknown }).message
                    ?? (error as { stack?: unknown }).stack ?? error
                  : error
              ))
            } catch { /* Error objects can have throwing getters or no string conversion. */ }
            lastError = {
              code: EErrorCode.HANDLER_EXEC_ERROR,
              message,
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
    const controls = typeof methodName === 'string' ? undefined : methodName
    const requestTimeout = controls?.requestTimeout ?? this._requestTimeout
    const signal = controls?.signal
    if (!AbstractHub.isValidRequestTimeout(requestTimeout)
      || (signal !== undefined && (signal === null || typeof signal !== 'object'
        || typeof signal.aborted !== 'boolean'
        || typeof signal.addEventListener !== 'function'
        || typeof signal.removeEventListener !== 'function'))) {
      return Promise.reject({ code: EErrorCode.INVALID_MESSAGE, message: 'invalid requestTimeout or signal' })
    }
    if (signal?.aborted) {
      return Promise.reject({ code: EErrorCode.REQUEST_ABORTED, message: 'request has been aborted' })
    }
    const reqMsg = this.buildReqMessage(methodName, args)
    const result = new Promise<ResponseType>((resolve, reject) => {
      const pending: IPendingRequest = { peer, reject }
      this._pendingRequests.set(reqMsg.messageID, pending)
      this._pendingPeerCounts.set(peer, (this._pendingPeerCounts.get(peer) || 0) + 1)
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
      try {
        this.listenResponse(peer, reqMsg, callback)
        if (requestTimeout > 0) {
          const timer = setTimeout(() => {
            this.rejectPendingRequest(reqMsg.messageID, {
              code: EErrorCode.REQUEST_TIMEOUT,
              message: `request timed out after ${requestTimeout}ms for method ${reqMsg.methodName}`,
            })
          }, requestTimeout)
          pending.requestTimer = timer
        }
        if (signal) {
          const abort = () => this.rejectPendingRequest(reqMsg.messageID, {
            code: EErrorCode.REQUEST_ABORTED,
            message: 'request has been aborted',
          })
          pending.abortCleanup = () => signal.removeEventListener('abort', abort)
          signal.addEventListener('abort', abort, { once: true })
          // Also handle cancellation that occurred during listener registration.
          if (signal.aborted) abort()
        }
      } catch {
        this.rejectPendingRequest(reqMsg.messageID, {
          code: EErrorCode.INVALID_MESSAGE,
          message: 'unable to set up request',
        })
      }
    })
    if (!this._pendingRequests.has(reqMsg.messageID)) return result
    try {
      this.onRequestStarted(peer)
      this.sendMessage(peer, AbstractHub.normalizeRequest(peer, reqMsg))
    } catch (error) {
      if (ENABLE_DEBUG) {
        console.warn(
          '[duplex-message] unable to serialize message, message not sent',
          error, ', message:', reqMsg,
        )
      }
      this.rejectPendingRequest(reqMsg.messageID, {
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
    const timer = setTimeout(() => {
      const resp = this._buildRespMessage(
        { code: EErrorCode.METHOD_NOT_FOUND, message: `no corresponding handler found for method ${reqMsg.methodName}` },
        reqMsg,
        false,
      )
      callback(resp)
      this.clearPendingRequest(reqMsg.messageID)
    }, this._heartbeatTimeout)
    this._pendingRequests.get(reqMsg.messageID)!.heartbeatTimer = timer
  }

  protected buildReqMessage(
    methodName: string | IMethodNameConfig,
    args: any[],
  ): IRequest {
    const basicCfg: IMethodNameConfig = typeof methodName === 'string' ? { methodName } : methodName
    // These controls belong to the caller and must never be serialized to the peer.
    const { signal: _signal, requestTimeout: _requestTimeout, ...messageConfig } = basicCfg
    const options = args[0]
    const progress = Boolean(
      options && typeof options.onprogress === 'function',
    )

    return {
      ...messageConfig,
      from: this.instanceID,
      // toInstance,
      // eslint-disable-next-line no-plusplus
      messageID: ++this._messageID,
      type: 'request' as const,
      data: args,
      progress,
    }
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

  protected buildProgressMessage(data: any, reqMsg: IRequest, heartbeat = false): IProgress {
    return {
      from: this.instanceID,
      to: reqMsg.from,
      messageID: reqMsg.messageID,
      type: 'progress',
      heartbeat,
      data,
    }
  }

  protected isMessage(msg: any): msg is IMessageBase<any> {
    return !!(msg
      && typeof msg === 'object'
      && (msg.to === this.instanceID || !msg.to)
      && Number.isSafeInteger(msg.messageID) && msg.messageID > 0
      && typeof msg.from === 'string' && msg.from.length > 0
      && (msg.to === undefined || typeof msg.to === 'string')
      && (msg.type === 'request'
        ? typeof msg.methodName === 'string' && Array.isArray(msg.data)
        : msg.type === 'response' ? typeof msg.isSuccess === 'boolean'
          : msg.type === 'progress' && (msg.heartbeat === undefined || typeof msg.heartbeat === 'boolean')))
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

  private isHeartbeatMessage(reqMsg: IRequest, msg: IResponse | IProgress) {
    return this.isProgressMessage(reqMsg, msg)
      && (msg.heartbeat === true
        || (msg.heartbeat === undefined && msg.data === CONTINUE_INDICATOR))
  }

  protected static wrapResponseCallback(
    instance: AbstractHub,
    reqMsg: IRequest,
    callback: IFn,
  ) {
    return (resp: IResponse | IProgress) => {
      if (!instance.isMessage(resp)) return 0
      if (reqMsg.to && resp.from !== reqMsg.to) return 0
      const designedPeerID = instance._designedResponse[reqMsg.messageID]
      // ignore not designed resp
      if (designedPeerID && resp.from !== designedPeerID) {
        if (
          ENABLE_DEBUG
          && instance.isHeartbeatMessage(reqMsg, resp)
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

      if (instance.isHeartbeatMessage(reqMsg, resp)) {
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
    const callbacks = Object.prototype.hasOwnProperty.call(handlerMap, methodName)
      ? handlerMap[methodName] : undefined
    return callbacks?.length ? [callbacks, false] : undefined
  }

  protected static generateInstanceID() {
    return Array(3)
      .join(`${Math.random().toString(36).slice(2)}-`)
      .slice(0, -1)
  }

  private static isValidRequestTimeout(timeout: number) {
    return Number.isFinite(timeout) && timeout >= 0 && timeout <= 2147483647
  }

  private static mergeEventMap(
    existingMap: IHandlerMapInner,
    newMap: IHandlerMap,
  ): IHandlerMapInner {
    const result = Object.assign(Object.create(null), existingMap) as IHandlerMapInner
    const newKeys = Object.keys(newMap)
    newKeys.forEach((key) => {
      const callbacks = Array.isArray(newMap[key]) ? newMap[key] : [newMap[key]]
      const existing = Object.prototype.hasOwnProperty.call(existingMap, key) ? existingMap[key] : []
      result[key] = [...(existing || []), ...callbacks]
    })
    return result
  }
}
