import { AbstractHub, IResponse, IHandlerMap, IRequest } from './abstract'

export class PageScriptMessageHub extends AbstractHub {
  private customEventName: string
  private responseCallbacks: Function[]
  constructor (customEventName = 'message-hub') {
    // tslint:disable-next-line
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      throw new Error('StorageMessageHub only available in normal browser context, nodejs/worker are not supported')
    }
    super()
    this.customEventName = customEventName
    this.responseCallbacks = []
    this.onMessageReceived = this.onMessageReceived.bind(this)
    // @ts-ignore
    window.addEventListener(customEventName, this.onMessageReceived)
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

  protected async onMessageReceived (evt: CustomEvent) {
    const msg = evt.detail 
    if (!msg) return

    if (!this.isRequest(msg)) {
      const idx = this.responseCallbacks.findIndex(fn => fn(msg))
      if (idx >= 0) this.responseCallbacks.splice(idx, 1)
      return
    }

    let response: IResponse

    try {
      response = await this.onRequest('*', msg)
    } catch (error) {
      response = error
    }
    this.sendMessage('*', response)
  }

  protected sendMessage (target: string, msg: IRequest | IResponse) {
    const evt = new CustomEvent(this.customEventName, { detail: msg })
    window.dispatchEvent(evt)
  }

  protected listenResponse (target: any, reqMsg: IRequest, callback: (resp: IResponse) => boolean) {
    this.responseCallbacks.push(callback)
  }
}