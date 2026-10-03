import { describe, expect, inject, it, vi } from 'vitest'
import { EErrorCode } from '../../../src/abstract'
import { PostMessageHub } from '../../../src/post-message'
import { waitForPeer } from '../../../src/readiness'
import { createRpcClient } from '../../../src/rpc-client'
import { track } from '../../resources'
import DemoWorker from '../worker/worker?worker'

function frame() {
  const element = track(document.createElement('iframe'))
  const url = new URL('/test/post-message/security/frame.html', inject('frameOrigin'))
  url.searchParams.set('parentOrigin', location.origin)
  element.src = url.href
  document.body.appendChild(element)
  return { peer: element.contentWindow!, origin: url.origin }
}

describe('window origin policy and readiness', () => {
  it('connects to a real cross-origin iframe before calling a typed business method', async () => {
    const { peer, origin } = frame()
    const hub = track(new PostMessageHub({ allowedOrigins: [origin], targetOrigin: origin }))
    await waitForPeer(method => hub.emit(peer, method), { timeout: 5000 })
    const rpc = createRpcClient<{ echo(value: string): string }>((method, ...args) => hub.emit(peer, method, ...args))
    await expect(rpc.call('echo', 'trusted')).resolves.toBe('trusted')
  })

  it('ignores requests from disallowed origins before running handlers', async () => {
    const hub = track(new PostMessageHub({ allowedOrigins: [location.origin] }))
    const handler = vi.fn(() => 'secret')
    hub.on(self, 'secret', handler)
    window.dispatchEvent(new MessageEvent('message', {
      source: window, origin: 'https://untrusted.example',
      data: { from: 'remote', to: hub.instanceID, messageID: 1, type: 'request', methodName: 'secret', data: [] },
    }))
    await Promise.resolve()
    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores responses from a real iframe outside the configured origins', async () => {
    const { peer, origin } = frame()
    const trusted = track(new PostMessageHub({ allowedOrigins: [origin], targetOrigin: origin }))
    await waitForPeer(method => trusted.emit(peer, method))
    const hub = track(new PostMessageHub({ allowedOrigins: ['https://untrusted.example'], targetOrigin: origin }))
    await expect(hub.emit(peer, { methodName: 'echo', requestTimeout: 100 }, 'blocked'))
      .rejects.toMatchObject({ code: EErrorCode.REQUEST_TIMEOUT })
  })

  it('pins replies to the accepted request origin', async () => {
    const hub = track(new PostMessageHub({ allowedOrigins: [location.origin], targetOrigin: 'https://other.example' }))
    const send = vi.spyOn(window, 'postMessage')
    hub.on(self, 'echo', () => 'done')
    window.dispatchEvent(new MessageEvent('message', {
      source: window, origin: location.origin,
      data: { from: 'remote', to: hub.instanceID, messageID: 1, type: 'request', methodName: 'echo', data: [] },
    }))
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'response' }), location.origin))
    send.mockRestore()
  })

  it('keeps the configured outgoing origin after receiving an accepted message', async () => {
    const targetOrigin = 'https://outgoing.example'
    const hub = track(new PostMessageHub({ allowedOrigins: [location.origin], targetOrigin }))
    const send = vi.spyOn(window, 'postMessage')
    hub.on(self, 'echo', () => 'done')
    window.dispatchEvent(new MessageEvent('message', {
      source: window, origin: location.origin,
      data: { from: 'remote', to: hub.instanceID, messageID: 1, type: 'request', methodName: 'echo', data: [] },
    }))
    const controller = new AbortController()
    const pending = expect(hub.emit(self, { methodName: 'outgoing', signal: controller.signal }))
      .rejects.toMatchObject({ code: EErrorCode.REQUEST_ABORTED })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'request' }), targetOrigin)
    controller.abort()
    await pending
    send.mockRestore()
  })

  it('keeps Worker communication working with a window origin policy', async () => {
    const worker = track(new DemoWorker())
    const hub = track(new PostMessageHub({ allowedOrigins: [] }))
    await expect(hub.emit(worker, 'greet', 'hello')).resolves.toBe('hello')
  })

  it('keeps an asynchronous response pinned to its request origin after another accepted origin sends a request', async () => {
    const otherOrigin = 'https://other.example'
    const hub = track(new PostMessageHub({ allowedOrigins: [location.origin, otherOrigin] }))
    const send = vi.spyOn(window, 'postMessage')
    let finish!: (value: string) => void
    hub.on(self, 'slow', () => new Promise<string>(resolve => { finish = resolve }))
    hub.on(self, 'echo', () => 'second')
    const request = (origin: string, from: string, messageID: number, methodName: string) => {
      window.dispatchEvent(new MessageEvent('message', {
        source: window, origin,
        data: { from, to: hub.instanceID, messageID, type: 'request', methodName, data: [] },
      }))
    }
    request(location.origin, 'first', 1, 'slow')
    request(otherOrigin, 'second', 2, 'echo')
    finish('first result')
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'response', to: 'first', messageID: 1 }), location.origin,
    ))
    send.mockRestore()
  })

  it('copies caller-owned origin lists and validates options', () => {
    const origins = [location.origin]
    const hub = track(new PostMessageHub({ allowedOrigins: origins }))
    origins.push('https://other.example')
    const handler = vi.fn()
    hub.on(self, 'echo', handler)
    window.dispatchEvent(new MessageEvent('message', {
      source: window, origin: 'https://other.example',
      data: { from: 'remote', messageID: 1, type: 'request', methodName: 'echo', data: [] },
    }))
    expect(handler).not.toHaveBeenCalled()
    expect(() => new PostMessageHub({ allowedOrigins: [''] })).toThrow(TypeError)
    expect(() => new PostMessageHub({ targetOrigin: '' })).toThrow(TypeError)
  })
})
