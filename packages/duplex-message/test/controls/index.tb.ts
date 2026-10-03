import { describe, expect, it, vi } from 'vitest'
import { EErrorCode } from '../../src/abstract'
import { BroadcastMessageHub } from '../../src/broadcast-message'
import { PageScriptMessageHub } from '../../src/page-script-message'
import { StorageMessageHub } from '../../src/storage-message'
import { track } from '../resources'

type Transport = 'page-script' | 'broadcast' | 'storage'

async function createClient(transport: Transport) {
  const channel = `controls-${crypto.randomUUID()}`
  if (transport === 'storage') {
    const frame = track(document.createElement('iframe'))
    frame.srcdoc = `<script type="module" src="/test/storage/frame-source.ts?keyPrefix=${channel}"></script>`
    const loaded = new Promise<void>((resolve) => { frame.onload = () => resolve() })
    document.body.appendChild(frame)
    await loaded
    return track(new StorageMessageHub({ keyPrefix: channel }))
  }
  const options = { channelName: channel, customEventName: channel }
  const Hub = transport === 'broadcast' ? BroadcastMessageHub : PageScriptMessageHub
  const client = track(new Hub(options))
  const server = track(new Hub(options))
  server.on('controls-progress', (options: { onprogress: (value: string) => void }) => {
    options.onprogress('--message-hub-to-be-continued--')
    return 'done'
  })
  server.on('controls-slow', (options: { onprogress: (value: string) => void }) => {
    options.onprogress('started')
    return new Promise(() => {})
  })
  return client
}

describe.each<Transport>(['page-script', 'broadcast', 'storage'])('%s request controls', (transport) => {
  it('delivers reserved-string progress with local controls and preserves success after abort', async () => {
    const client = await createClient(transport)
    const controller = new AbortController()
    const onprogress = vi.fn()
    await expect(client.emit({
      methodName: 'controls-progress', signal: controller.signal, requestTimeout: 1000,
    }, { onprogress })).resolves.toBe('done')
    controller.abort()
    expect(onprogress.mock.calls).toEqual([['--message-hub-to-be-continued--']])
    await expect(client.emit('controls-progress', { onprogress })).resolves.toBe('done')
  })

  it('cancels a request after receiving progress without serializing its AbortSignal', async () => {
    const client = await createClient(transport)
    const controller = new AbortController()
    const onprogress = vi.fn()
    const response = expect(client.emit({
      methodName: 'controls-slow', signal: controller.signal, requestTimeout: 2000,
    }, { onprogress })).rejects.toMatchObject({ code: EErrorCode.REQUEST_ABORTED })
    await vi.waitFor(() => expect(onprogress).toHaveBeenCalledWith('started'))
    controller.abort()
    await response
  })

  it('enforces a request deadline even after the heartbeat', async () => {
    const client = await createClient(transport)
    const onprogress = vi.fn()
    await expect(client.emit({
      methodName: 'controls-slow', requestTimeout: 500,
    }, { onprogress })).rejects.toMatchObject({ code: EErrorCode.REQUEST_TIMEOUT })
    expect(onprogress).toHaveBeenCalledWith('started')
  })
})
