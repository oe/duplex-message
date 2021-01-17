import MessageHub from '../../src'

const messageHub = MessageHub.createDedicatedMessageHub(parent)
const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, ''))
}

$('#test-1').addEventListener('click', () => {
  messageHub.emit('page-title', $('input-1').value).then((res) => {
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