import { track } from '../resources'
import { expect, describe, it, vi } from 'vitest';

import { setConfig } from 'src/abstract';
import { StorageMessageHub } from 'src/storage-message';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const frames: HTMLIFrameElement[] = [];

const createFrame = (keepWin?: boolean) => {
  if (!keepWin) frames.forEach((frame) => frame.remove());
  frames.length = 0;
  const frame = track(document.createElement('iframe'));
  frame.srcdoc = `
    <script type="module" src="/test/storage/frame-source.ts"></script>
  `;
  document.body.appendChild(frame);
  frames.push(frame);
  return frame;
}


describe('Storage', () => {
  it('delivers identical consecutive progress updates and immediately removes message keys', async () => {
    const prefix = `storage-regression-${Date.now()}`
    // The fixture uses the default prefix; the isolated sender check exercises cleanup separately.
    const hub = track(new StorageMessageHub())
    createFrame()
    await wait(1000)
    const onprogress = vi.fn()
    await expect(hub.emit('repeat-progress', { onprogress })).resolves.toBe('done')
    expect(onprogress.mock.calls).toEqual([[7], [7], [7]])
    const isolated = track(new StorageMessageHub({ keyPrefix: prefix, heartbeatTimeout: 10 }))
    const missing = expect(isolated.emit('missing')).rejects.toMatchObject({ code: 3 })
    expect(Object.keys(localStorage).some((key) => key.startsWith(prefix))).toBe(false)
    await missing
  })

  it('normal usage', async (ctx) => {
    const hub = track(new StorageMessageHub());
    const frame = createFrame();
    await wait(1000);
    const res = await hub.emit('greet', 'Saiya');
    expect(res).toBe('Saiya');
    // @ts-expect-error for test
    expect(hub.isDestroyed).toBe(false);
    setConfig()
    hub.on('greet', async (msg: string) => {
      return msg
    })
    hub.off('greet')
    hub.destroy()
    hub.destroy()
    // @ts-expect-error for test
    expect(hub.isDestroyed).toBe(true);

    const shared = track(StorageMessageHub.shared);
    const shared2 = track(StorageMessageHub.shared);
    expect(shared).toBe(shared2);
  });

  it('exception', async (ctx) => {
    const hub = track(new StorageMessageHub());
    const frame = createFrame();
    await wait(1000);

    await expect(() => hub.emit('hello', window)).rejects.toThrowError();

    await hub.emit('test-for-exception');
    await wait(1000);

    localStorage.setItem(``, 'test 2323');
    localStorage.setItem(`abc`, '');
    sessionStorage.setItem(`abc`, '');
    localStorage.setItem(`demo-sss`, 'test 2323');
    localStorage.removeItem(`demo-sss`);
    // @ts-expect-error for test
    localStorage.setItem(`${hub._keyPrefix}-sss`, 'test 2323');

    // @ts-expect-error for test
    expect(() => hub.sendMessage('peer', window)).toThrowError();
  })

  it('multi frame', async (ctx) => {
    const hub = track(new StorageMessageHub());
    const frame = createFrame();
    const frame2 = createFrame(true);
    await wait(2000);
    const res = await hub.emit('greet', 'Saiya');
    expect(res).toBe('Saiya');
    // @ts-expect-error for test
    expect(hub.isDestroyed).toBe(false);
    setConfig()
    hub.on('greet', async (msg: string) => {
      return msg
    })
    hub.off('greet')
    hub.destroy()
    hub.destroy()
    // @ts-expect-error for test
    expect(hub.isDestroyed).toBe(true);

    const shared = track(StorageMessageHub.shared);
    const shared2 = track(StorageMessageHub.shared);
    expect(shared).toBe(shared2);
  })
});
