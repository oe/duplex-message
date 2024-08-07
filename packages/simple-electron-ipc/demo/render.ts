import { RendererMessageHub } from 'simple-electron-ipc'

const messageHub = new RendererMessageHub()
// @ts-ignore
window.messageHub = messageHub
messageHub.on({
  pageTitle () {
    return document.title
  },
  addNumber (msg: any) {
    return new Promise((resolve, reject) => {
      let hiCount = 0
      const tid = setInterval(() => {
        if (hiCount >= 100) {
          clearInterval(tid)
          return resolve(msg.a + msg.b)
        }
        msg.onprogress({count: hiCount += 10})
      }, 200)
    })
  },
})

const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, ''))
}


$('download').addEventListener('click', () => {
  messageHub.emit('download', {
    onprogress(e) {$('download-resp').innerHTML = 'progress: ' + JSON.stringify(e)}
  }).then(e => {
    $('download-resp').innerHTML = 'success: ' + JSON.stringify(e)
  })
})

$('get-token').addEventListener('click', () => {
  messageHub.emit('getUserToken', 'xiu', 'saiya').then((e) => {
    $('get-token-resp').innerHTML = 'success: ' + JSON.stringify(e)
  })
})

$('error').addEventListener('click', () => {
  messageHub.emit('aaa', 'xiu', 'saiya').then((e) => {
    $('error-resp').innerHTML = 'success: ' + JSON.stringify(e)
  })
  .catch((e) => {
    $('error-resp').innerHTML = 'error: ' + JSON.stringify(e)
  })
})


$('get-title').addEventListener('click', () => {
  messageHub.emit('getTitle', 'my-xiu').then((e) => {
    $('get-title-resp').innerHTML = 'success: ' + JSON.stringify(e)
  })
})

$('get-calc').addEventListener('click', () => {
  messageHub.emit('calc', 99, 2323).then((e) => {
    $('get-calc-resp').innerHTML = 'success: ' + JSON.stringify(e)
  })
})
