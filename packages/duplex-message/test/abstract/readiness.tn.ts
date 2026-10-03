import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EErrorCode, type IMethodNameConfig } from '../../src/abstract'
import { READY_METHOD, waitForPeer } from '../../src/readiness'
import { createRpcClient } from '../../src/rpc-client'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('peer readiness', () => {
  it('probes only the ready endpoint, then releases timers and signal listeners', async () => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const emit = vi.fn().mockResolvedValue(true)
    await waitForPeer(emit, { signal: controller.signal })
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ methodName: READY_METHOD }))
    expect(remove).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retries missing handlers, probe timeouts and not-ready responses', async () => {
    const emit = vi.fn()
      .mockRejectedValueOnce({ code: EErrorCode.METHOD_NOT_FOUND })
      .mockRejectedValueOnce({ code: EErrorCode.REQUEST_TIMEOUT })
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true)
    const ready = waitForPeer(emit, { interval: 10, timeout: 100 })
    await vi.advanceTimersByTimeAsync(30)
    await ready
    expect(emit).toHaveBeenCalledTimes(4)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('enforces a total deadline even when an adapter never resolves', async () => {
    const emit = vi.fn((_method: IMethodNameConfig) => new Promise(() => {}))
    const ready = expect(waitForPeer(emit, { timeout: 20 })).rejects.toMatchObject({ code: EErrorCode.REQUEST_TIMEOUT })
    await vi.advanceTimersByTimeAsync(20)
    await ready
    expect(emit.mock.calls[0][0].signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['probe', 'pause'])('cancels during the %s and releases timers', async (phase) => {
    const controller = new AbortController()
    const emit = phase === 'probe' ? vi.fn(() => new Promise(() => {})) : vi.fn().mockResolvedValue(false)
    const ready = expect(waitForPeer(emit, { signal: controller.signal })).rejects.toMatchObject({ code: EErrorCode.REQUEST_ABORTED })
    await vi.advanceTimersByTimeAsync(0)
    controller.abort()
    await ready
    await vi.advanceTimersByTimeAsync(1000)
    expect(emit).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not probe an already cancelled wait', async () => {
    const controller = new AbortController()
    controller.abort()
    const emit = vi.fn()
    await expect(waitForPeer(emit, { signal: controller.signal })).rejects.toMatchObject({ code: EErrorCode.REQUEST_ABORTED })
    expect(emit).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('propagates business errors without retrying', async () => {
    const error = { code: EErrorCode.HANDLER_EXEC_ERROR, message: 'initialization failed' }
    const emit = vi.fn().mockRejectedValue(error)
    await expect(waitForPeer(emit)).rejects.toBe(error)
    expect(emit).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects malformed ready responses', async () => {
    await expect(waitForPeer(vi.fn().mockResolvedValue('ready'))).rejects.toMatchObject({ code: EErrorCode.INVALID_MESSAGE })
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([0, -1, NaN, Infinity, 2147483648])('rejects invalid timeout/interval %s', async value => {
    const emit = vi.fn()
    await expect(waitForPeer(emit, { timeout: value })).rejects.toMatchObject({ code: EErrorCode.INVALID_MESSAGE })
    await expect(waitForPeer(emit, { interval: value })).rejects.toMatchObject({ code: EErrorCode.INVALID_MESSAGE })
    expect(emit).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('typed RPC client', () => {
  it('preserves configuration and arguments while forwarding results and errors', async () => {
    interface Api { add(a: number, b: number): number }
    const emit = vi.fn().mockResolvedValueOnce(3).mockRejectedValueOnce(new Error('failed'))
    const rpc = createRpcClient<Api>(emit)
    const config = Object.freeze({ methodName: 'add' as const, requestTimeout: 100 })
    await expect(rpc.call(config, 1, 2)).resolves.toBe(3)
    expect(emit).toHaveBeenCalledWith(config, 1, 2)
    await expect(rpc.call('add', 2, 3)).rejects.toThrow('failed')
  })
})
