import { postMessageHub } from '@evecalm/message-hub'
const peer = new Worker('./worker.ts')


// use route to handle other side's request, and set ctx.response to reply the request
postMessageHub.on(peer, {
  'pageTitle': () => {
    return document.title
  }
})

// recive one way message, no need to reply it
postMessageHub.on(peer, {
  'tik-tok': msg => {
    document.getElementById('tik-tok').innerHTML = msg
  }
})

function getShowDom (id: string) {
  const input = document.getElementById(id) as HTMLInputElement
  const result = input.parentElement.nextElementSibling as HTMLParagraphElement
  return { input, result }
}

const testCase1 = getShowDom('input1')
testCase1.input.addEventListener('keyup', (e) => {
  if (e.keyCode !== 13) return
  postMessageHub.emit(peer, 'convert2mdH1', testCase1.input.value).then((resp) => {
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
  postMessageHub.emit(peer, 'fib', +testCase2.input.value).then((resp) => {
    const period = Date.now() - startTime
    testCase2.result.innerHTML = resp + `<br> It takes ${period}ms to figure out`
  }, (err) => {
    testCase2.result.innerHTML = `<span style="color:red;">${err}</span>`
  })
})

document.getElementById('hi-btn').addEventListener('click', (e) => {
  // send worker a message without message data, no care about the response
  postMessageHub.emit(peer, 'hi').then(res => console.log('`hi` response', res))
})

