import { StorageMessageHub } from '@evecalm/message-hub'

const storageMessageHub = new StorageMessageHub
// @ts-ignore
window.sm = storageMessageHub

const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, ''))
}

storageMessageHub.on({
  testError (...args) {
    console.log('arguments from testError', args)
    throw new TypeError('testError not implemented')
  },
  'tik-tok': msg => {
    $('tik-tok').innerHTML = JSON.stringify(msg)
    return 'nothing to return <h1>' + Math.random() + '</h1>'
  }
})

let count = 0

$('btn').addEventListener('click', () => {
  storageMessageHub.emit('tik-tok', { what: 'xxx', count: ++count, time: Date.now() }).then(result => {
    $('tik-tok-resp').innerHTML = result as string
  })
})