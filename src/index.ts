import Composie, { IRouteParam, IContext as IComposieContext, IMiddleware as IComposieMiddleware } from 'composie'

/** event callbacks map */
export interface IEvtCallbacks {
  [k: string]: ICallback[]
}

/** message request */
export interface IMessageRequest {
  /** request id */
  readonly id: number
  /** request type */
  readonly type: 'request'
  /** message channel (aka custom event name) */
  readonly channel: string
  /** message data which will be sent to the other side */
  readonly data: any
  /** object to transfer */
  readonly transfers?: any[]
}

/** message response */
export interface IMessageResponse {
  /** request id */
  readonly id: number
  /** request type */
  readonly type: 'response'
  /** is response successful */
  readonly resolved: boolean
  /** request channel(custom event name) */
  readonly channel: string
  /** responded data */
  readonly data: any
  /**
   * original message event  
   *  see https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent for details
   */
  readonly event: Event
}

/** message union */
export type IMessage = IMessageRequest | IMessageResponse

/** promise pair to resolve response */
interface IPromisePairs {
  [k: number]: [Function, Function]
}

/** request context for middleware */
export interface IContext extends IComposieContext {
  /** request id, should not modify it */
  readonly id: number
  /** request type  */
  readonly type: 'request'
  /**
   * original message event  
   *  see https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent for details
   */
  readonly event: MessageEvent
  /** response to the other side, this store the result you want to respond */
  response: any
}

/** event callback */
export interface ICallback {
  (response: any): any
}

// not using extends because typescript can't infer in type when write a real middleware
/** middleware */
export interface IMiddleware {
  (ctx: IContext, next?: Function): any
}

/** constructor init params for worker */
export interface IMsgInitWorker {
  type: 'worker'
  peer?: Worker
}
/** constructor init params for frame */
export interface IMsgInitIframe {
  type: 'frame'
  peer: Window
  targetOrigin?: string
}
/** constructor init params */
export type IMsgInit = IMsgInitWorker | IMsgInitIframe


const READY_CONFIG = {
  channel: 'THIS_IS_MESSAGE_SECRET_CHANNEL',
  id: -1
}

/**
 * MessageHub Class
 */
export default class MessageHub {
  // request count, to store  promise pair
  private count: number = 0
  // javascript context(global/window) object
  private context: any
  // the other side context to communicate with
  private peer: any
  // type of context
  private type: IMsgInit['type']
  // if type is worker, whether is in worker
  private isWorker: boolean = false
  // if type is frame, target origin, default any origin
  private targetOrigin: string = '*'
  // event callbacks map
  private evtsCbs: IEvtCallbacks = {}
  // promise pair map
  private promisePairs: IPromisePairs = {}
  // handle middlewares
  private composie: Composie | null
  // is peer ready
  private isReady: boolean = false

  constructor (options: IMsgInit) {
    this.composie = new Composie()
    this.context = self
    this.type = options.type
    if (options.type === 'worker') {
      this.isReady = true
      //  detect is this code run in webworker context
      // tslint:disable-next-line
      this.isWorker = typeof document === 'undefined'
      if (this.isWorker) {
        this.peer = self
      } else {
        if (!options.peer) {
          throw new Error('a worker instance is required')
        }
        this.peer = options.peer
        this.context = options.peer
      }
    } else if (options.type === 'frame') {
      this.peer = options.peer
      if (options.targetOrigin) this.targetOrigin = options.targetOrigin
    } else {
      // @ts-ignore
      throw new Error(`unsupported type ${options.type}`)
    }
    this.onMessage = this.onMessage.bind(this)
    this.context.addEventListener('message', this.onMessage)
    if (!this.isReady) this.emit(READY_CONFIG.channel)
  }

  /** 
   * wait for peer ready
   *  use it especially work with iframe
   * return a promise
   */
  ready () {
    if (!this.context) return Promise.reject(new Error('This MessageHub instance has been destroyed'))
    if (this.isReady) return Promise.resolve(this)
    return new Promise<MessageHub>((resolve, reject) => {
      this.fetch(READY_CONFIG.channel).then(() => {
        this.isReady = true
        resolve(this)
      }, reject)
    })
  }

  /**
   * add global middleware
   * @param cb middleware
   */
  use (cb: IMiddleware) {
    // @ts-ignore
    if (this.composie) this.composie.use(cb)
    return this
  }

  /**
   * add router
   * @param routers router map
   */
  route (routers: IRouteParam)
  /**
   * add router
   * @param channel channel name
   * @param cbs channel handlers
   */
  route (channel: string, ...cbs: IMiddleware[])
  route (routers: IRouteParam | string, ...cbs: IMiddleware[]) {
    if (!this.composie) return this
    if (typeof routers === 'string') {
      // @ts-ignore
      this.composie.route(routers, ...cbs)
    } else {
      this.composie.route(routers)
    }
    return this
  }

  /**
   * request other side for a response
   * @param channel channel name
   * @param data params to the channel
   * @param transfers object array want to transfer
   */
  fetch (channel: string, data?: any, transfers?: any[]) {
    const msg = {
      type: 'request',
      channel,
      data,
      transfers
    } as IMessageRequest
    return this.postMessage(msg, true)
  }

