import { StorageMessageHub } from 'src/storage-message';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

console.log('frame aaa storage', location.href)

const keyPrefix = new URL(import.meta.url).searchParams.get('keyPrefix')
const hub = new StorageMessageHub(keyPrefix === null ? undefined : { keyPrefix });

hub.on('controls-progress', (options: { onprogress: (value: string) => void }) => {
  options.onprogress('--message-hub-to-be-continued--')
  return 'done'
})
hub.on('controls-slow', (options: { onprogress: (value: string) => void }) => {
  options.onprogress('started')
  return new Promise(() => {})
})

hub.on('greet', async (msg: string) => {
  await wait(200)
  return msg
})

hub.on('repeat-progress', (options: { onprogress: (value: number) => void }) => {
  options.onprogress(7)
  options.onprogress(7)
  options.onprogress(7)
  return 'done'
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

hub.on('test-for-exception', async () => {
  localStorage.setItem(``, 'test 2323');
  localStorage.setItem(`abc`, '');
  sessionStorage.setItem(`abc`, '');
  localStorage.setItem(`demo-sss`, 'test 2323');
  localStorage.removeItem(`demo-sss`);
  // @ts-expect-error for test
  localStorage.setItem(`${hub._keyPrefix}-sss`, 'test 2323');
})
