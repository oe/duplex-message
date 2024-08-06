import { PostMessageHub } from 'src/post-message';

const hub = new PostMessageHub();
console.log('postMessage proxy worker')
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

hub.on(self, 'test-for-inter-call', async () => {
  const msg = await hub.emit(self, 'getName')
  return msg
})

try {
  hub.createProxy(self, self)
} catch (error) {
  console.log('createProxy not supported', error)
}

hub.on(self, 'start-proxy', () => {
  hub.emit(self, 'greet', 'hello')
})