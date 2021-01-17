import MessageHub from '../../src'
const peer = self

// tik count
let tikCount = 0

setInterval(() => {
  // console.log('tick tok')
  MessageHub.emit(peer, 'tik-tok', `<i>I'm alive: ${tikCount++}</i>`)
}, 1000)


MessageHub.on(peer, {
  'convert2mdH1': async (param) => {
    console.log('mes from h', param)
    // get data from main thread
    const title = await MessageHub.emit(peer, 'pageTitle')
    console.log('page title', title)
    return `# ${param} (${title})`
  }
})

let hiCount = 0
MessageHub.on(peer, {
  'hi': () => {
    console.log(`main thread say hi ${++hiCount} time(s)`)
  }
})
// calc fibonacci, read request data from ctx.request, response it by setting result to ctx.request
MessageHub.on(peer, {
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