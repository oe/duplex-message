import { AbstractHub, IResponse, IRequest, IHandlerMap } from './abstract'

// save current window it's self
const WIN: Window = self

const hostedWorkers: Worker[] = []

export class PostMessageHub extends AbstractHub {
  constructor () {
    super()
    this.onMessageReceived = this.onMessageReceived.bind(this)
    WIN.addEventListener('message', this.onMessageReceived)
  }

  on (target: any, handlerMap: Function | IHandlerMap)
  on (target: any, handlerMap: string, handler: Function)
  on (target: any, handlerMap: IHandlerMap | Function | string, handler?: Function) {
    // @ts-ignore
    super.on(target, handlerMap, handler)
    if (target instanceof Worker && !hostedWorkers.includes(target)) {
      hostedWorkers.push(target)
      target.addEventListener('message', this.onMessageReceived)
    }
  }

  off (target: Window | Worker | '*') {
    super.off(target)
    if (target instanceof Worker) {
      target.removeEventListener('message', this.onMessageReceived)
      const idx = hostedWorkers.indexOf(target)
      idx > -1 && hostedWorkers.splice(idx, 1)
    }
  }

  async onMessageReceived (evt: MessageEvent) {
    const data = evt.data as IRequest
    if (!this.isRequest(data)) return
    const target = evt.source || evt.currentTarget || WIN
    let response: IResponse
    try {
      response = await this.onRequest(target, data)
    } catch (error) {
      response = error
    }
    this.sendMessage(target as Window, response)
  }

  sendMessage (peer: Window | Worker, msg: any) {
    const args = [msg]
    // tslint:disable-next-line
    if (typeof Window === 'function' && peer instanceof Window) {
      args.push('*')
    }
    // @ts-ignore
    peer.postMessage(...args)
  }

  onResponse (target: any, reqMsg: IRequest, callback: (resp: IResponse) => void) {
    const evtCallback = (evt: MessageEvent) => {
      callback(evt.data)
      WIN.removeEventListener('message', evtCallback)
    }
    WIN.addEventListener('message', evtCallback)
  }
}