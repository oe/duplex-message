import { StorageMessageHub, IPeerIdentity } from 'duplex-message'
const query = new URLSearchParams(location.search)
const storageMessageHub = new StorageMessageHub({identity: query.get('name') })
// @ts-ignore
window.sm = storageMessageHub

const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, ''))
}

let peers: IPeerIdentity[] = []
storageMessageHub.getPeerIdentifies().then(res => peers = Object.values(res))
// @ts-ignore
window.getPeerByName = (name: string) => peers.find(p => p.identity === name)?.instanceID

storageMessageHub.on({
  testError (...args: any[]) {
    console.log('arguments from testError', args)
    throw new TypeError('testError not implemented')
  },
  'tik-tok': msg => {
    $('tik-tok').innerHTML = JSON.stringify(msg)
    return 'nothing to return <h1>' + Math.random() + '</h1>'
  },
  mockDownload (msg: any) {
    return new Promise((resolve, reject) => {
      let count = 0
      let tid = setInterval(() => {
        msg.onprogress(++count)
        if (count === 10) {
          clearInterval(tid)
          resolve('done')
        }
      }, 180)
    })
  }
})

let count = 0

$('btn').addEventListener('click', () => {
  storageMessageHub.emit('tik-tok', { what: 'xxx', count: ++count, time: Date.now() }).then(result => {
    $('tik-tok-resp').innerHTML = result.join('<br>')
  }).catch(err => console.warn('error', err))
})

// test progress
// sm.emit({methodName: 'mockDownload', toInstance: getPeerByName('xiu')}, {onprogress: (p) => console.log('progress', p)}).then(res => console.log('ss', res)).catch(res => console.log('ee', res))