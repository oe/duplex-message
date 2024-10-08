import { PostMessageHub } from 'src/post-message';
import { describe, it, expect } from 'vitest';
import DemoWorker from './worker?worker'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('PostMessage in worker',  () => {
  it('normal usage', async () => {
    const worker = new DemoWorker

    const hub = new PostMessageHub()
    hub.on(worker, 'greet', async (msg: string) => {
      console.log('on message from worker', msg)
    })
    const msg = await hub.emit(worker, { methodName: 'greet' }, 'hello')
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
    hub.off(worker)
    worker.terminate()
    hub.on(worker, 'greet', console.log)
    hub.destroy()
    hub.destroy()
  })

  it('test for edge case 1', async () => {
    const worker = new DemoWorker

    const hub = new PostMessageHub()
    hub.on(worker, 'greet', async (msg: string) => {
      console.log('on message from worker', msg)
    })
    // @ts-ignore for test
    hub._hostedWorkers = hub._hostedWorkers.filter((w) => w !== worker)
    hub.off(worker, 'greet')
    // @ts-expect-error for test
    hub._onMessageReceived({data: {type: 'greet', data: 'hello', source: worker}})
    // @ts-expect-error for test
    hub._onMessageReceived({
      // @ts-ignore
      source: worker,
    })
    // @ts-expect-error for test
    hub._onMessageReceived({
      currentTarget: worker,
    })

    
    worker.terminate()
    hub.on(worker, 'greet', console.log)
    hub.destroy()

    expect(() => hub.on(worker, 'greet', async (msg: string) => {
      console.log(msg)
    })).toThrowError()
    expect(() => hub.emit(worker, { methodName: 'greet' }, 'hello')).toThrowError()
  })

  it('test for edge case 2', async () => {
    const worker = new DemoWorker
    const hub = new PostMessageHub()
    hub.stopProxy(worker)
    hub.on(worker, 'greet', async (msg: string) => {
      throw new Error("test error in request");
    })

    const msg = await hub.emit(worker, 'inter-greet', 'hello')
    expect(msg).toBe('error-catching')

    hub.stopProxy(worker)

    await hub.emit(worker, 'download', {
      onprogress: (n: number) => {
        throw new Error("test error in onprogress");
      }
    })
  })
  it('test for edge case 3', async () => {

    const worker = new DemoWorker
    const hub = new PostMessageHub()
    hub.on(worker, 'greet', async (msg: string) => {
      return 'hello'
    })
    hub.on(worker, 'greet', async (msg: string) => {
      throw new Error("test error in request");
    })

    const msg = await hub.emit(worker, 'inter-greet', 'hello')
    expect(msg).toBe('hello')
  })

  it('test for edge case 4', async () => {

    const worker = new DemoWorker
    const hub = new PostMessageHub()
    hub.on(worker, 'greet', async (msg: string) => {
      console.log('demo message', msg)
    })
    hub.on(worker, 'greet', async (msg: string) => {
      console.log('demo message2', msg)
    })

    const msg = await hub.emit(worker, 'inter-greet', 'hello')
    expect(msg).toBe(undefined)
  })

  it('test for edge case 5', async () => {
    const worker = new DemoWorker
    const hub = new PostMessageHub()
    hub.on(worker, 'some-method', console.log)
    expect(hub.emit(worker, 'inter-star', 'hello')).rejects.toThrowError()
  })
  it('test for edge case 6', async () => {
    const worker = new DemoWorker
    const hub = new PostMessageHub()
    hub.on(worker, 'greet', async (msg: string) => {
      throw {
        stack: 'custom error stack',
      }
    })

    const msg = await hub.emit(worker, 'inter-greet', 'hello')
    expect(msg).toBe('error-catching')
  })

  it('test when no callback', async () => {
    const worker = new DemoWorker
    const hub = new PostMessageHub()
    const msg = hub.emit(worker, 'greetxxxx', 'hello')
    expect(msg).rejects.toThrowError()
    const msg1 = await hub.emit(worker, 'test-for-inter-call', 'hello')
    expect(msg1).toBe('not found')
  })

  it('invalid callback', async () => {
    const worker = new DemoWorker
    const hub = new PostMessageHub()
    // @ts-expect-error for test
    hub.on(worker, 'greet', 'invalid')
    const msg = await hub.emit(worker, 'inter-greet', 'hello')
    expect(msg).toBe('error-catching')
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
    workerMessage.off('greet', console.log)
    workerMessage.off()
    worker.terminate()
    hub.destroy()
  })

  it('support for transfer params', async () => {
    const worker = new DemoWorker
    const hub = new PostMessageHub()
    const workerMessage = hub.createDedicatedMessageHub(worker)
    const data = new ArrayBuffer(16)
    const resp = await workerMessage.emit({ methodName: 'greet', transfer: [data] }, data)
    expect(resp).toStrictEqual(data)
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

  it('progress in parent', async () => {
    const worker = new DemoWorker
    const hub = new PostMessageHub()
    const workerMessage = hub.createDedicatedMessageHub(worker)
    let progressCount = 0
    workerMessage.on('download', async (params: {url: string, onprogress: (n: number) => void}) => {
      return new Promise((resolve, reject) => {
        let count = 0;
        if (!params || !params.onprogress) return resolve('done');
        const tid = setInterval(() => {
          params.onprogress((count += 10));
          if (count >= 100) {
            clearInterval(tid);
            resolve('done with progress');
          }
        }, 100);
      });
    })
    const resp = await workerMessage.emit('inter-download')
    expect(resp).toBe(true)
  })
 })


 describe('postMessage general function', () => {
  it('general message event', async () => {
    const worker = new DemoWorker
    const hub = new PostMessageHub()
    hub.on(worker, console.log)

    hub.on(worker, 'greet', async (msg: string) => {
      console.log('on message from worker', msg)
    })

    hub.on(worker, (methodName, data) => {
      return methodName
    })

    const msg = await hub.emit(worker, 'inter-greet', 'hello')
    expect(msg).toBe('greet')
  })
})

describe('postMessage * all message', () => {
  it('general message callback', async () => {
    const worker = new DemoWorker
    const hub = new PostMessageHub()
    hub.on('*', function (methodName, arg1) {
      return `${methodName}-${arg1}`
    })
    const msg = await hub.emit(worker, 'inter-star', 'hello')
    expect(msg).toBe('inter-hello')
  })
})
