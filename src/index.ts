/** middleware define */
interface IMiddleWare {
  (ctx: any, next: Function): any
}
/** worker route map */
interface IRouters {
  [k: string]: IMiddleWare[]
}

/** param for route */
interface IRouteParam {
  [k: string]: IMiddleWare[] | IMiddleWare
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
  method: string
  data: any
  event: Event
  transfers?: any[]
}

/** message response */
interface IMessageResponse {
  id: number
  type: 'response'
  resolved: boolean
  method: string
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
  method: string
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
  middlewares: IMiddleWare[] = []
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
  use (cb: IMiddleWare) {
    this.middlewares.push(cb)
  }

  /**
   * add router
   * @param routers router map
   */
  route (routers: IRouteParam)
  /**
   * add router
   * @param method method name
   * @param cbs method handlers
   */
  route (method: string, ...cbs: IMiddleWare[]) 
  route (routers: IRouteParam | string, ...cbs: IMiddleWare[]) {
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
   * @param method method name
   * @param data params to the method
   * @param transfers object array want to transfer
   */
  fetch (method: string, data: any, transfers?: any[]) {
    const msg = {
      type: 'request',
      method,
      data,
      transfers
    } as IMessageRequest
    return this.postMessage(msg, true)
  }

  /**
   * listen event from other side
   * @param method method name
   * @param cb callback function
   */
  on (method: string, cb: ICallback) {
    if (!this.evtsCbs[method]) {
      this.evtsCbs[method] = []
    }
    this.evtsCbs[method].push(cb)
  }

  /**
   * remove event listener
   * @param method method name
   * @param cb callback function
   */
  off (method: string, cb?: ICallback) {
    if (!this.evtsCbs[method] || !this.evtsCbs[method].length) return
    if (!cb) {
      this.evtsCbs[method] = []
      return
    }
    const cbs = this.evtsCbs[method]
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
   * @param method method name
   * @param data params 
   * @param transfers object array want to transfer
   */
  emit (method: string, data: any, transfers?: any[]) {
    const msg = {
      type: 'request',
      method,
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
  protected composeMiddlewares (middlewares: IMiddleWare[]) {
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
      method: request.method,
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
        const routerCbs = this.routers[request.method] || []
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
          console.warn(`no corresponding router for ${request.method}`)
        }
        const message = {
          resolved,
          id: ctx.id,
          method: ctx.method,
          type: 'response',
          data: ctx.response
        } as IMessageResponse
        this.postMessage(message)
      }
    } else {
      const cbs = this.evtsCbs[request.method]
      if (!cbs || !cbs.length) {
        console.warn(`no corresponed callback for ${request.method}`)
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