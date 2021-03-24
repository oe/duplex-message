import { PageScriptMessageHub } from 'duplex-message'

const port1 = new PageScriptMessageHub()
const port2 = new PageScriptMessageHub()
// @ts-ignore
window.port1 = port1
// @ts-ignore
window.port2 = port2

const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, ''))
}

port1.on({
  download(msg: any) {
    return new Promise((resolve, reject) => {
      let count = 0
      let tid = setInterval(() => {
        msg.onprogress(++count)
        if (count === 10) {
          clearInterval(tid)
          resolve('done')
        }
      }, 50)
    })
  },
  getTitle(a: string, b: string) {
    return document.title + ' ' + a + ' ' + b
  }
})

$('get-title').addEventListener('click', () => {
  port2.emit('getTitle', 'xiu', 'saiya').then((e) => {
    $('get-title-resp').innerHTML = String(e)
  })
})

$('download').addEventListener('click', () => {
  port2.emit('download', {
    onprogress(e) {
      $('download-resp').innerHTML = 'progress ' + e
    }
  }).then((e) => {
    $('download-resp').innerHTML = String(e)
  })
})

// port2.on({})
