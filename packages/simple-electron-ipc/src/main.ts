import { WebContents } from 'electron'
import { IHandlerMap, IFn } from 'duplex-message'
import { ElectronMessageHub, IElectronMessageHubOptions } from './abstract'

let sharedMainMessageHub: MainMessageHub
export class MainMessageHub extends ElectronMessageHub {
  constructor(options?: IElectronMessageHubOptions) {
    super({ ...options, type: 'browser' }, 'MainMessageHub')
  }

  emit<ResponseType = unknown>(target: WebContents, method: string, ...args: any[]) {
    return super._emit<ResponseType>(target, method, ...args)
  }

  on(target: WebContents | '*', handlerMap: IFn | IHandlerMap): void;
  on(target: WebContents | '*', methodName: string, handler: IFn): void;
  on(
    target: WebContents | '*',
    handlerMap: IHandlerMap | IFn | string,
    handler?: IFn,
  ): void {
    // @ts-ignore
    this._on(target, handlerMap, handler)
  }

  off(target: WebContents | '*', methodName?: string) {
    this._off(target, methodName)
  }

  /** shared MainMessageHub instance */
  public static get shared() {
    if (!sharedMainMessageHub) {
      sharedMainMessageHub = new MainMessageHub()
    }
    return sharedMainMessageHub
  }
}
