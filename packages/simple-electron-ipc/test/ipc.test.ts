import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import { MainMessageHub, RendererMessageHub, type IMainMessageHubOptions } from '../src/index'

const transport = vi.hoisted(() => {
  type Listener = (event: { sender: unknown; senderFrame: { url: string } }, data: unknown) => unknown
  class Ipc {
    listeners = new Map<string, Set<Listener>>()
    on(channel: string, listener: Listener) {
      const listeners = this.listeners.get(channel) ?? new Set<Listener>()
      listeners.add(listener)
      this.listeners.set(channel, listeners)
    }
    off(channel: string, listener: Listener) { this.listeners.get(channel)?.delete(listener) }
    receive(channel: string, sender: unknown, data: unknown) {
      for (const listener of this.listeners.get(channel) ?? []) void listener({ sender, senderFrame: frame }, data)
    }
  }
  const ipcMain = new Ipc()
  const frame = { url: 'file:///app/index.html' }
  const ipcRenderer = Object.assign(new Ipc(), {
    send(channel: string, data: unknown) {
      const message = structuredClone(data)
      queueMicrotask(() => ipcMain.receive(channel, webContents, message))
    },
  })
  const webContents = {
    send(channel: string, data: unknown) {
      const message = structuredClone(data)
      queueMicrotask(() => ipcRenderer.receive(channel, ipcRenderer, message))
    },
  }
  return { ipcMain, ipcRenderer, webContents, frame }
})

vi.mock('electron', () => ({ default: transport }))

