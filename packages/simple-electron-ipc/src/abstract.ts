import { WebContents, IpcRenderer, IpcMain, IpcMainEvent, IpcRendererEvent } from 'electron'
import { AbstractHub, IResponse, IRequest } from 'duplex-message'

export interface IElectronMessageHubOptions {
  channelName?: string
}

export abstract class ElectronMessageHub extends AbstractHub {
  protected readonly _channelName: string
  protected abstract readonly _ipc: IpcMain | IpcRenderer
  protected readonly _responseCallbacks: Function[]
  constructor(options?: IElectronMessageHubOptions) {
    super()
    options = Object.assign({channelName: 'message-hub'}, options)
    this._channelName = options.channelName!
    this._responseCallbacks = []
    this._onMessageReceived = this._onMessageReceived.bind(this)
  }

  protected sendMessage(target: WebContents | IpcRenderer, msg: IRequest | IResponse) {
    let newMsg = msg
    if (this._isRequest(msg)) {
      const options = msg.args[0]
      if (options && typeof options.onprogress === 'function') {
        newMsg = Object.assign({}, msg, { progress: true })
        newMsg.args = newMsg.args.slice()
        const copied = Object.assign({}, options)
        delete copied.onprogress
        newMsg.args[0] = copied
      }
    }
    target.send(this._channelName, newMsg)
  }

  protected listenResponse (target: any, reqMsg: IRequest, callback: (resp: IResponse) => boolean) {
    const options = reqMsg.args[0]
    const onprogress = options && typeof options.onprogress === 'function' && options.onprogress
    let progressName = onprogress ? `${reqMsg.messageID}-progress` : ''
    
    const eventCallback = (response: IResponse) => {
      if (!callback(response)) return false
      if (progressName) this._ipc.removeAllListeners(progressName)
      return true
    }
    this._responseCallbacks.push(eventCallback)

    if (!progressName) return
    this._ipc.on(progressName, (evt: any, resp: any) => {
      onprogress(resp)
    })
  }

  protected async _onMessageReceived (evt: IpcMainEvent | IpcRendererEvent, msg: any) {
    if (!msg) return
    if (!this._isRequest(msg)) {
      const idx = this._responseCallbacks.findIndex(fn => fn(msg))
      if (idx >= 0) this._responseCallbacks.splice(idx, 1)
      return
    }
    if (msg.progress && msg.args[0]) {
      msg.args[0].onprogress = (data: any) => {
        evt.sender.send(`${msg.messageID}-progress`, data)
      }
    }
    let response: IResponse
    try {
      response = await this.onRequest(evt.sender, msg)
    } catch (error) {
      response = error
    }
    this.sendMessage(evt.sender, response)
  }
}