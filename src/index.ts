
/**
 * detect is this code run in webworker context
 */
function isInWorker () {
  return typeof document === 'undefined'
}

interface IMiddleWare {
  (ctx: any, next: Function): any
}

interface IEventCb {
  (ctx: any): any
}

interface IMessageRequest {
  id: string
  type: 'request' | 'response'
  method: string
  data: any
}
// @ts-ignore
const glb = this

abstract class Router {
  prefix: string
  count: number = 0
  worker: any
  globalMws: IMiddleWare[] = []
  routerMws: {
    [k: string]: IMiddleWare[]
  } = {}
  evtsCbs: {
    [k: string]: IEventCb[]
  } = {}

  promisePairs: {
    [k: string]: [Function, Function]
  } = {}

  constructor () {
    const isWoker = isInWorker()
    this.worker = isWoker ? glb : null 
    this.prefix = isWoker ? 'wk' : 'wd'
  }

  use (cb: IMiddleWare) {
    this.globalMws.push(cb)
  }

  request (method: string, ...cbs: IMiddleWare[]) {
    if (!this.routerMws[method]) {
      this.routerMws[method] = []
    }
    this.routerMws[method].push(...cbs)
  }

  fetch (method: string, params: any, transfers?: any[]) {
    const args = [...arguments]
    args.unshift(true)
    // @ts-ignore
    return this.postMessage(...args)
  }

  on (method: string, cb: IEventCb) {
    if (!this.evtsCbs[method]) {
      this.evtsCbs[method] = []
    }
    this.evtsCbs[method].push(cb)
  }

  off (method: string, cb?: IEventCb) {
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

  emit (method: string, params: any, transfers?: any[]) {
    const args = [...arguments]
    args.unshift(false)
    // @ts-ignore
    this.postMessage(...args)
  }

  private onMessage (evt: MessageEvent) {
    const request = evt.data as IMessageRequest
    if (request.id) {
      const promisePair = this.promisePairs[request.id]
      if (!promisePair) {
        console.warn('unowned message with id', request.id)
        return
      }

    } else {
      const cbs = this.evtsCbs[request.method]
      if (!cbs || !cbs.length) {
        console.warn(`no corresponed callback for ${request.method}`)
        return
      }
      for (let index = 0; index < cbs.length; index++) {
        const cb = cbs[index];
        if (cb(request.data) === false) break
      }
    }
  }

  private postMessage (needResp: boolean, method: string, data: any, transfers?: any[]) {
    const id = needResp ? this.prefix + (++this.count) : ''
    const requestData: any[] = [{
      id,
      method,
      data
    }]
    if (transfers) requestData.push(transfers)
    this.worker.postMessage(...requestData)
    if (!id) return
    return new Promise((resolve, reject) => {
      this.promisePairs[id] = [resolve, reject]
    })
  }
}

class WorkerServer extends Router{
  worker: Worker
  constructor (src: string) {
    super()
    this.worker = new Worker(src)
  }
}