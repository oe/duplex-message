import { AbstractHub, IResponse, IHandlerMap, IRequest } from './abstract'

export class StorageMessageHub extends AbstractHub {
  
  private responseCallbacks: Function[]

  constructor () {
    // tslint:disable-next-line
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      throw new Error('StorageMessageHub only available in normal browser context, nodejs/worker are not supported')
    }
    super()
    this.responseCallbacks = []
    this.onMessageReceived = this.onMessageReceived.bind(this)
    window.addEventListener('storage', this.onMessageReceived)
  }

  on (handlerMap: Function | IHandlerMap)
  on (handlerMap: string, handler: Function)
  on (handlerMap: IHandlerMap | Function | string, handler?: Function) {
    // @ts-ignore
    super.on('*', handlerMap, handler)
  }

  emit (method: string, ...args: any[]) {
    return super._emit('*', method, ...args)
  }

  off () {
    super.off('*')
  }

  protected async onMessageReceived (evt: StorageEvent) {
    const msg = this.getMsgFromEvent(evt)
    if (!msg) return

    if (!this.isRequest(msg)) {
      const idx = this.responseCallbacks.findIndex(fn => fn(msg))
      if (idx >= 0) this.responseCallbacks.splice(idx, 1)
      return
    }

    // clear storage
    setTimeout(() => {
      if (localStorage.getItem(evt.key!) === null) return
      localStorage.removeItem(evt.key!)
    }, 100 + Math.floor(1000 * Math.random()))

    let response: IResponse

    try {
      response = await this.onRequest('*', msg)
    } catch (error) {
      response = error
    }
    this.sendMessage('*', response)
  }

  protected sendMessage (target: string, msg: IRequest | IResponse) {
    const msgKey = getMsgKey(msg)
    localStorage.setItem(msgKey, JSON.stringify(msg))
  }

  protected listenResponse (target: any, reqMsg: IRequest, callback: (resp: IResponse) => boolean) {
    // callback handled via onMessageReceived
    const evtCallback = (msg: IResponse) => {
      if (!callback(msg)) return false
      localStorage.removeItem(getMsgKey(msg))
      return true
    }
    this.responseCallbacks.push(evtCallback)
  }

  private getMsgFromEvent (evt: StorageEvent) {
    if (!evt.key || !/^\$\$msghub\-/.test(evt.key) || !evt.newValue ) return
    let msg
    try { msg = JSON.parse(evt.newValue) } catch (error) { return }
    return msg
  }
}

function getMsgKey (msg: IRequest | IResponse) {
  return `$$msghub-${msg.type}-${msg.fromInstance}-${msg.toInstance || ''}-${msg.messageID}`
}