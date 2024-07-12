import { StorageMessageHub, setConfig } from '../../src'
setConfig({ debug: true })
const query = new URLSearchParams(location.search)
const storageMessageHub = new StorageMessageHub({identity: query.get('name') })
// @ts-ignore
window.sm = storageMessageHub

const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, '')) as HTMLElement
}



storageMessageHub.on({
  testError (...args: any[]) {
    console.log('arguments from testError', args)
    throw new TypeError('testError not implemented')
  },
  'tik-tok': msg => {
    $('tik-tok').innerHTML = JSON.stringify(msg)
    console.log('tik-tok on message', msg)
    if (query.get('name') === 'xiu') throw new Error('xiu stop working')
    return 'nothing to return <h1>' + Math.random() + '</h1>'
  },
  mockDownload (msg: any) {
    return new Promise((resolve, reject) => {
      let count = 0
      let tid = setInterval(() => {
        msg.onprogress(++count)
        console.log('progress', storageMessageHub.instanceID, count)
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
    $('tik-tok-resp').innerHTML = (Array.isArray(result) ? result.join('<br>') : result) as string
  }).catch(err => {
    $('tik-tok-resp').innerHTML = 'error: ' + JSON.stringify(err)
  })
})

$('get-all-response').addEventListener('click', () => {
  storageMessageHub.emit('tik-tok', { what: 'xxx', count: ++count, time: Date.now() }).then(result => {
    $('get-all-response-content').innerHTML = (typeof result === 'object' ? '<pre>' + JSON.stringify(result, null, 2) + '</pre>' : result) as string
  }).catch(err => {
    $('get-all-response-content').innerHTML = 'error: ' + JSON.stringify(err)
  })
})

$('test-progress').addEventListener('click', async () => {
  try {
    const response = await storageMessageHub.emit('mockDownload',
    {
      onprogress: (p) => $('progress-response').innerHTML = `progress ${p}`
    })
  
    $('progress-response').innerHTML = `progress ${response}`
  } catch (error) {
    console.error(error)
    $('progress-response').innerHTML = `error ${error.message}`
  }
})
