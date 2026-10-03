import { WebContents, IpcMainEvent } from 'electron'
import { IHandlerMap, IFn, IMethodNameConfig } from 'duplex-message'
import { ElectronMessageHub, IElectronMessageHubOptions } from './abstract'

let sharedMainMessageHub: MainMessageHub
export interface IMainMessageHubOptions extends IElectronMessageHubOptions {
  /** Validate the sender and frame before processing any incoming IPC message. */
  validateSender?: (event: IpcMainEvent) => boolean
}

export class MainMessageHub extends ElectronMessageHub {
  private readonly _validateSender?: (event: IpcMainEvent) => boolean

  constructor(options?: IMainMessageHubOptions) {
    if (options?.validateSender !== undefined && typeof options.validateSender !== 'function') {
      throw new TypeError('validateSender must be a function')
    }
    super({ ...options, type: 'browser' }, 'MainMessageHub')
    this._validateSender = options?.validateSender
  }

  protected override async onMessage(event: IpcMainEvent, message: unknown) {
    try {
      if (this._validateSender) {
        const allowed = this._validateSender(event)
        if (allowed !== true) {
          // An accidentally async validator must neither accept IPC nor crash main on rejection.
          void Promise.resolve(allowed).catch(() => {})
          return
        }
      }
    } catch { return }
    await super.onMessage(event, message)
  }

  emit<ResponseType = unknown>(target: WebContents, method: string | IMethodNameConfig, ...args: any[]) {
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
    if (!sharedMainMessageHub || sharedMainMessageHub.isDestroyed) {
      sharedMainMessageHub = new MainMessageHub()
    }
    return sharedMainMessageHub
  }
}
