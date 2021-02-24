import MessageHub from '@evecalm/message-hub'

const messageHub = MessageHub.createDedicatedMessageHub(parent)
const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, ''))
}

$('#test-1').addEventListener('click', () => {
  messageHub.emit('page-title', $('input-1').value).then((res) => {
    $('#result-1').innerText = res
  })
})
