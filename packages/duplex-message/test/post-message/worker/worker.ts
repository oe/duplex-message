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