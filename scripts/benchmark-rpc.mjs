import assert from 'node:assert/strict'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// Usage: node scripts/benchmark-rpc.mjs /path/to/2.1.0/dist/index.production.es.js [previous-build.mjs]
const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(new URL('../packages/duplex-message/package.json', import.meta.url))
const { chromium } = require('playwright')
assert.ok(process.argv[2], 'Supply the unpacked baseline production ESM file.')
const files = {
  published: process.argv[2],
  ...(process.argv[3] ? { previous: process.argv[3] } : {}),
  current: `${root}packages/duplex-message/dist/index.production.es.mjs`,
}
const sources = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, path]) => [
  `/${name}.mjs`, await readFile(path),
])))
const server = http.createServer((request, response) => {
  const source = sources[request.url]
  response.setHeader('content-type', source ? 'text/javascript' : 'text/html')
  response.end(source ?? '<!doctype html><title>RPC benchmark</title>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
let browser
try {
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('console', message => console.error(message.text()))
  await page.goto(origin)
  const results = await page.evaluate(async ({ origin, versions }) => {
    const modules = Object.fromEntries(await Promise.all(versions.map(async version => [
      version, await import(`${origin}/${version}.mjs`),
    ])))
    const pause = () => new Promise(resolve => setTimeout(resolve, 550))
    const median = values => {
      const sorted = [...values].sort((a, b) => a - b)
      return (sorted[3] + sorted[4]) / 2
    }
    const results = []
    for (const scenario of ['clone-transport', 'worker-sequential', 'worker-32-concurrent']) {
      const peers = {}
      for (const version of versions) {
        if (scenario === 'clone-transport') {
          class Hub extends modules[version].AbstractHub {
            on(peer, name, fn) { this._on(peer, name, fn) }
            off(peer) { this._off(peer) }
            emit(peer, name, ...args) { return this._emit(peer, name, ...args) }
            sendMessage(peer, message) {
              const copy = structuredClone(message)
              queueMicrotask(() => { void peer.onMessage(this, copy) })
            }
          }
          const hub = new Hub(), peer = new Hub()
          peer.on(hub, 'echo', value => value)
          peers[version] = { hub, peer, close: () => { hub.destroy(); peer.destroy() }, samples: [] }
        } else {
          const source = `import {PostMessageHub} from '${origin}/${version}.mjs';
            const hub = new PostMessageHub(); hub.on(self, 'echo', value => value); self.postMessage('ready');`
          const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
          const peer = new Worker(url, { type: 'module' })
          await new Promise((resolve, reject) => {
            peer.onmessage = event => { if (event.data === 'ready') resolve() }
            peer.onerror = reject
          })
          const hub = new modules[version].PostMessageHub()
          peers[version] = { hub, peer, close: () => { hub.destroy(); peer.terminate(); URL.revokeObjectURL(url) }, samples: [] }
        }
        const { hub, peer } = peers[version]
        for (let i = 0; i < 1000; i++) await hub.emit(peer, 'echo', i)
      }
      await pause()
      const count = scenario === 'worker-32-concurrent' ? 16000 : 5000
      const concurrency = scenario === 'worker-32-concurrent' ? 32 : 1
      for (let round = 0; round < 8; round++) {
        const order = versions.map((_, i) => versions[(i + round) % versions.length])
        for (const version of order) {
          const { hub, peer, samples } = peers[version]
          let next = 0
          const start = performance.now()
          await Promise.all(Array.from({ length: concurrency }, async () => {
            while (next < count) {
              const value = next++
              if (await hub.emit(peer, 'echo', value) !== value) throw new Error('incorrect result')
            }
          }))
          samples.push((performance.now() - start) * 1000 / count)
          // Do not let baseline timers expire during another version's measured run.
          await pause()
        }
      }
      for (const version of versions) {
        const { samples, close } = peers[version]
        close()
        results.push({ scenario, version, medianUsPerCall: median(samples), samplesUsPerCall: samples })
      }
      console.log(`${scenario}: complete`)
    }
    return results
  }, { origin, versions: Object.keys(files) })
  await page.close()
  // Isolate each continuous-load run: the old version's uncancelled timers must not
  // expire in the next version's renderer or be hidden by pauses between rounds.
  const versions = Object.keys(files)
  for (const concurrency of [1, 32]) {
    const aggregate = Object.fromEntries(versions.map(version => [version, []]))
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const version of versions.map((_, i) => versions[(i + cycle) % versions.length])) {
        const context = await browser.newContext()
        const steadyPage = await context.newPage()
        try {
          await steadyPage.goto(origin)
          const samples = await steadyPage.evaluate(async ({ origin, version, concurrency }) => {
            const { PostMessageHub } = await import(`${origin}/${version}.mjs`)
            const source = `import {PostMessageHub} from '${origin}/${version}.mjs';
              const hub=new PostMessageHub(); hub.on(self,'echo',value=>value); self.postMessage('ready');`
            const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
            const peer = new Worker(url, { type: 'module' })
            await new Promise((resolve, reject) => {
              peer.onmessage = event => { if (event.data === 'ready') resolve() }
              peer.onerror = reject
            })
            const hub = new PostMessageHub()
            const run = async count => {
              let next = 0
              await Promise.all(Array.from({ length: concurrency }, async () => {
                while (next < count) {
                  const value = next++
                  if (await hub.emit(peer, 'echo', value) !== value) throw new Error('incorrect result')
                }
              }))
            }
            const warmUntil = performance.now() + 1000
            do { await run(1000) } while (performance.now() < warmUntil)
            const count = concurrency === 1 ? 5000 : 16000
            const samples = []
            for (let round = 0; round < 2; round++) {
              const start = performance.now()
              await run(count)
              samples.push((performance.now() - start) * 1000 / count)
            }
            hub.destroy(); peer.terminate(); URL.revokeObjectURL(url)
            return samples
          }, { origin, version, concurrency })
          aggregate[version].push(...samples)
        } finally { await context.close() }
        console.error(`worker-steady-${concurrency} ${version} cycle ${cycle + 1}: complete`)
      }
    }
    for (const version of versions) {
      const samples = aggregate[version]
      const sorted = [...samples].sort((a, b) => a - b)
      results.push({ scenario: `worker-steady-${concurrency}`, version, medianUsPerCall: (sorted[2] + sorted[3]) / 2, samplesUsPerCall: samples })
    }
  }
  console.log(JSON.stringify({
    browser: browser.version(),
    methodology: 'Numeric echo; microtask clone transport and native Workers; 8 rotating paused rounds and 3 rotated isolated continuous cycles (2 rounds/cycle) with 1s warmup; concurrency 1 or 32. Concurrent figures are amortized time per call, not individual latency.',
    results,
  }, null, 2))
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
