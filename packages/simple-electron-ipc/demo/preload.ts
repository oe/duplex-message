import { contextBridge } from 'electron'
import { RendererMessageHub, createRpcClient } from 'simple-electron-ipc'
import type { DemoApi, MainMethods, PreloadMethods } from './api'

const hub = new RendererMessageHub({ requestTimeout: 5000 })
const main = createRpcClient<MainMethods>((method, ...args) => hub.emit(method, ...args))
hub.on({
  pageTitle: () => document.title,
  addNumbers: (a, b) => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new TypeError('numbers required')
    return a + b
  },
} satisfies PreloadMethods)

let downloadController: AbortController | undefined
const api: DemoApi = {
  async download(onprogress) {
    if (typeof onprogress !== 'function') throw new TypeError('callback required')
    if (downloadController) throw new Error('a download is already pending')
    const controller = new AbortController()
    downloadController = controller
    try {
      return await main.call({ methodName: 'download', signal: controller.signal }, { onprogress })
    } finally { downloadController = undefined }
  },
  cancelDownload: () => downloadController?.abort(),
  getTitle: prefix => main.call('getTitle', prefix),
  calculate: (a, b) => main.call('calculate', a, b),
}
// Expose specific application operations; keep hubs, channel names and signals in preload.
contextBridge.exposeInMainWorld('duplexDemo', api)
window.addEventListener('unload', () => { downloadController?.abort(); hub.destroy() })
