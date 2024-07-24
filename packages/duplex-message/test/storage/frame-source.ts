import { StorageMessageHub } from 'src/storage-message';


console.log('frame storage', location.href)

const hub = new StorageMessageHub;

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

hub.on('test-for-exception', async () => {
  localStorage.setItem(``, 'test 2323');
  localStorage.setItem(`abc`, '');
  sessionStorage.setItem(`abc`, '');
  localStorage.setItem(`demo-sss`, 'test 2323');
  localStorage.removeItem(`demo-sss`);
  // @ts-expect-error for test
  localStorage.setItem(`${hub._keyPrefix}-sss`, 'test 2323');
})
