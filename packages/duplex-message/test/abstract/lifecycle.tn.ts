import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AbstractHub, EErrorCode, type IAbstractHubOptions, type IFn, type IHandlerMap, type IMethodNameConfig, type IRequest, type IResponse, type IProgress } from '../../src/abstract'

class TestHub extends AbstractHub {
  readonly sent: (IRequest | IResponse | IProgress)[] = []
  failSend = false

  on(peer: TestHub | '*', method: string | IHandlerMap, handler?: IFn) {
    if (typeof method === 'string') this._on(peer, method, handler!)
    else this._on(peer, method)
  }

  off(peer: TestHub | '*', method?: string, handler?: IFn) {
    this._off(peer, method, handler)
  }

  emit(peer: TestHub, method: string | IMethodNameConfig, ...args: any[]) {
    return this._emit(peer, method, ...args)
  }

  receive(peer: TestHub, message: unknown) {
    return this.onMessage(peer, message)
  }

  get pendingCount() { return Object.keys(this._responseCallbackMap).length }

  protected sendMessage(peer: TestHub, message: IRequest | IResponse | IProgress) {
    if (this.failSend) throw new Error('transport unavailable')
    const copied = structuredClone(message)
    this.sent.push(copied)
    void peer.receive(this, copied)
  }
}

const hubs: TestHub[] = []
function hub(options?: IAbstractHubOptions) {
  const result = new TestHub(options)
  hubs.push(result)
  return result
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  hubs.splice(0).forEach((item) => item.destroy())
  vi.useRealTimers()
})

