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

  it('supports a zero heartbeat timeout and cleans missing-handler requests', async () => {
    const client = hub({ heartbeatTimeout: 0 })
    const response = expect(client.emit(hub(), 'missing')).rejects.toMatchObject({ code: EErrorCode.METHOD_NOT_FOUND })
    await vi.advanceTimersByTimeAsync(0)
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

  it.each([null, undefined, 'failure', { stack: 'custom stack' }])('handles non-Error throws: %s', async (error) => {
    const client = hub()
    const server = hub()
    server.on(client, 'fail', () => { throw error })
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
