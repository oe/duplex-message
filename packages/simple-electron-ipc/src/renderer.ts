import electron, { IpcRenderer } from 'electron'
import { IHandlerMap } from 'duplex-message'
import { ElectronMessageHub, IElectronMessageHubOptions } from './abstract'

let rendererMessageHub: RendererMessageHub
export class RendererMessageHub extends ElectronMessageHub {
  protected readonly _ipc: IpcRenderer

  constructor(options?: IElectronMessageHubOptions) {
    if (process.type !== 'renderer') {
      throw new TypeError(
        'RendererMessageHub only available in main renderer process',
      )
    }
    super(options)
    this._ipc = electron.ipcRenderer
    this._ipc.on(this._channelName, this._onMessageReceived)
  }

  emit(method: string, ...args: any[]) {
    return super._emit(this._ipc, method, ...args)
  }

  on(handlerMap: Function | IHandlerMap): void;
  on(methodName: string, handler: Function): void;
  on(handlerMap: IHandlerMap | Function | string, handler?: Function): void {
    // @ts-ignore
    this._on(this._ipc, handlerMap, handler)
  }

  off(methodName?: string) {
    this._off(this._ipc, methodName)
  }

  destroy() {
    if (this._isDestroyed) return
    super.destroy()
    this._ipc.off(this._channelName, this._onMessageReceived)
    // @ts-ignore
    this._ipc = null
  }

  /** shared MainMessageHub instance */
  public static get shared() {
    if (!rendererMessageHub) {
      rendererMessageHub = new RendererMessageHub()
    }
    return rendererMessageHub
  }
}
