import { BroadcastMessageHub } from '../../src'
const postMessageHub = new BroadcastMessageHub

// tik count
let tikCount = 0

setInterval(() => {
  // console.log('tick tok')
  postMessageHub.emit('tik-tok', `<i>I'm alive: ${tikCount++}</i>`)
}, 1000)

postMessageHub.on({
  'convert2mdH1': async (param) => {
    console.log('mes from h', param)
    // get data from main thread
    const title = await postMessageHub.emit('pageTitle')
    console.log('page title', title)
    return `# ${param} (${title})`
  }
})

postMessageHub.on({
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
postMessageHub.on({
  'fib': (param) => {
    const result = fib(param)
    console.log('fib', param, result)
    return result
  }
})

// use a recursion algorithm which will take more than half a minute when n big than 50
function fib (n: number): number {
  if (n < 2) return n
  return fib(n - 1) + fib(n - 2)
}