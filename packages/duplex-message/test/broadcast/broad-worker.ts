import { BroadcastMessageHub } from 'src/broadcast-message';

const hub = new BroadcastMessageHub;

console.log('wwhooo worker', location.href)

hub.on('greet', async (msg: string) => {
  return msg
})




hub.on('download', async (params: {url: string, onprogress: (n: number) => void}) => {
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

