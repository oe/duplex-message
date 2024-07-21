import electron, {
  WebContents, IpcRenderer, IpcMain, IpcMainEvent, IpcRendererEvent,
} from 'electron'
import {
  IAbstractHubOptions,
  AbstractHub, IResponse, IRequest, IProgress,
} from 'duplex-message'

interface IElectronBaseMessageHubOptions extends IAbstractHubOptions {
  /** ipc channel name used under the hood, default: message-hub */
  channelName?: string
  /**
   * process type
   */
  type: 'browser' | 'renderer'
}

export type IElectronMessageHubOptions = Omit<IElectronBaseMessageHubOptions, 'type'>

const DEFAULT_CHANNEL_NAME = 'message-hub'

export abstract class ElectronMessageHub extends AbstractHub {
  protected readonly _channelName: string

  protected readonly _ipc: IpcMain | IpcRenderer

  constructor(options: IElectronBaseMessageHubOptions) {
    super(options)
    if (options.type !== process.type) {
      throw new TypeError(
        `can only be used in electron ${options.type === 'browser' ? 'main' : 'renderer'} process`,
      )
    }
    this._ipc = options.type === 'browser' ? electron.ipcMain : electron.ipcRenderer
    this._channelName = options.channelName || DEFAULT_CHANNEL_NAME
    this.onMessage = this.onMessage.bind(this)
    this._ipc.on(this._channelName, this.onMessage)
  }

  protected sendMessage(target: WebContents | IpcRenderer, msg: IRequest | IResponse | IProgress) {
    target.send(this._channelName, msg)
  }

  protected override async onMessage(evt: IpcMainEvent | IpcRendererEvent, msg: any) {
    super.onMessage(evt.sender, msg)
  }

  override destroy(): void {
    if (this.isDestroyed) return
    super.destroy()
    this._ipc.off(this._channelName, this.onMessage)
    // @ts-ignore
    this._ipc = null
  }
}
