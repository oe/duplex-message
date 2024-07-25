import { PostMessageHub } from 'src/post-message';
import { describe, it, expect } from 'vitest';
import DemoWorker from './worker?worker'


describe('PostMessage in worker',  () => {
  it('normal usage', async () => {
    const worker = new DemoWorker

    const hub = new PostMessageHub()
    hub.on(worker, 'greet', async (msg: string) => {
      console.log('on message from worker', msg)
    })
    const msg = await hub.emit(worker, 'greet', 'hello')
    expect(msg).toBe('hello')
    hub.off(worker, 'greet')
    worker.terminate()
    hub.on(worker, 'greet', console.log)
    hub.destroy()
    // @ts-expect-error for test
    window.parent = null
    expect(hub.emit(window, 'greet', 'hello')).rejects.toThrowError()
    
  })

  it('use shared instance', async () => {
    const worker = new DemoWorker

    const hub = PostMessageHub.shared
    const hub2 = PostMessageHub.shared
    expect(hub).toBe(hub2)
    hub.on(worker, 'greet', async (msg: string) => {
      console.log('on message from worker', msg)
    })
    const msg = await hub.emit(worker, 'greet', 'hello')
    expect(msg).toBe('hello')
    hub.on(worker, {'greet2': console.log})
    hub.off(worker, 'greet')
    worker.terminate()
    hub.on(worker, 'greet', console.log)
    hub.destroy()
    hub.destroy()
  })
})


describe('Dedicated message hub', () => {
  it('normal usage', async () => {
    const worker = new DemoWorker
    const hub = new PostMessageHub()
    const workerMessage = hub.createDedicatedMessageHub(worker)

    const msg = await workerMessage.emit('greet', 'hello')
    workerMessage.on('greet', console.log)
    workerMessage.on({'greet2': console.log})
    workerMessage.off('greet')
    expect(msg).toBe('hello')

    worker.terminate()
    hub.on(worker, 'greet', console.log)
    worker.terminate()
    hub.destroy()
  })

  it('should throw when peer not set', async () => {
    const worker = new DemoWorker
    const hub = new PostMessageHub()
    const workerMessage = hub.createDedicatedMessageHub()
    expect(() => workerMessage.emit('greet', 'hello')).toThrowError()
    expect(() => workerMessage.on('greet', console.log)).toThrowError()
    expect(() => workerMessage.off('greet')).toThrowError()
    workerMessage.setPeer(worker)
    workerMessage.on('greet', console.log)
    worker.terminate()
    hub.destroy()
  })

  it('should be silent when peer not set', async () => {
    const worker = new DemoWorker
    const hub = new PostMessageHub()
    const workerMessage = hub.createDedicatedMessageHub(undefined, true)
    expect(() => workerMessage.emit('greet', 'hello')).rejects.toThrowError()
    workerMessage.on('greet', console.log)
    workerMessage.off('greet')

    worker.terminate()
    hub.destroy()
  })

  it('should off correctly', async () => {
    const worker = new DemoWorker
    const hub = new PostMessageHub()
    const workerMessage = hub.createDedicatedMessageHub(worker)
    workerMessage.on('greet', console.log)
    workerMessage.on('greets', console.log)
    workerMessage.off('greet')
    workerMessage.off()
    worker.terminate()
    hub.destroy()
  })
})

describe('check for progress', () => {
  it('download', async () => {
    const worker = new DemoWorker
    const hub = new PostMessageHub()
    const workerMessage = hub.createDedicatedMessageHub(worker)
    let progressCount = 0
    const msg = await workerMessage.emit('download', {
      url: 'https://example.com',
      onprogress: (n: string) => {
        progressCount++
      }
    })
    expect(progressCount).toBe(10)
    expect(msg).toBe('done with progress')
  })
 })