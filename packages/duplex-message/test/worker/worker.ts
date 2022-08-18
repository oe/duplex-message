import { PostMessageHub } from '../../src'
const postMessageHub = new PostMessageHub
const peer = self

// tik count
let tikCount = 0

setInterval(() => {
  // console.log('tick tok')
  postMessageHub.emit(peer, 'tik-tok', `<i>I'm alive: ${tikCount++}</i>`)
}, 1000)

postMessageHub.on(peer, {
  'convert2mdH1': async (param) => {
    console.log('mes from h', param)
    // get data from main thread
    const title = await postMessageHub.emit(peer, 'pageTitle')
    console.log('page title', title)
    return `# ${param} (${title})`
  }
})

postMessageHub.on(peer, {
  'hi': (msg) => {
    return new Promise((resolve, reject) => {
      let hiCount = 0
      const tid = setInterval(() => {
        if (hiCount >= 100) {
          clearInterval(tid)
          return resolve('done')
        }
        msg.onprogress({count: hiCount += 10})
      }, 200)
    })
  }
})
// calc fibonacci, read request data from ctx.request, response it by setting result to ctx.request
postMessageHub.on(peer, {
  'fib': (param) => {
    const result = fib(param)
    console.log('fib', param, result)
    return result
  }
})

// use a recursion algorithm which will take more than half a minute when n big than 50
function fib (n) {
  if (n < 2) return n
  return fib(n - 1) + fib(n - 2)
}