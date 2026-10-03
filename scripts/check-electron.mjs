import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const browserRequire = createRequire(new URL('../packages/duplex-message/package.json', import.meta.url))
const electronRequire = createRequire(process.env.ELECTRON_SMOKE_PACKAGE_DIR
  ? resolve(process.env.ELECTRON_SMOKE_PACKAGE_DIR, 'package.json')
  : new URL('../packages/simple-electron-ipc/package.json', import.meta.url))
const { _electron } = browserRequire('playwright')
const args = [fileURLToPath(new URL('../packages/simple-electron-ipc/demo/dist/main.js', import.meta.url))]
// Some container runners cannot create Chromium sandbox namespaces.
if (process.env.ELECTRON_SMOKE_NO_SANDBOX === '1') args.push('--no-sandbox')
const app = await _electron.launch({ executablePath: electronRequire('electron'), args })
try {
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.waitForFunction(() => typeof window.duplexDemo?.calculate === 'function')
  const preferences = await app.evaluate(({ BrowserWindow }) => {
    const prefs = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()
    return { nodeIntegration: prefs.nodeIntegration, contextIsolation: prefs.contextIsolation, sandbox: prefs.sandbox }
  })
  assert.deepEqual(preferences, { nodeIntegration: false, contextIsolation: true, sandbox: true })
  assert.deepEqual(await page.evaluate(() => ({ require: typeof window.require, process: typeof window.process })), {
    require: 'undefined', process: 'undefined',
  })
  assert.deepEqual(await page.evaluate(() => Object.keys(window.duplexDemo).sort()), [
    'calculate', 'cancelDownload', 'download', 'getTitle',
  ])
  assert.equal(await page.evaluate(() => window.duplexDemo.calculate(2, 3)), 5)
  assert.equal(await page.evaluate(() => window.duplexDemo.getTitle('Title: ')), 'Title: Duplex Message Electron Demo')
  const download = await page.evaluate(async () => {
    const progress = []
    const result = await window.duplexDemo.download(count => progress.push(count))
    return { result, progress }
  })
  assert.equal(download.result, 'done')
  assert.deepEqual(download.progress, [10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
  const cancelled = await page.evaluate(async () => {
    try {
      await window.duplexDemo.download(() => window.duplexDemo.cancelDownload())
      return false
    } catch (error) { return String(error.message).includes('aborted') }
  })
  assert.equal(cancelled, true)
  await page.getByRole('button', { name: 'Calculate 2 + 3 through bidirectional RPC', exact: true }).click()
  await page.waitForFunction(() => document.getElementById('get-calc-resp').textContent === '5')
  assert.deepEqual(errors, [])
  console.log('Electron smoke passed isolated/sandboxed preload configuration, fixed bridge API, typed bidirectional RPC, progress, cancellation and renderer UI.')
} finally { await app.close() }
