import { PostMessageHub } from '@evecalm/message-hub'
const postMessageHub = new PostMessageHub

// @ts-ignore
window.pm = postMessageHub

const frameWin = (document.getElementById('frame') as HTMLFrameElement).contentWindow

const messageHub = postMessageHub.createDedicatedMessageHub(frameWin)
// @ts-ignore
window.mh = messageHub
const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, ''))
}

postMessageHub.on(frameWin, 'page-title', (arg) => {
  return document.title + ( arg ? ', echo  --- ' + arg : '')
})
// listen message from frameWin
messageHub.on({
  testError (...args) {
    console.log('arguments from testError', args)
    throw new TypeError('testError not implemented')
  },
  'tik-tok': msg => {
    $('tik-tok').innerHTML = msg
  }
})


$('#button-1').addEventListener('click', () => {
  messageHub.emit('hi', ($('input-1') as HTMLInputElement).value).then((res) => {
    console.log('response from hi', res)
  })
})

$('#button-2').addEventListener('click', () => {
  messageHub.emit('getHead',).then((res) => {
    $('#result-2').innerText = res as string
  })
})

$('#button-3').addEventListener('click', () => {
  messageHub.emit('not-existing-method',).then((res) => {
    $('#result-3').innerHTML = 'success: ' + res
  }).catch(err => {
    $('#result-3').innerHTML = 'failed: ' + String(err)
  })
})

