import { expect, describe, it, vi } from 'vitest';

import { setConfig } from 'src/abstract';
import { BroadcastMessageHub } from 'src/broadcast-message';
import BroadWorker from './broad-worker?worker';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


describe('broadcast', () => {
  it('normal usage', async (ctx) => {
    const hub2 = new BroadWorker()
    const hub = new BroadcastMessageHub();
    await wait(500);
    const res = await hub.emit('greet', 'Saiya');
    expect(res).toBe('Saiya');
    // @ts-expect-error for test
    expect(hub.isDestroyed).toBe(false);
    setConfig({ debug: true })
    hub.on('greet', async (msg: string) => {
      return msg
    })
    hub.off('greet')
    hub.destroy()
    hub.destroy()
    // @ts-expect-error for test
    expect(hub.isDestroyed).toBe(true);

    const shared = BroadcastMessageHub.shared;
    const shared2 = BroadcastMessageHub.shared;
    expect(shared).toBe(shared2);
  });

  it('edge case 1', async () => {
    const hub = new BroadcastMessageHub()
    hub.on(function (mth, data) {
      return mth === 'greet' ? data : 'error'
    })

    hub.off('greet')
    // @ts-expect-error for test
    expect(hub._eventHandlerMap.length).toBe(1)
    hub.on('greet', async (msg: string) => {
      return msg
    })
    hub.on(console.log)
    // @ts-expect-error for test
    hub._eventHandlerMap = [[hub.instanceID]]
    hub.off('greet')
    // @ts-expect-error for test
    expect(hub._eventHandlerMap.length).toBe(1)
    hub.on('greet', async (msg: string) => {
      return msg
    })
  })
  it('edge case 2', async () => {
    const hub = new BroadcastMessageHub()
    // @ts-expect-error for test
    hub._eventHandlerMap = [[hub.instanceID, { greet: null }]]
    hub.off('greet')
    // @ts-expect-error for test
    expect(hub._eventHandlerMap.length).toBe(1)
    hub.on('greet', console.log)
    hub.on('greet', console.warn)
    hub.off('greet', console.log)
  })
});