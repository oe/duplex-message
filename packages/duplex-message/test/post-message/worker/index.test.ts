import { PostMessageHub } from 'src/post-message';
import { describe, it, expect } from 'vitest';
import DemoWorker from './worker?worker'

window.addEventListener('message', (e) => {
  console.log('message from inner worker', e.data)
})
describe('PostMessage in worker',  () => {
  it('normal usage', async () => {
    console.log('location.href', location.href, window.parent === window)
    window.addEventListener('message', (e) => {
      console.log('message from others', e.data)
    })
    const worker = new DemoWorker
    const iframe = document.createElement('iframe')
    iframe.src = 'https://forth.ink/'
    document.body.appendChild(iframe)
    console.log('worker xxxx', worker)
    const hub = new PostMessageHub()
    const msg = await hub.emit(worker, 'greet', 'hello')
    expect(msg).toBe('hello')
  })
})