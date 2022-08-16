import { PageScriptMessageHub, setConfig } from "duplex-message";
setConfig({ debug: true })

const port2 = new PageScriptMessageHub({ instanceID: 'port2' })
const port3 = new PageScriptMessageHub({ instanceID: 'port3' })
const port1 = new PageScriptMessageHub({ instanceID: 'port1' })
// @ts-ignore
window.port1 = port1
// @ts-ignore
window.port2 = port2
// @ts-ignore
window.port3 = port3

console.warn('port1', port1.instanceID)
console.warn('port3', port3.instanceID)

const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, '')) as HTMLElement;
}

port1.on({
  download(msg: any) {
    return new Promise((resolve, reject) => {
      let count = 0
      let tid = setInterval(() => {
        msg.onprogress((++count) + ' - port1')
        if (count === 10) {
          clearInterval(tid)
          resolve('done - port1')
        }
      }, 50)
    })
  },
  getTitle(a: string, b: string) {
    return document.title + ' ' + a + ' ' + b + ' from port 1'
  }
})

port1.on({
  getTitle(a: string, b: string) {
    console.log('port1.getTitle() called')
    return document.title + ' ' + a + ' ' + b + ' from port 1 xxxxx'
  }
})

port3.on({
  getTitle: () => {
    console.log('port3.getTitle() called')
    return document.title + "  from port3";
  },
});

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