describe('request lifecycle', () => {
  it('reuses frozen method options without mutating the caller or earlier requests', async () => {
    const client = hub()
    const server = hub()
    server.on(client, 'echo', (value: number) => value)
    const options = Object.freeze({ methodName: 'echo', to: server.instanceID })
    expect(await Promise.all([client.emit(server, options, 1), client.emit(server, options, 2)])).toEqual([1, 2])
    expect(options).toEqual({ methodName: 'echo', to: server.instanceID })
    expect(client.sent.map((request) => request.messageID)).toEqual([1, 2])
    expect(client.pendingCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not retain heartbeat timers after 1000 completed requests', async () => {
    const client = hub()
    const server = hub()
    server.on(client, 'echo', (value: number) => value)
    const results = await Promise.all(Array.from({ length: 1000 }, (_, i) => client.emit(server, 'echo', i)))
    expect(results).toHaveLength(1000)
    expect(client.pendingCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the timer on heartbeat while allowing handlers to run beyond the timeout', async () => {
    const client = hub({ heartbeatTimeout: 10 })
    const server = hub()
    let finish!: (value: string) => void
    server.on(client, 'slow', () => new Promise<string>((resolve) => { finish = resolve }))
    const response = client.emit(server, 'slow')
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(1000)
    finish('done')
    await expect(response).resolves.toBe('done')
  })

  it('preserves the legacy 500ms fallback for a zero heartbeat timeout', async () => {
    const client = hub({ heartbeatTimeout: 0 })
    const response = expect(client.emit(hub(), 'missing')).rejects.toMatchObject({ code: EErrorCode.METHOD_NOT_FOUND })
    await vi.advanceTimersByTimeAsync(499)
    expect(client.pendingCount).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    await response
    expect(client.pendingCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects the original promise and removes all pending state when sending fails', async () => {
    const client = hub()
    client.failSend = true
    await expect(client.emit(hub(), 'echo')).rejects.toMatchObject({ code: EErrorCode.INVALID_MESSAGE })
    expect(client.pendingCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects outstanding requests on destroy, including acknowledged requests', async () => {
    const client = hub()
    const server = hub()
    server.on(client, 'slow', () => new Promise(() => {}))
    const acknowledged = expect(client.emit(server, 'slow')).rejects.toMatchObject({ code: EErrorCode.UNKNOWN })
    const waiting = expect(client.emit(server, 'missing')).rejects.toMatchObject({ code: EErrorCode.UNKNOWN })
    client.destroy()
    client.destroy()
    await Promise.all([acknowledged, waiting])
    expect(client.pendingCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(() => client.emit(server, 'slow')).toThrow('destroyed')
  })

  it('does not send late progress or responses after the responder is destroyed', async () => {
    const client = hub()
    const server = hub()
    let finish!: () => void
    let progress!: (value: number) => void
    server.on(client, 'slow', (options: { onprogress: (value: number) => void }) => {
      progress = options.onprogress
      return new Promise<void>((resolve) => { finish = resolve })
    })
    const response = expect(client.emit(server, 'slow', { onprogress: vi.fn() })).rejects.toMatchObject({ code: EErrorCode.UNKNOWN })
    server.destroy()
    progress(1)
    finish()
    await Promise.resolve()
    await Promise.resolve()
    expect(server.sent).toHaveLength(1)
    client.destroy()
    await response
    await expect(server.receive(client, {})).resolves.toBeUndefined()
  })

  it('converts uncloneable handler responses to an error instead of hanging', async () => {
    const client = hub()
    const server = hub()
    server.on(client, 'uncloneable', () => () => {})
    await expect(client.emit(server, 'uncloneable')).rejects.toMatchObject({ code: EErrorCode.INVALID_MESSAGE })
    expect(client.pendingCount).toBe(0)
  })

  it.each([
    ['null', (): unknown => null], ['undefined', (): unknown => undefined], ['string', (): unknown => 'failure'],
    ['stack object', (): unknown => ({ stack: 'custom stack' })], ['null prototype', (): unknown => Object.create(null)],
    ['throwing getter', (): object => ({ get message(): string { throw new Error('unreadable message') } })],
  ] as const)('handles non-Error throws: %s', async (_name, createError) => {
    const client = hub()
    const server = hub()
    server.on(client, 'fail', () => { throw createError() })
    await expect(client.emit(server, 'fail')).rejects.toMatchObject({ code: EErrorCode.HANDLER_EXEC_ERROR, message: expect.any(String) })
  })

  it('ignores forged responses from a different transport peer', async () => {
    const client = hub({ heartbeatTimeout: 10 })
    const server = hub()
    const spoof = { from: server.instanceID, to: client.instanceID, messageID: 1, type: 'response', isSuccess: true, data: 'forged' }
    const response = expect(client.emit(server, 'missing')).rejects.toMatchObject({ code: EErrorCode.METHOD_NOT_FOUND })
    await client.receive(hub(), spoof)
    expect(client.pendingCount).toBe(1)
    await vi.advanceTimersByTimeAsync(10)
    await response
  })

  it('ignores a response with the wrong instance ID for an addressed request', async () => {
    const client = hub({ heartbeatTimeout: 10 })
    const server = hub()
    const response = expect(client.emit(server, { methodName: 'missing', to: server.instanceID })).rejects.toMatchObject({ code: EErrorCode.METHOD_NOT_FOUND })
    await client.receive(server, { from: 'other', to: client.instanceID, messageID: 1, type: 'progress', data: '--message-hub-to-be-continued--' })
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(10)
    await response
  })
})

describe('handler and message isolation', () => {
  it('registers prototype-like method names without treating inherited properties as handlers', async () => {
    const client = hub({ heartbeatTimeout: 10 })
    const server = hub()
    server.on(client, 'echo', () => 'echo')
    const missing = expect(client.emit(server, 'constructor')).rejects.toMatchObject({ code: EErrorCode.METHOD_NOT_FOUND })
    await vi.advanceTimersByTimeAsync(10)
    await missing
    for (const method of ['constructor', 'toString', '__proto__']) {
      server.on(client, method, () => method)
      await expect(client.emit(server, method)).resolves.toBe(method)
      server.off(client, method)
    }
  })

  it('does not mutate caller-owned handler arrays', async () => {
    const client = hub()
    const server = hub()
    const handlers = Object.freeze([() => 'first'])
    server.on(client, { echo: handlers as unknown as IFn[] })
    server.on(client, 'echo', () => 'second')
    expect(handlers).toHaveLength(1)
    await expect(client.emit(server, 'echo')).resolves.toBe('first')
  })

  it('does not acknowledge an empty handler list', async () => {
    const client = hub({ heartbeatTimeout: 10 })
    const server = hub()
    server.on(client, { empty: [] })
    const response = expect(client.emit(server, 'empty')).rejects.toMatchObject({ code: EErrorCode.METHOD_NOT_FOUND })
    await vi.advanceTimersByTimeAsync(10)
    await response
    expect(server.sent).toHaveLength(0)
  })

  it('ignores malformed messages without invoking handlers or rejecting event listeners', async () => {
    const client = hub()
    const server = hub()
    const handler = vi.fn()
    server.on(client, 'echo', handler)
    const base = { from: client.instanceID, messageID: 1, type: 'request', methodName: 'echo', data: [] }
    for (const message of [null, 1, 'text', {}, { ...base, data: null }, { ...base, methodName: 1 }, { ...base, messageID: '1' }, { ...base, type: 'other' }]) {
      await expect(server.receive(client, message)).resolves.toBeUndefined()
    }
    expect(handler).not.toHaveBeenCalled()
    expect(server.sent).toHaveLength(0)
  })
})

describe('heartbeat protocol compatibility', () => {
  it('delivers the legacy heartbeat string and heartbeat-shaped objects as business progress', async () => {
    const client = hub()
    const server = hub()
    const onprogress = vi.fn()
    const indicator = '--message-hub-to-be-continued--'
    server.on(client, 'download', (options: { onprogress: IFn }) => {
      options.onprogress(indicator)
      options.onprogress({ heartbeat: true, data: indicator })
      return 'done'
    })
    await expect(client.emit(server, 'download', { onprogress })).resolves.toBe('done')
    expect(onprogress.mock.calls).toEqual([[indicator], [{ heartbeat: true, data: indicator }]])
    // Older callers still identify this same sentinel as the handshake.
    expect(server.sent[0]).toMatchObject({ type: 'progress', heartbeat: true, data: indicator })
    expect(server.sent[1]).toMatchObject({ type: 'progress', heartbeat: false, data: indicator })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('accepts an unmarked legacy heartbeat and waits beyond the heartbeat timeout', async () => {
    class LegacyHub extends TestHub {
      protected override buildProgressMessage(data: any, request: IRequest) {
        const message = super.buildProgressMessage(data, request)
        delete message.heartbeat
        return message
      }
    }
    const client = hub({ heartbeatTimeout: 10 })
    const server = new LegacyHub()
    hubs.push(server)
    let finish!: (value: string) => void
    server.on(client, 'slow', () => new Promise<string>((resolve) => { finish = resolve }))
    const response = client.emit(server, 'slow')
    await vi.advanceTimersByTimeAsync(1000)
    expect(client.pendingCount).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
    finish('legacy result')
    await expect(response).resolves.toBe('legacy result')
  })

  it('ignores malformed heartbeat markers without acknowledging the request', async () => {
    const client = hub({ heartbeatTimeout: 10 })
    const server = hub()
    const response = expect(client.emit(server, 'missing')).rejects.toMatchObject({ code: EErrorCode.METHOD_NOT_FOUND })
    await client.receive(server, {
      from: server.instanceID, to: client.instanceID, messageID: 1,
      type: 'progress', heartbeat: 'true', data: '--message-hub-to-be-continued--',
    })
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(10)
    await response
  })
})

describe('local request controls', () => {
  it('does not send or allocate timers for an already aborted signal', async () => {
    const client = hub()
    const controller = new AbortController()
    controller.abort()
    await expect(client.emit(hub(), {
      methodName: 'missing', signal: controller.signal, requestTimeout: 100,
    })).rejects.toMatchObject({ code: EErrorCode.REQUEST_ABORTED })
    expect(client.sent).toHaveLength(0)
    expect(client.pendingCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('aborts before heartbeat and removes the abort listener and both timers', async () => {
    const client = hub()
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const response = expect(client.emit(hub(), {
      methodName: 'missing', signal: controller.signal, requestTimeout: 100,
    })).rejects.toMatchObject({ code: EErrorCode.REQUEST_ABORTED })
    expect(vi.getTimerCount()).toBe(2)
    controller.abort()
    await response
    expect(remove).toHaveBeenCalledOnce()
    expect(client.pendingCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('aborts after heartbeat, ignores late progress/results, and leaves the peer handler running', async () => {
    const client = hub()
    const server = hub()
    const controller = new AbortController()
    const onprogress = vi.fn()
    let finish!: () => void
    let progress!: IFn
    server.on(client, 'slow', (options: { onprogress: IFn }) => {
      progress = options.onprogress
      return new Promise<void>((resolve) => { finish = resolve })
    })
    const response = expect(client.emit(server, {
      methodName: 'slow', signal: controller.signal, requestTimeout: 100,
    }, { onprogress })).rejects.toMatchObject({ code: EErrorCode.REQUEST_ABORTED })
    expect(vi.getTimerCount()).toBe(1)
    controller.abort()
    await response
    progress('late')
    finish()
    await Promise.resolve()
    await Promise.resolve()
    expect(onprogress).not.toHaveBeenCalled()
    expect(server.sent.some((message) => message.type === 'response')).toBe(true)
    expect(client.pendingCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    server.on(client, 'echo', () => 'still usable')
    await expect(client.emit(server, 'echo')).resolves.toBe('still usable')
  })

  it('times out after heartbeat even if progress continues, and detaches the abort listener', async () => {
    const client = hub()
    const server = hub()
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const onprogress = vi.fn()
    let progress!: IFn
    server.on(client, 'slow', (options: { onprogress: IFn }) => {
      progress = options.onprogress
      return new Promise(() => {})
    })
    const response = expect(client.emit(server, {
      methodName: 'slow', requestTimeout: 30, signal: controller.signal,
    }, { onprogress })).rejects.toMatchObject({ code: EErrorCode.REQUEST_TIMEOUT })
    await vi.advanceTimersByTimeAsync(20)
    progress('working')
    expect(onprogress).toHaveBeenCalledWith('working')
    await vi.advanceTimersByTimeAsync(10)
    await response
    progress('late')
    expect(onprogress).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledOnce()
    expect(client.pendingCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('counts heartbeat wait toward the total request deadline', async () => {
    const client = hub({ heartbeatTimeout: 100 })
    const response = expect(client.emit(hub(), {
      methodName: 'missing', requestTimeout: 10,
    })).rejects.toMatchObject({ code: EErrorCode.REQUEST_TIMEOUT })
    await vi.advanceTimersByTimeAsync(10)
    await response
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps the missing-handler error when heartbeat wait expires before the deadline', async () => {
    const client = hub({ heartbeatTimeout: 10 })
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const response = expect(client.emit(hub(), {
      methodName: 'missing', requestTimeout: 100, signal: controller.signal,
    })).rejects.toMatchObject({ code: EErrorCode.METHOD_NOT_FOUND })
    await vi.advanceTimersByTimeAsync(10)
    await response
    expect(remove).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('supports a hub deadline, per-call override, and explicitly disabling it with 0', async () => {
    const client = hub({ requestTimeout: 10 })
    const server = hub()
    let finish!: (value: string) => void
    server.on(client, 'slow', () => new Promise<string>((resolve) => { finish = resolve }))
    const defaultTimeout = expect(client.emit(server, 'slow')).rejects.toMatchObject({ code: EErrorCode.REQUEST_TIMEOUT })
    await vi.advanceTimersByTimeAsync(10)
    await defaultTimeout
    const override = expect(client.emit(server, { methodName: 'slow', requestTimeout: 30 })).rejects.toMatchObject({ code: EErrorCode.REQUEST_TIMEOUT })
    await vi.advanceTimersByTimeAsync(10)
    expect(client.pendingCount).toBe(1)
    await vi.advanceTimersByTimeAsync(20)
    await override
    const disabled = client.emit(server, { methodName: 'slow', requestTimeout: 0 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(client.pendingCount).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
    finish('no deadline')
    await expect(disabled).resolves.toBe('no deadline')
  })

  it('preserves frozen options, strips local controls from the wire, and removes listeners on success', async () => {
    const client = hub()
    const server = hub()
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const options = Object.freeze({ methodName: 'echo', signal: controller.signal, requestTimeout: 100, to: server.instanceID })
    server.on(client, 'echo', (value: number) => value)
    await expect(client.emit(server, options, 42)).resolves.toBe(42)
    expect(options.signal).toBe(controller.signal)
    expect(client.sent[0]).not.toHaveProperty('signal')
    expect(client.sent[0]).not.toHaveProperty('requestTimeout')
    expect(remove).toHaveBeenCalledOnce()
    controller.abort()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['send failure', 'destroy'])('cleans up all controls on %s', async (scenario) => {
    const client = hub()
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    client.failSend = scenario === 'send failure'
    const response = expect(client.emit(hub(), {
      methodName: 'missing', signal: controller.signal, requestTimeout: 100,
    })).rejects.toMatchObject({ code: scenario === 'destroy' ? EErrorCode.UNKNOWN : EErrorCode.INVALID_MESSAGE })
    if (scenario === 'destroy') client.destroy()
    await response
    expect(remove).toHaveBeenCalledOnce()
    expect(client.pendingCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('handles abort during listener registration before anything is sent', async () => {
    const client = hub()
    const controller = new AbortController()
    const add = controller.signal.addEventListener.bind(controller.signal)
    vi.spyOn(controller.signal, 'addEventListener').mockImplementation((...args) => {
      controller.abort()
      add(...args)
    })
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    await expect(client.emit(hub(), {
      methodName: 'missing', signal: controller.signal, requestTimeout: 100,
    })).rejects.toMatchObject({ code: EErrorCode.REQUEST_ABORTED })
    expect(client.sent).toHaveLength(0)
    expect(remove).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cleans up when abort listener registration fails', async () => {
    const client = hub()
    const controller = new AbortController()
    vi.spyOn(controller.signal, 'addEventListener').mockImplementation(() => { throw new Error('registration failed') })
    await expect(client.emit(hub(), {
      methodName: 'missing', signal: controller.signal, requestTimeout: 100,
    })).rejects.toMatchObject({ code: EErrorCode.INVALID_MESSAGE })
    expect(client.sent).toHaveLength(0)
    expect(client.pendingCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([-1, NaN, Infinity, 2147483648])('rejects invalid deadline %s without pending state', async (requestTimeout) => {
    expect(() => hub({ requestTimeout })).toThrow(RangeError)
    const client = hub()
    await expect(client.emit(hub(), { methodName: 'missing', requestTimeout })).rejects.toMatchObject({ code: EErrorCode.INVALID_MESSAGE })
    expect(client.sent).toHaveLength(0)
    expect(client.pendingCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects invalid signals without creating a pending request', async () => {
    const client = hub()
    await expect(client.emit(hub(), { methodName: 'missing', signal: {} as AbortSignal })).rejects.toMatchObject({ code: EErrorCode.INVALID_MESSAGE })
    expect(client.pendingCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
