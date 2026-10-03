import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import { MainMessageHub, RendererMessageHub } from '../src/index'

const transport = vi.hoisted(() => {
  type Listener = (event: { sender: unknown }, data: unknown) => unknown
  class Ipc {
    listeners = new Map<string, Set<Listener>>()
    on(channel: string, listener: Listener) {
      const listeners = this.listeners.get(channel) ?? new Set<Listener>()
      listeners.add(listener)
      this.listeners.set(channel, listeners)
    }
    off(channel: string, listener: Listener) { this.listeners.get(channel)?.delete(listener) }
    receive(channel: string, sender: unknown, data: unknown) {
      for (const listener of this.listeners.get(channel) ?? []) void listener({ sender }, data)
    }
  }
  const ipcMain = new Ipc()
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
  return { ipcMain, ipcRenderer, webContents }
})

vi.mock('electron', () => ({ default: transport }))

const hubs: (MainMessageHub | RendererMessageHub)[] = []
function inProcess(type: 'browser' | 'renderer') {
  vi.stubGlobal('process', { ...process, type })
}
function pair(channelName?: string) {
  inProcess('browser')
  const main = new MainMessageHub({ channelName })
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
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Electron IPC', () => {
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
