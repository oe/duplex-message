import { app, BrowserWindow, type WebContents } from 'electron'
import { MainMessageHub, createRpcClient } from 'simple-electron-ipc'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { MainMethods, PreloadMethods } from './api'

const trusted = new Map<WebContents, string>()
const hub = new MainMessageHub({
  requestTimeout: 5000,
  validateSender(event) {
    const url = trusted.get(event.sender)
    return url !== undefined && event.senderFrame === event.sender.mainFrame
      && event.senderFrame.url === url
  },
})

function createWindow() {
  const window = new BrowserWindow({
    width: 800, height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: join(__dirname, 'preload.cjs'),
    },
  })
  const file = join(__dirname, '../index.html')
  const target = window.webContents
  trusted.set(target, pathToFileURL(file).href)
  target.setWindowOpenHandler(() => ({ action: 'deny' }))
  target.on('will-navigate', event => event.preventDefault())
  const timers = new Set<ReturnType<typeof setInterval>>()
  const renderer = createRpcClient<PreloadMethods>((method, ...args) => hub.emit(target, method, ...args))
  hub.on(target, {
    download(options) {
      if (typeof options?.onprogress !== 'function') throw new TypeError('progress callback required')
      return new Promise<string>(resolve => {
        let count = 0
        const timer = setInterval(() => {
          count += 10
          options.onprogress(count)
          if (count === 100) {
            clearInterval(timer)
            timers.delete(timer)
            resolve('done')
          }
        }, 50)
        timers.add(timer)
      })
    },
    async getTitle(prefix) {
      if (typeof prefix !== 'string') throw new TypeError('prefix must be a string')
      return prefix + await renderer.call('pageTitle')
    },
    calculate(a, b) {
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new TypeError('numbers required')
      return renderer.call('addNumbers', a, b)
    },
  } satisfies MainMethods)
  window.on('closed', () => {
    timers.forEach(clearInterval)
    trusted.delete(target)
    hub.off(target)
  })
  void window.loadFile(file)
}

void app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('will-quit', () => hub.destroy())
