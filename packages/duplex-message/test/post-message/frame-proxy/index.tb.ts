import { PostMessageHub } from 'src/post-message';
import { describe, it, expect } from 'vitest';


const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const frames: HTMLIFrameElement[] = [];

const createFrame = (keepWin?: boolean) => {
  keepWin || frames.forEach((frame) => frame.remove());
  frames.length = 0;
  const frame = document.createElement('iframe');
  frame.srcdoc = `
    <script type="module" src="/test/post-message/frame-proxy/frame-source.ts"></script>
  `;
  document.body.appendChild(frame);
  frames.push(frame);
  return frame;
}

describe('PostMessage for proxy',  () => {
  it('normal usage', async () => {
    const frame = createFrame();
    await wait(1000);
    const frameWindow = frame.contentWindow as Window

    const hub = new PostMessageHub()

    const msg = await hub.emit(frameWindow, 'greet', 'hello')
    expect(msg).toBe('hello')
    hub.off(frameWindow, 'greet')
    hub.on(frameWindow, 'getName', () => 'Saiya')
    const resp = await hub.emit(frameWindow, 'test-for-inter-call')

    expect(resp).toBe('Saiya')

    expect(() => hub.createProxy(frameWindow, frameWindow)).toThrowError()
    const frame2 = createFrame(true)
    await wait(1000);
    const frameWindow2 = frame2.contentWindow as Window
    hub.createProxy(frameWindow, frameWindow2)
    hub.stopProxy(frameWindow)
    // @ts-expect-error for test
    hub._isInWorker = true
    expect(() => hub.createProxy(frameWindow, frameWindow2)).toThrowError()

    hub.destroy()
    // @ts-expect-error for test
    window.parent = null
    expect(hub.emit(window, 'greet', 'hello')).rejects.toThrowError()
  })

})

