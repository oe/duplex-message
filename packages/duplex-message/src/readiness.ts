import { EErrorCode, IError, IMethodNameConfig } from './abstract'

/** Register this endpoint after the peer's application handlers are ready. */
export const READY_METHOD = '__duplex_message_ready__'

export interface IWaitForPeerOptions {
  /** Total wait in milliseconds. Default 5000. */
  timeout?: number
  /** Probe timeout and pause between attempts, in milliseconds. Default 100. */
  interval?: number
  signal?: AbortSignal
}

const abortedError = (): IError => ({ code: EErrorCode.REQUEST_ABORTED, message: 'waiting for peer was aborted' })

function validateDuration(value: number) {
  return Number.isFinite(value) && value > 0 && value <= 2147483647
}

function probeWithSignal(probe: () => Promise<unknown>, signal: AbortSignal) {
  return new Promise<unknown>((resolve, reject) => {
    let settled = false
    const finish = (callback: (value: any) => void, value: unknown) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', abort)
      callback(value)
    }
    const abort = () => finish(reject, abortedError())
    if (signal.aborted) { abort(); return }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) { abort(); return }
    try {
      Promise.resolve(probe()).then(value => finish(resolve, value), error => finish(reject, error))
    } catch (error) { finish(reject, error) }
  })
}

function pause(duration: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      reject(abortedError())
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, duration)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
}

/**
 * Wait for an explicit ready endpoint; never retries a business operation.
 * The peer must register READY_METHOD with a handler returning true when ready.
 */
export async function waitForPeer(
  emit: (method: IMethodNameConfig) => Promise<unknown>,
  options: IWaitForPeerOptions = {},
): Promise<void> {
  const { timeout = 5000, interval = 100, signal } = options
  if (!validateDuration(timeout) || !validateDuration(interval)
    || (signal !== undefined && (signal === null || typeof signal !== 'object'
      || typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function'
      || typeof signal.removeEventListener !== 'function'))) {
    throw { code: EErrorCode.INVALID_MESSAGE, message: 'invalid readiness options' } satisfies IError
  }
  if (signal?.aborted) throw abortedError()
  const controller = new AbortController()
  let stopReason: IError | undefined
  const stop = (error: IError) => {
    if (controller.signal.aborted) return
    stopReason = error
    controller.abort()
  }
  const forwardAbort = () => stop(abortedError())
  const timer = setTimeout(() => stop({
    code: EErrorCode.REQUEST_TIMEOUT, message: `peer was not ready within ${timeout}ms`,
  }), timeout)
  try {
    signal?.addEventListener('abort', forwardAbort, { once: true })
    if (signal?.aborted) forwardAbort()
    while (!controller.signal.aborted) {
      try {
        const ready = await probeWithSignal(() => emit({
          methodName: READY_METHOD, requestTimeout: Math.min(interval, timeout), signal: controller.signal,
        }), controller.signal)
        if (controller.signal.aborted) break
        if (ready === true) return
        if (ready !== false) throw {
          code: EErrorCode.INVALID_MESSAGE, message: 'ready endpoint must return a boolean',
        } satisfies IError
      } catch (error) {
        if (controller.signal.aborted) break
        const code = (error as IError | null)?.code
        if (code !== EErrorCode.METHOD_NOT_FOUND && code !== EErrorCode.REQUEST_TIMEOUT) throw error
      }
      await pause(interval, controller.signal)
    }
    throw stopReason
  } catch (error) {
    throw stopReason ?? error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}
