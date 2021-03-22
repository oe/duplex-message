import { WebContents, IpcRenderer, IpcMain, IpcMainEvent, IpcRendererEvent } from 'electron'
import { AbstractHub, IResponse, IRequest } from 'duplex-message'

export abstract class ElectronMessageHub extends AbstractHub {
  protected readonly _channelName: string
  protected abstract readonly _ipc: IpcMain | IpcRenderer
  protected readonly _responseCallbacks: Function[]
  constructor(channelName = 'message-hub') {
    super()
    this._channelName = channelName
    this._responseCallbacks = []
    this._onMessageReceived = this._onMessageReceived.bind(this)
  }

  protected sendMessage(target: WebContents | IpcRenderer, msg: IRequest | IResponse) {
    target.send(this._channelName, msg)
  }

  protected listenResponse (target: any, reqMsg: IRequest, callback: (resp: IResponse) => boolean) {
    this._responseCallbacks.push(callback)
  }

  protected async _onMessageReceived (evt: IpcMainEvent | IpcRendererEvent, msg: any) {
    if (!msg) return
    if (!this._isRequest(msg)) {
      const idx = this._responseCallbacks.findIndex(fn => fn(msg))
      if (idx >= 0) this._responseCallbacks.splice(idx, 1)
      return
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