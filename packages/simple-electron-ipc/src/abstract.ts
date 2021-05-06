import {
  WebContents, IpcRenderer, IpcMain, IpcMainEvent, IpcRendererEvent,
} from 'electron'
import {
  AbstractHub, IResponse, IRequest, IProgress,
} from 'duplex-message'

export interface IElectronMessageHubOptions {
  /** ipc channel name used under the hood, default: message-hub */
  channelName?: string
}

export abstract class ElectronMessageHub extends AbstractHub {
  protected readonly _channelName: string

  protected abstract readonly _ipc: IpcMain | IpcRenderer

  constructor(options?: IElectronMessageHubOptions) {
    super()
    // eslint-disable-next-line no-param-reassign
    options = { channelName: 'message-hub', ...options }
    this._channelName = options.channelName!
    this._onMessageReceived = this._onMessageReceived.bind(this)
  }

  protected sendMessage(target: WebContents | IpcRenderer, msg: IRequest | IResponse | IProgress) {
    target.send(this._channelName, msg)
  }

  protected async _onMessageReceived(evt: IpcMainEvent | IpcRendererEvent, msg: any) {
    this._onMessage(evt.sender, msg)
  }
}
