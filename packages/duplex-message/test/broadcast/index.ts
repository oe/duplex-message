import { BroadcastMessageHub, setConfig } from 'duplex-message'
setConfig({ debug: true })
const query = new URLSearchParams(location.search)
const pageName = query.get('name') || 'default-page'

const broadcastMessageHub = new BroadcastMessageHub()
// @ts-ignore
window.bm = broadcastMessageHub

const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, ''))!
}

broadcastMessageHub.on({
  testError (...args: any[]) {
    console.log('arguments from testError', args)
    throw new TypeError(`${pageName} - testError not implemented`)
  },
  'tik-tok': msg => {
    $('tik-tok-req').innerHTML = JSON.stringify(msg)
    console.log('tik-tok on message', msg)
    if (pageName === 'xiu') throw new Error('xiu stop working')
    return `${pageName} - nothing to return <h1> ${Math.random()}</h1>`
  },
  mockDownload (msg: any) {
    return new Promise((resolve, reject) => {
      let count = 0
      let tid = setInterval(() => {
        msg.onprogress(++count)
        console.log(`<${pageName}>progress`, broadcastMessageHub.instanceID, count)
        if (count === 10) {
          clearInterval(tid)
          resolve(`${pageName}-done`)
        }
      }, 180)
    })
  }
})

let count = 0

$('tik-tok').addEventListener('click', () => {
  broadcastMessageHub.emit('tik-tok', { what: 'xxx', count: ++count, time: Date.now() }).then(result => {
    $('tik-tok-resp').innerHTML = (Array.isArray(result) ? result.join('<br>') : result) as string
  }).catch(err => {
    $('tik-tok-resp').innerHTML = 'error: ' + JSON.stringify(err)
  })
})

$('test-error').addEventListener('click', () => {
  broadcastMessageHub.emit('testError', { what: 'xxx', count: ++count, time: Date.now() }).then(result => {
    $('error-response').innerHTML = (Array.isArray(result) ? result.join('<br>') : result) as string
  }).catch(err => {
    $('error-response').innerHTML = 'error: ' + JSON.stringify(err)
  })
})

$('test-progress').addEventListener('click', async () => {
  try {
    const response = await broadcastMessageHub.emit('mockDownload',
    {
      onprogress: (p) => $('progress-response').innerHTML = `progress ${p}`
    })
  
    $('progress-response').innerHTML = `progress ${response}`
  } catch (error) {
    console.error(error)
    $('progress-response').innerHTML = `error ${error.message}`
  }
})
