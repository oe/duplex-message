import { BroadcastMessageHub } from '../../src'
import PeerWorker from './worker?worker'
const postMessageHub = new BroadcastMessageHub

const peer = new PeerWorker


// use route to handle other side's request, and set ctx.response to reply the request
postMessageHub.on({
  'pageTitle': () => {
    return document.title
  }
})

// recive one way message, no need to reply it
postMessageHub.on({
  'tik-tok': msg => {
    document.getElementById('tik-tok')!.innerHTML = msg
  }
})

function getShowDom (id: string) {
  const input = document.getElementById(id) as HTMLInputElement
  const result = input.parentElement!.nextElementSibling as HTMLParagraphElement
  return { input, result }
}

const testCase1 = getShowDom('input1')
testCase1.input.addEventListener('keyup', (e) => {
  if (e.keyCode !== 13) return
  postMessageHub.emit('convert2mdH1', testCase1.input.value).then((resp) => {
    // @ts-ignore
    testCase1.result.innerText = resp
  }, (err) => {
    testCase1.result.innerHTML = `<span style="color:red;">${err}</span>`
  })
})

const testCase2 = getShowDom('input2')
testCase2.input.addEventListener('keyup', (e) => {
  if (e.keyCode !== 13) return
  testCase2.result.innerText = 'calculating...'
  const startTime = Date.now()
  postMessageHub.emit('fib', +testCase2.input.value).then((resp) => {
    console.warn('fib response', resp)
    const period = Date.now() - startTime
    testCase2.result.innerHTML = resp + `<br> It takes ${period}ms to figure out`
  }, (err) => {
    console.warn('fib error response', err)
    testCase2.result.innerHTML = `<span style="color:red;">${err && err.message || err}</span>`
  })
})

document.getElementById('hi-btn')!.addEventListener('click', (e) => {
  // send worker a message without message data, no care about the response
  postMessageHub.emit('hi', {
    onprogress(e: any) { console.log('progress', e) }
  }).then(res => console.log('`hi` response', res))
  .catch(err => console.warn('hi error', err))
})

