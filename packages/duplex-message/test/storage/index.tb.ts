import { expect, describe, it, vi } from 'vitest';

import { setConfig } from 'src/abstract';
import { StorageMessageHub } from 'src/storage-message';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const frames: HTMLIFrameElement[] = [];

const createFrame = () => {
  frames.forEach((frame) => frame.remove());
  frames.length = 0;
  const frame = document.createElement('iframe');
  frame.srcdoc = `
    <script type="module" src="/test/storage/frame-source.ts"></script>
  `;
  document.body.appendChild(frame);
  frames.push(frame);
  return frame;
}


describe('Storage', () => {
  it('normal usage', async (ctx) => {
    const hub = new StorageMessageHub();
    const frame = createFrame();
    await wait(1000);
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

    const shared = StorageMessageHub.shared;
    const shared2 = StorageMessageHub.shared;
    expect(shared).toBe(shared2);
  });

  it('exception', async (ctx) => {
    const hub = new StorageMessageHub();
    const frame = createFrame();
    await wait(1000);

    expect(() => hub.emit('hello', window)).rejects.toThrowError();

    hub.emit('test-for-exception');
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
});