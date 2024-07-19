import { PostMessageHub, setConfig } from '../../src'
const postMessageHub = new PostMessageHub
import PeerWorker from './worker?worker'

setConfig({debug: true})

const peer = new PeerWorker

const messageHub = postMessageHub.createDedicatedMessageHub(parent)
const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, '')) as HTMLElement
}

const subFrameWin = (document.getElementById('sub-iframe') as HTMLFrameElement).contentWindow
postMessageHub.createProxy(subFrameWin!, parent)
postMessageHub.createProxy(peer, parent)

$('#test-1').addEventListener('click', () => {
  messageHub.emit<string>('page-title', {
    onprogress(e: any) { 
      $('#result-1').innerText = 'progress ' + e
    },
    echo: ($('input-1') as HTMLInputElement).value
  }).then((res) => {
    $('#result-1').innerText = res
  })
})

$('#test-2').addEventListener('click', () => {
  messageHub.emit('testError', {xxx: Date.now()}).then((res) => {
    $('#result-2').innerText = 'success: ' + res
  })
  .catch((err) => {
    console.log('err', err)
    $('#result-2').innerText = 'failed: ' + JSON.stringify(err)
  })
})


messageHub.on({
  getHead () {
    return document.head.outerHTML
  },
  hi (msg: string) {
    $('#result-3').innerText = 'message from parent: ' + msg
  }
})