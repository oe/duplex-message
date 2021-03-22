import electron, { IpcRenderer } from 'electron'
import { IHandlerMap } from 'duplex-message'
import { ElectronMessageHub } from './abstract'

export class RendererMessageHub extends ElectronMessageHub {
  protected readonly _ipc: IpcRenderer
  constructor(channelName?: string) {
    if (process.type === 'browser') throw new TypeError('RendererMessageHub only available in renderer process')
    super(channelName)
    this._ipc = electron.ipcRenderer
    this._ipc.on(this._channelName, this._onMessageReceived)
  }

  emit (method: string, ...args: any[]) {
    return super._emit(this._ipc, method, ...args)
  }

  on (handlerMap: Function | IHandlerMap): void
  on (methodName: string, handler: Function): void
  on (handlerMap: IHandlerMap | Function | string, handler?: Function): void  {
    // @ts-ignore
    this._on(this._ipc, handlerMap, handler)
  }

  off (methodName?: string) {
    this._off(this._ipc, methodName)
  }
}