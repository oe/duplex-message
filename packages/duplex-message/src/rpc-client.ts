import { IFn, IMethodNameConfig } from './abstract'

export type RpcEmitter = (method: string | IMethodNameConfig, ...args: any[]) => Promise<unknown>

export interface IRpcClient<Methods extends Record<keyof Methods, IFn>> {
  call<Key extends Extract<keyof Methods, string>>(
    method: Key | (IMethodNameConfig & { methodName: Key }),
    ...args: Parameters<Methods[Key]>
  ): Promise<Awaited<ReturnType<Methods[Key]>>>
}

/** Add method-name, argument and result types to any hub without changing its wire protocol. */
export function createRpcClient<Methods extends Record<keyof Methods, IFn>>(
  emit: RpcEmitter,
): IRpcClient<Methods> {
  return { call: (method, ...args) => emit(method, ...args) as Promise<any> }
}
