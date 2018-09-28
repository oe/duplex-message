/** middleware define */
interface IMiddleware {
  (ctx: any, next: Function): any
}
/** worker route map */
interface IRouters {
  [k: string]: IMiddleware[]
}

/** param for route */
interface IRouteParam {
  [k: string]: IMiddleware[] | IMiddleware
}

/** event callback */
interface ICallback {
  (response: any): any
}

/** event callbacks map */
interface IEvtCallbacks {
  [k: string]: ICallback[]
}

/** message request */
interface IMessageRequest {
  // message id
  id: number
  type: 'request'
  channel: string
  data: any
  event: Event
  transfers?: any[]
}

/** message response */
interface IMessageResponse {
  id: number
  type: 'response'
  resolved: boolean
  channel: string
  data: any
  event: Event
}

/** message union */
type IMessage = IMessageRequest | IMessageResponse

/** promise pair to resolve response */
interface IPromisePairs {
  [k: number]: [Function, Function]
}

/** request context for middleware */
interface IContext {
  id: number
  type: 'request'
  channel: string
  request: any
  event: Event
  [k: string]: any
}


// @ts-ignore
const glb = self

/**
 * Worker Server Class
 */
export default class WorkerServer {
  // request count, to store  promise pair
  count: number = 0
  // worker object
  worker: any
  // global middlewares
  middlewares: IMiddleware[] = []
  // router map
  routers: IRouters = {}
  // event callbacks map
  evtsCbs: IEvtCallbacks = {}
  // promise pair map
  promisePairs: IPromisePairs = {}

  /** */
  constructor (src?: string) {
    //  detect is this code run in webworker context
    // tslint:disable-next-line
    const isWoker = typeof document === 'undefined'
    if (isWoker) {
      this.worker = glb
    } else {
      if (!src) {
        throw new Error('a src for worker script is required')
      }
      this.worker = new Worker(src)
    }
    this.onMessage = this.onMessage.bind(this)
    this.worker.addEventListener('message', this.onMessage)
  }
  /**
   * add global middleware
   * @param cb middleware
   */
  use (cb: IMiddleware) {
    this.middlewares.push(cb)
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
    if (typeof routers === 'string') {
      routers = {
        routers: cbs
      }
    }
    Object.keys(routers).forEach((k) => {
      let cbs = routers[k]
      if (!Array.isArray(cbs)) cbs = [cbs]
      if (!cbs.length) return
      if (!this.routers[k]) {
        this.routers[k] = []
      }
      this.routers[k].push(...cbs)
    })
  }

  /**
   * request other side for a response
   * @param channel channel name
   * @param data params to the channel
   * @param transfers object array want to transfer
   */
  fetch (channel: string, data: any, transfers?: any[]) {
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
  emit (channel: string, data: any, transfers?: any[]) {
    const msg = {
      type: 'request',
      channel,
      data,
      transfers
    } as IMessageRequest
    this.postMessage(msg, false)
  }

  /**
   * compose middlewares into one function
   *  copy form https://github.com/koajs/compose/blob/master/index.js
   * @param middlewares middlewares
   */
  protected composeMiddlewares (middlewares: IMiddleware[]) {
    return function (context: IContext, next?: Function) {
      // last called middleware #
      let index = -1
      return dispatch(0)
      function dispatch (i) {
        if (i <= index) return Promise.reject(new Error('next() called multiple times'))
        index = i
        let fn: Function | undefined = middlewares[i]
        if (i === middlewares.length) fn = next
        if (!fn) return Promise.resolve()
        try {
          return Promise.resolve(fn(context, dispatch.bind(null, i + 1)))
        } catch (err) {
          return Promise.reject(err)
        }
      }
    }
  }

  /**
   * create context used by middleware
   * @param evt message event
   */
  protected createContext (evt: MessageEvent) {
    const request = evt.data as IMessageRequest
    console.warn('evt', evt)
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
  protected async onMessage (evt: MessageEvent) {
    const request = evt.data as IMessage
    if (request.id) {
      if (request.type === 'response') {
        const promisePair = this.promisePairs[request.id]
        if (!promisePair) {
          console.warn('unowned message with id', request.id)
          return
        }
        const fn = promisePair[request.resolved ? 0 : 1]
        fn(request.data)
      } else {
        const cbs = [...this.middlewares]
        const routerCbs = this.routers[request.channel] || []
        cbs.push(...routerCbs)
        const ctx = this.createContext(evt)
        let resolved = true
        if (cbs.length) {
          const fnMiddlewars = this.composeMiddlewares(cbs)
          try {
            await fnMiddlewars(ctx)
          } catch (error) {
            resolved = false
          }
        } else {
          console.warn(`no corresponding router for ${request.channel}`)
        }
        const message = {
          resolved,
          id: ctx.id,
          channel: ctx.channel,
          type: 'response',
          data: ctx.response
        } as IMessageResponse
        this.postMessage(message)
      }
    } else {
      const cbs = this.evtsCbs[request.channel]
      if (!cbs || !cbs.length) {
        console.warn(`no corresponed callback for ${request.channel}`)
        return
      }
      for (let index = 0; index < cbs.length; index++) {
        const cb = cbs[index]
        if (cb(request.data) === false) break
      }
    }
  }

  /**
   * send message to the other side
   * @param message meesage object to send
   * @param needResp whether need response from other side
   */
  protected postMessage (message: IMessage, needResp?: boolean) {
    const requestData: any[] = [message]
    if (message.type === 'request') {
      message.id = needResp ? (++this.count) : 0
      const transfers = message.transfers
      delete message.transfers
      if (transfers) requestData.push(transfers)
    }
    this.worker.postMessage(...requestData)
    if (message.type === 'response' || !message.id) return
    return new Promise((resolve, reject) => {
      this.promisePairs[message.id] = [resolve, reject]
    })
  }
}