const hubs: (MainMessageHub | RendererMessageHub)[] = []
function inProcess(type: 'browser' | 'renderer') {
  vi.stubGlobal('process', { ...process, type })
}
function pair(channelName?: string, validateSender?: IMainMessageHubOptions['validateSender']) {
  inProcess('browser')
  const main = new MainMessageHub({ channelName, validateSender })
  inProcess('renderer')
  const renderer = new RendererMessageHub({ channelName })
  hubs.push(main, renderer)
  return { main, renderer, target: transport.webContents as unknown as WebContents }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  hubs.splice(0).forEach((hub) => hub.destroy())
  transport.ipcMain.listeners.clear()
  transport.ipcRenderer.listeners.clear()
  transport.frame.url = 'file:///app/index.html'
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Electron IPC', () => {
  it.each([undefined, 'true', 1, {}, Promise.resolve(false), Promise.resolve(true)])(
    'requires an explicit synchronous true from the sender validator (%j)', async value => {
      const { main, renderer, target } = pair(undefined, (() => value) as unknown as IMainMessageHubOptions['validateSender'])
      const handler = vi.fn(() => 'secret')
      main.on(target, 'secret', handler)
      const response = expect(renderer.emit('secret')).rejects.toMatchObject({ code: 3 })
      await vi.advanceTimersByTimeAsync(500)
      await response
      expect(handler).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('accepts a trusted sender and frame', async () => {
    const { main, renderer, target } = pair(undefined, event => event.sender === transport.webContents
      && event.senderFrame?.url === 'file:///app/index.html')
    main.on(target, 'echo', () => 'trusted')
    await expect(renderer.emit('echo')).resolves.toBe('trusted')
  })

  it('ignores an accidentally async throwing validator without an unhandled rejection', async () => {
    const validate = async () => { throw new Error('cannot validate sender') }
    const { main, renderer, target } = pair(undefined, validate as unknown as IMainMessageHubOptions['validateSender'])
    const handler = vi.fn(() => 'secret')
    main.on(target, 'secret', handler)
    const response = expect(renderer.emit('secret')).rejects.toMatchObject({ code: 3 })
    await vi.advanceTimersByTimeAsync(500)
    await response
    expect(handler).not.toHaveBeenCalled()
  })

  it.each(['untrusted frame', 'throwing validator'])('ignores IPC from %s before running handlers', async scenario => {
    const { main, renderer, target } = pair(undefined, event => {
      if (scenario === 'throwing validator') throw new Error('cannot validate sender')
      return event.senderFrame?.url === 'file:///app/index.html'
    })
    transport.frame.url = 'https://untrusted.example'
    const handler = vi.fn(() => 'secret')
    main.on(target, 'secret', handler)
    const response = expect(renderer.emit('secret')).rejects.toMatchObject({ code: 3 })
    await vi.advanceTimersByTimeAsync(500)
    await response
    expect(handler).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('delivers reserved-string progress with request controls across serialized IPC', async () => {
    const { main, renderer } = pair()
    main.on('*', 'progress', (options: { onprogress: (value: string) => void }) => {
      options.onprogress('--message-hub-to-be-continued--')
      return 'done'
    })
    const controller = new AbortController()
    const onprogress = vi.fn()
    await expect(renderer.emit({
      methodName: 'progress', signal: controller.signal, requestTimeout: 100,
    }, { onprogress })).resolves.toBe('done')
    expect(onprogress.mock.calls).toEqual([['--message-hub-to-be-continued--']])
    controller.abort()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['main', 'renderer'])('supports local cancellation and deadlines from the %s process', async (side) => {
    const { main, renderer, target } = pair()
    const slow = (options: { onprogress: (value: string) => void }) => {
      options.onprogress('started')
      return new Promise(() => {})
    }
    main.on(target, 'slow', slow)
    renderer.on('slow', slow)
    const emit = (options: { methodName: string; signal?: AbortSignal; requestTimeout: number }, onprogress: (value: string) => void) => side === 'main'
      ? main.emit(target, options, { onprogress }) : renderer.emit(options, { onprogress })
    const controller = new AbortController()
    const onprogress = vi.fn()
    const aborted = expect(emit({ methodName: 'slow', signal: controller.signal, requestTimeout: 100 }, onprogress))
      .rejects.toMatchObject({ code: 6 })
    await vi.advanceTimersByTimeAsync(0)
    expect(onprogress).toHaveBeenCalledWith('started')
    controller.abort()
    await aborted
    expect(vi.getTimerCount()).toBe(0)
    const timedOut = expect(emit({ methodName: 'slow', requestTimeout: 20 }, onprogress))
      .rejects.toMatchObject({ code: 7 })
    await vi.advanceTimersByTimeAsync(20)
    await timedOut
    expect(vi.getTimerCount()).toBe(0)
  })

  it('supports calls in both directions and progress across the IPC serialization boundary', async () => {
    const { main, renderer, target } = pair()
    main.on(target, 'sum', (a: number, b: number) => a + b)
    renderer.on('title', () => 'Duplex')
    await expect(renderer.emit('sum', 2, 3)).resolves.toBe(5)
    await expect(main.emit(target, 'title')).resolves.toBe('Duplex')
    main.on('*', 'download', (options: { onprogress: (n: number) => void }) => {
      options.onprogress(50)
      options.onprogress(100)
      return 'done'
    })
    const onprogress = vi.fn()
    await expect(renderer.emit('download', { onprogress })).resolves.toBe('done')
    expect(onprogress.mock.calls).toEqual([[50], [100]])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('removes handlers and isolates custom channels', async () => {
    const first = pair('first')
    const second = pair('second')
    first.main.on('*', 'value', () => 1)
    second.main.on('*', 'value', () => 2)
    await expect(first.renderer.emit('value')).resolves.toBe(1)
    await expect(second.renderer.emit('value')).resolves.toBe(2)
    first.main.off('*', 'value')
    const missing = expect(first.renderer.emit('value')).rejects.toMatchObject({ code: 3 })
    await vi.advanceTimersByTimeAsync(500)
    await missing
  })

  it('rejects pending requests and detaches IPC listeners when destroyed', async () => {
    const { main, renderer } = pair()
    const pending = expect(renderer.emit('missing')).rejects.toMatchObject({ code: 5 })
    renderer.destroy()
    main.destroy()
    await pending
    expect(transport.ipcMain.listeners.get('message-hub')?.size).toBe(0)
    expect(transport.ipcRenderer.listeners.get('message-hub')?.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('enforces process type and recreates destroyed shared hubs', () => {
    inProcess('browser')
    expect(() => new RendererMessageHub()).toThrow('renderer process')
    const main = MainMessageHub.shared
    hubs.push(main)
    expect(MainMessageHub.shared).toBe(main)
    main.destroy()
    hubs.push(MainMessageHub.shared)
    expect(MainMessageHub.shared).not.toBe(main)
    inProcess('renderer')
    expect(() => new MainMessageHub()).toThrow('main process')
    const renderer = RendererMessageHub.shared
    hubs.push(renderer)
    renderer.destroy()
    hubs.push(RendererMessageHub.shared)
    expect(RendererMessageHub.shared).not.toBe(renderer)
  })
})
