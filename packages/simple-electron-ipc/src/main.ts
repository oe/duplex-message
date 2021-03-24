import electron, { WebContents, IpcMain } from 'electron'
import { IHandlerMap } from 'duplex-message'
import { ElectronMessageHub, IElectronMessageHubOptions } from './abstract'

export class MainMessageHub extends ElectronMessageHub {
  protected readonly _ipc: IpcMain
  constructor(options?: IElectronMessageHubOptions) {
    if (process.type === 'browser') throw new TypeError('MainMessageHub only available in electron main process')
    super(options)
    this._ipc = electron.ipcMain
    this._ipc.on(this._channelName, this._onMessageReceived)
  }

  emit (target: WebContents, method: string, ...args: any[]) {
    return super._emit(target, method, ...args)
  }

  on (target: WebContents | '*', handlerMap: Function | IHandlerMap): void
  on (target: WebContents | '*', methodName: string, handler: Function): void
  on (target: WebContents | '*', handlerMap: IHandlerMap | Function | string, handler?: Function): void  {
    // @ts-ignore
    this._on(target, handlerMap, handler)
  }

  off (target: WebContents | '*', methodName?: string) {
    this._off(target, methodName)
  }
}