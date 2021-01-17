import MessageHub from '../../src'

const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, ''))
}

$('#test-1').addEventListener('click', () => {
  MessageHub.emit(parent, 'page-title', $('input-1').value).then((res) => {
    $('#result-1').innerText = res
  })
})

$('#test-2').addEventListener('click', () => {
  MessageHub.emit(parent, 'testError', {xxx: Date.now()}).then((res) => {
    $('#result-2').innerText = 'success: ' + res
  })
  .catch((err) => {
    $('#result-2').innerText = 'failed: ' + String(err)
  })
})


MessageHub.on(parent, {
  getHead () {
    return document.head.outerHTML
  },
  hi (msg: string) {
    $('#result-3').innerText = 'message from parent: ' + msg
  }
})