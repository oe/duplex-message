import { IFn, IMethodNameConfig } from './abstract'

export type RpcEmitter = (method: string | IMethodNameConfig, ...args: any[]) => Promise<unknown>

// Avoid requiring the built-in Awaited type (added in TypeScript 4.5).
type RpcResult<Value> = Value extends PromiseLike<infer Result> ? RpcResult<Result> : Value

export interface IRpcClient<Methods extends Record<keyof Methods, IFn>> {
  call<Key extends Extract<keyof Methods, string>>(
    method: Key | (IMethodNameConfig & { methodName: Key }),
    ...args: Parameters<Methods[Key]>
  ): Promise<RpcResult<ReturnType<Methods[Key]>>>
}

/** Add method-name, argument and result types to any hub without changing its wire protocol. */
export function createRpcClient<Methods extends Record<keyof Methods, IFn>>(
  emit: RpcEmitter,
): IRpcClient<Methods> {
  return { call: (method, ...args) => emit(method, ...args) as Promise<any> }
}
