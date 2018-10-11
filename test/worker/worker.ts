import MessageHub from '../../src'

const messageHub = new MessageHub({
  type: 'worker'
})

messageHub.use((ctx, next) => {
  console.log('[worker log]recieved in global middle ware', ctx)
  return next()
})

// tik count
let tikCount = 0

setInterval(() => {
  messageHub.emit('tik-tok', `<i>I'm alive: ${tikCount++}</i>`)
}, 1500)


messageHub.route('convert2mdH1', async (ctx) => {
  console.log('mes from h', ctx)
  // get data from main thread
  const title = await messageHub.fetch('pageTitle')
  console.log('page title', title)
  ctx.response = `# ${ctx.request} (${title})`
})

let hiCount = 0
// recieve one way message, no need to response it
messageHub.on('hi', () => {
  console.log(`main thread say hi ${++hiCount} time(s)`)
})

// calc fibonacci, read request data from ctx.request, response it by setting result to ctx.request
messageHub.route('fib', ctx => {
  ctx.response = fib(ctx.request)
})

// use a recursion algorithm which will take more than half a minute when n big than 50
function fib (n) {
  if (n < 2) return n
  return fib(n - 1) + fib(n - 2)
}