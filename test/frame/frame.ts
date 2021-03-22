import { PostMessageHub } from 'duplex-message'
const postMessageHub = new PostMessageHub

const peer = new Worker('./worker.ts')

const messageHub = postMessageHub.createDedicatedMessageHub(parent)
const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, ''))
}

const subFrameWin = (document.getElementById('sub-iframe') as HTMLFrameElement).contentWindow
postMessageHub.createProxy(subFrameWin, parent)
postMessageHub.createProxy(peer, parent)

$('#test-1').addEventListener('click', () => {
  messageHub.emit('page-title', ($('input-1') as HTMLInputElement).value).then((res) => {
    $('#result-1').innerText = res
  })
})

$('#test-2').addEventListener('click', () => {
  messageHub.emit('testError', {xxx: Date.now()}).then((res) => {
    $('#result-2').innerText = 'success: ' + res
  })
  .catch((err) => {
    $('#result-2').innerText = 'failed: ' + String(err)
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