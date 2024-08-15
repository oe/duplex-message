import { PostMessageHub } from 'src/post-message';
import { describe, it, expect } from 'vitest';


const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const frames: HTMLIFrameElement[] = [];

const createFrame = (keepWin?: boolean) => {
  keepWin || frames.forEach((frame) => frame.remove());
  frames.length = 0;
  const frame = document.createElement('iframe');
  frame.srcdoc = `
    <script type="module" src="/test/post-message/frame/frame-source.ts"></script>
  `;
  document.body.appendChild(frame);
  frames.push(frame);
  return frame;
}

describe('PostMessage for iframe',  () => {
  it('normal usage', async () => {
    const frame = createFrame();
    await wait(1000);
    const frameWindow = frame.contentWindow as Window

    const hub = new PostMessageHub()

    const msg = await hub.emit(frameWindow, { methodName: 'greet', targetOrigin: '*' }, 'hello')
    expect(msg).toBe('hello')
    hub.off(frameWindow, 'greet')
    hub.on(frameWindow, 'getName', () => 'Saiya')
    const resp = await hub.emit(frameWindow, 'test-for-inter-call')

    expect(resp).toBe('Saiya')

    expect(() => hub.emit(frameWindow, { methodName: 'greet', targetOrigin: 'https://www.google.com/' }, 'hello')).rejects.toThrowError()
  })

})

