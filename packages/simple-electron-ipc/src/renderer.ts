import { IHandlerMap, IFn } from 'duplex-message'
import { ElectronMessageHub, IElectronMessageHubOptions } from './abstract'

let rendererMessageHub: RendererMessageHub
export class RendererMessageHub extends ElectronMessageHub {
  constructor(options?: IElectronMessageHubOptions) {
    super({ ...options, type: 'renderer' })
  }

  emit<ResponseType = unknown>(method: string, ...args: any[]) {
    return super._emit<ResponseType>(this._ipc, method, ...args)
  }

  on(handlerMap: IFn | IHandlerMap): void;
  on(methodName: string, handler: IFn): void;
  on(handlerMap: IHandlerMap | IFn | string, handler?: IFn): void {
    // @ts-ignore
    this._on(this._ipc, handlerMap, handler)
  }

  off(methodName?: string) {
    this._off(this._ipc, methodName)
  }

  /** shared MainMessageHub instance */
  public static get shared() {
    if (!rendererMessageHub) {
      rendererMessageHub = new RendererMessageHub()
    }
    return rendererMessageHub
  }
}
