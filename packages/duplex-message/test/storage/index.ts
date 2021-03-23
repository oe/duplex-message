import { StorageMessageHub, IPeerIdentity } from 'duplex-message'
const query = new URLSearchParams(location.search)
const storageMessageHub = new StorageMessageHub({identity: query.get('name') })
// @ts-ignore
window.sm = storageMessageHub

const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, ''))
}



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
    $('tik-tok-resp').innerHTML = Array.isArray(result) ? result.join('<br>') : result
  }).catch(err => console.warn('error', err))
})

$('test-progress').addEventListener('click', async () => {
  try {
    let peers: any = await storageMessageHub.getPeerIdentifies()
    peers = Object.values(peers)
    $('peers').innerHTML = `success: <pre>${JSON.stringify(peers)}</pre>`
    const getPeerByName = (name: string) => peers.find(p => p.identity === name)?.instanceID
    const response = await storageMessageHub.emit({
      methodName: 'mockDownload',
      toInstance: getPeerByName('xiu')
    }, {
      onprogress: (p) => $('progress-response').innerHTML = `progress ${p}`
    })
  
    $('progress-response').innerHTML = `progress ${response}`
  } catch (error) {
    console.error(error)
    $('progress-response').innerHTML = `error ${error.message}`
  }
})
