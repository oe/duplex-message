import { expect, it, describe } from 'vitest';
import { BroadcastMessageHub } from 'src/broadcast-message';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


describe('broadcast in node', () => {

  it('should throw when broadcast not supported', async () => {
    const OldBroadcastChannel = globalThis.BroadcastChannel;
    // @ts-expect-error fix type error
    globalThis.BroadcastChannel = undefined;
    expect(() => new BroadcastMessageHub()).toThrowError();
    expect(() => BroadcastMessageHub.shared).toThrowError();
    globalThis.BroadcastChannel = OldBroadcastChannel;
  });

  it('normal usage', async (ctx) => {
    const hub2 = new BroadcastMessageHub
    hub2.on('greet', async (msg: string) => {
      return msg
    })
    const hub = new BroadcastMessageHub();
    await wait(500);
    const res = await hub.emit('greet', 'Saiya');
    expect(res).toBe('Saiya');
    // @ts-expect-error for test
    expect(hub.isDestroyed).toBe(false);
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

  it('multi args', async (ctx) => {
    const hub2 = new BroadcastMessageHub
    hub2.on('greet33', async (a1: number, a2: number) => {
      return a1 + a2
    })
    const hub = new BroadcastMessageHub();
    await wait(500);
    const res = await hub.emit('greet33', 1, 23);
    expect(res).toBe(24);
  });

  it('test for edge case 1', async () => {
    const hub = new BroadcastMessageHub()
    expect(() => hub.emit('hello', globalThis)).rejects.toThrowError()

    const hub2 = new BroadcastMessageHub()
    hub2.on(console.log)
    hub2.on('greet2', async (msg: string) => {
      throw new Error("greet error in hub2");
    })

    expect(hub.emit('greet2', 'Saiya')).rejects.toThrowError();
  })

})
