import { PostMessageHub } from 'src/post-message';

const hub = new PostMessageHub();
console.log('hooo worker')
hub.on(self, 'greet', async (msg: string) => {
  return msg
})


hub.on(self, 'download', async (params: {url: string, onprogress: (n: number) => void}) => {
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

try {
  hub.createProxy(self, self)
} catch (error) {
  console.log('createProxy not supported', error)
}

hub.on(self, 'test-for-inter-call', async () => {
  try {
    await hub.emit(self, 'getName')
    return 'found'
  } catch (error) {
    return 'not found'
  }
})

hub.on(self, 'inter-download', async (req) => {
  const msg = await hub.emit(self, 'download', {
    onprogress: console.log,
  })
  return msg === 'done with progress'
})
hub.on(self, 'inter-greet', async (req) => {
  try {
    const msg = await hub.emit(self, 'greet', {
      onprogress: console.log,
    })
    return msg
  } catch (error) {
    return 'error-catching'
  }
})