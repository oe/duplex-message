import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'

const root = fileURLToPath(new URL('../', import.meta.url))
const consumer = await mkdtemp(join(tmpdir(), 'duplex-message-consumer-'))
const packages = ['duplex-message', 'simple-electron-ipc']
const run = (command, args, cwd = consumer) => execFileSync(command, args, {
  cwd,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
})

try {
  const archives = join(consumer, 'archives')
  await mkdir(archives)
  for (const name of packages) {
    const source = join(root, 'packages', name)
    const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
    run('pnpm', ['pack', '--pack-destination', archives], source)
    const destination = join(consumer, 'node_modules', name)
    await mkdir(destination, { recursive: true })
    run('tar', ['-xzf', join(archives, `${name}-${manifest.version}.tgz`), '--strip-components=1', '-C', destination])
    const packed = JSON.parse(await readFile(join(destination, 'package.json'), 'utf8'))
    assert.ok(!JSON.stringify(packed).includes('workspace:'), 'workspace dependency leaked into package')
    for (const entry of Object.values(packed.exports['.'])) await readFile(join(destination, entry))
  }

  // Use a transport stub for Node import checks; Electron runtime integration is tested separately.
  const electron = join(consumer, 'node_modules', 'electron')
  await mkdir(electron)
  await writeFile(join(electron, 'package.json'), JSON.stringify({
    name: 'electron', version: '44.5.1', main: 'index.js', types: 'electron.d.ts',
  }))
  await writeFile(join(electron, 'index.js'), 'module.exports = { ipcMain: { on() {}, off() {} }, ipcRenderer: { on() {}, off() {} } }\n')
  const requireElectron = createRequire(join(root, 'packages/simple-electron-ipc/package.json'))
  await cp(join(dirname(requireElectron.resolve('electron/package.json')), 'electron.d.ts'), join(electron, 'electron.d.ts'))
  await mkdir(join(consumer, 'node_modules', '@types'))
  const requireRoot = createRequire(join(root, 'package.json'))
  await symlink(dirname(requireRoot.resolve('@types/node/package.json')), join(consumer, 'node_modules', '@types', 'node'))

  const smoke = `
    import assert from 'node:assert/strict'
    import { createRequire } from 'node:module'
    import * as esm from 'duplex-message'
    import { MainMessageHub as EsmMain } from 'simple-electron-ipc'
    const require = createRequire(import.meta.url)
    const cjs = require('duplex-message')
    const { MainMessageHub, RendererMessageHub } = require('simple-electron-ipc')
    for (const api of [esm, cjs]) {
      assert.equal(typeof api.PostMessageHub, 'function')
      const channelName = 'packed-' + Math.random()
      const client = new api.BroadcastMessageHub({ channelName })
      const server = new api.BroadcastMessageHub({ channelName })
      try {
        server.on('sum', (a, b) => a + b)
        assert.equal(await client.emit(Object.freeze({ methodName: 'sum', to: server.instanceID }), 2, 3), 5)
        const controller = new AbortController()
        const updates = []
        server.on('progress', (options) => {
          options.onprogress('--message-hub-to-be-continued--')
          return 'done'
        })
        assert.equal(await client.emit({ methodName: 'progress', signal: controller.signal, requestTimeout: 1000 }, {
          onprogress(value) { updates.push(value) },
        }), 'done')
        assert.deepEqual(updates, ['--message-hub-to-be-continued--'])
        server.on('slow', () => new Promise(() => {}))
        const cancelled = assert.rejects(client.emit({ methodName: 'slow', signal: controller.signal }), { code: 6 })
        controller.abort()
        await cancelled
        await assert.rejects(client.emit({ methodName: 'slow', requestTimeout: 20 }), { code: 7 })
      } finally { client.destroy(); server.destroy() }
    }
    Object.defineProperty(process, 'type', { configurable: true, value: 'browser' })
    new MainMessageHub().destroy()
    new EsmMain().destroy()
    Object.defineProperty(process, 'type', { configurable: true, value: 'renderer' })
    new RendererMessageHub().destroy()
  `
  await writeFile(join(consumer, 'smoke.mjs'), smoke)
  run(process.execPath, ['smoke.mjs'])

  const types = `
    import { BroadcastMessageHub, EErrorCode, type IError } from 'duplex-message'
    import { MainMessageHub, RendererMessageHub } from 'simple-electron-ipc'
    const hub = new BroadcastMessageHub()
    const result: Promise<number> = hub.emit<number>('sum', 1, 2)
    const error: IError = { code: EErrorCode.INVALID_MESSAGE, message: 'test' }
    hub.on('sum', (a: number, b: number) => a + b)
    const main = new MainMessageHub()
    main.on('*', 'sum', (a: number, b: number) => a + b)
    const renderer = new RendererMessageHub()
    const title: Promise<string> = renderer.emit<string>('title')
    const controller = new AbortController()
    const timed: Promise<number> = hub.emit<number>({ methodName: 'sum', requestTimeout: 100, signal: controller.signal }, 1, 2)
    const ipcTimed: Promise<string> = renderer.emit<string>({ methodName: 'title', requestTimeout: 100, signal: controller.signal })
    const timeoutError: IError = { code: EErrorCode.REQUEST_TIMEOUT, message: 'timeout' }
    const abortError: IError = { code: EErrorCode.REQUEST_ABORTED, message: 'aborted' }
    void [result, error, title, timed, ipcTimed, timeoutError, abortError]
  `
  await writeFile(join(consumer, 'types.cts'), types)
  await writeFile(join(consumer, 'types.mts'), types)
  await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { strict: true, noEmit: true, module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022' },
    include: ['types.cts', 'types.mts'],
  }))
  run('pnpm', ['exec', 'tsc', '-p', join(consumer, 'tsconfig.json')], root)

  for (const file of ['index.umd.js', 'index.production.umd.js']) {
    const context = {}
    runInNewContext(await readFile(join(consumer, 'node_modules/duplex-message/dist', file), 'utf8'), context)
    assert.equal(typeof context['duplex-message'].PostMessageHub, 'function')
  }
  for (const name of packages) await readFile(join(consumer, 'node_modules', name, 'dist/index.es.js'))
  await readFile(join(consumer, 'node_modules/duplex-message/dist/index.production.es.js'))

  await writeFile(join(consumer, 'shake.mjs'), "export { PageScriptMessageHub } from 'duplex-message'\n")
  const requireBrowser = createRequire(join(root, 'packages/duplex-message/package.json'))
  const { build } = await import(pathToFileURL(requireBrowser.resolve('vite')).href)
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: { write: false, lib: { entry: join(consumer, 'shake.mjs'), formats: ['es'] } },
  })
  const builds = Array.isArray(result) ? result : [result]
  const code = builds.flatMap((item) => item.output)
    .filter((item) => item.type === 'chunk').map((item) => item.code).join('\n')
  for (const unused of ['localStorage', 'BroadcastChannel', '_hostedWorkers']) {
    assert.ok(!code.includes(unused), `unused transport retained: ${unused}`)
  }
  console.log('Packed packages passed CJS/ESM RPC, Electron import, NodeNext types, UMD and tree-shaking checks.')
} finally {
  await rm(consumer, { recursive: true, force: true })
}
