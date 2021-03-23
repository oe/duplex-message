import { PageScriptMessageHub } from 'duplex-message'

const port1 = new PageScriptMessageHub()
const port2 = new PageScriptMessageHub()
// @ts-ignore
window.port1 = port1
// @ts-ignore
window.port2 = port2

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
      }, 180)
    })
  },
  getTitle(a: string, b: string) {
    return document.title + ' ' + a + ' ' + b
  }
})

// port2.on({})