  /**
   * listen event from other side
   * @param channel channel name
   * @param cb callback function
   */
  on (channel: string, cb: ICallback) {
    if (!this.evtsCbs[channel]) {
      this.evtsCbs[channel] = []
    }
    this.evtsCbs[channel].push(cb)
  }

  /**
   * remove event listener
   * @param channel channel name
   * @param cb callback function
   */
  off (channel: string, cb?: ICallback) {
    if (!this.evtsCbs[channel] || !this.evtsCbs[channel].length) return
    if (!cb) {
      this.evtsCbs[channel] = []
      return
    }
    const cbs = this.evtsCbs[channel]
    let len = cbs.length
    while (len--) {
      if (cbs[len] === cb) {
        cbs.splice(len, 1)
        break
      }
    }
  }

  /**
   * emit event that will be listened from on
   * @param channel channel name
   * @param data params
   * @param transfers object array want to transfer
   */
  emit (channel: string, data?: any, transfers?: any[]) {
    const msg = {
      type: 'request',
      channel,
      data,
      transfers
    } as IMessageRequest
    this.postMessage(msg, false)
  }

  destroy () {
    if (!this.context) return
    this.context.removeEventListener('message', this.onMessage)
    this.evtsCbs = {}
    this.composie = null
    if (this.type === 'worker') {
      if (this.isWorker) {
        this.context.close()
      } else {
        this.context.terminate()
      }
    }
    this.context = null
    this.peer = null
  }

  /**
   * create context used by middleware
   * @param evt message event
   */
  protected createContext (evt: MessageEvent) {
    const request = evt.data as IMessageRequest
    const context = {
      id: request.id,
      type: 'request',
      channel: request.channel,
      request: request.data,
      event: evt
    } as IContext
    return context
  }

  /**
   * listen original message event
   * @param evt message event
   */
  protected onMessage (evt: MessageEvent) {
    // ignore untargeted cross iframe origin message
    if (this.type === 'frame' &&
      // message from self or origin not match
      ((evt.source && evt.source !== this.peer) || !this.isValidateOrigin(evt.origin))) return
    const request = evt.data as IMessage
    // ignore any other noises(not from MessageHub)
    if (!request || !this.composie || !request.channel) return
    if (request.id) {
      if (request.type === 'response') {
        this.resolveFetch(request)
      } else {
        const ctx = this.createContext(evt)
        // try to handle ready request
        if (this.resolveFetch(request)) {
          this.respond(ctx, true)
          return
        }
        this.composie.run(ctx).then(() => {
          this.respond(ctx, true)
        }, (error) => {
          console.warn('run middleware failed', error)
          this.respond(ctx, false)
        })
      }
    } else {
      // try handle ready 
      if (this.resolveFetch(request)) return
      const cbs = this.evtsCbs[request.channel]
      if (!cbs || !cbs.length) {
        console.warn('no corresponed callback for', request.channel)
        return
      }
      for (let index = 0; index < cbs.length; index++) {
        const cb = cbs[index]
        if (cb(request.data) === false) break
      }
    }
  }

  /** respond fetch request */
  private respond (ctx: IContext, resolved: boolean) {
    const message = {
      resolved: resolved,
      id: ctx.id,
      channel: ctx.channel,
      type: 'response',
      data: ctx.response
    } as IMessageResponse
    this.postMessage(message)
  }

  /** resolve fetch request */
  protected resolveFetch (msg: IMessage) {
    if (!msg.id ||
      msg.type === 'request' && msg.id !== READY_CONFIG.id) return
    const msgId = msg.id
    const promisePair = this.promisePairs[msgId]
    if (!promisePair) {
      if (msg.id === READY_CONFIG.id) return true
      console.warn('unowned message with id', msgId, msg)
      return
    }
    // @ts-ignore
    const fn = promisePair[msg.resolved !== false ? 0 : 1]
    fn(msg.data)
    delete this.promisePairs[msgId]
    return true
  }

  /**
   * validate origin in cross frame communicate is match
   * @param origin origin url
   */
  protected isValidateOrigin (origin) {
    return this.targetOrigin === '*' || origin === this.targetOrigin
  }

  protected postMessage (message: IMessage, needResp: true): Promise<any>
  protected postMessage (message: IMessage, needResp?: false): void
  /**
   * 
   * send message to the other side
   * @param message meesage object to send
   * @param needResp whether need response from other side
   */
  protected postMessage (message: IMessage, needResp?: boolean) {
    const requestData: any[] = [message]
    if (this.type === 'frame') {
      requestData.push(this.targetOrigin)
    }
    if (message.type === 'request') {
      // change ready message id
      // @ts-ignore
      message.id = message.channel === READY_CONFIG.channel
        ? READY_CONFIG.id :
        needResp ?
          (++this.count) : 0
      const transfers = message.transfers
      // @ts-ignore
      delete message.transfers
      if (transfers) requestData.push(transfers)
    }
    this.peer.postMessage(...requestData)
    if (message.type === 'response' || !message.id) return
    return new Promise<any>((resolve, reject) => {
      this.promisePairs[message.id] = [resolve, reject]
    })
  }
}
