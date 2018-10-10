import WorkerServer from '../../src/index'

const worker = new WorkerServer({ type: 'worker' })

worker.use((ctx, next) => {
  console.log('recieved in global middle ware', ctx)
  console.log('evt', typeof ctx.event)
  next()
})

let count = 0

setInterval(() => {
  worker.emit('tick', count++)
}, 1500)

worker.route({
  'add' (ctx, next) {
    ctx.response = 'im from add ' + ctx.request
    next()
  }
})

function fib (n) {
  if (n < 2) return n
  return fib(n - 2) + fib(n - 1)
}

worker.route({
  'fib' (ctx, next) {
    ctx.response = fib(+ctx.request)
    next()
  }
})



worker.route({
  'add' (ctx) {
    ctx.response += '<br>hhhh from add ' + ctx.request
  }
})

worker.on('haha', (msg) => {
  console.log('message recieved from hahah', msg)
})

worker.on('haha', (msg) => {
  console.log('message recieved from hahah 222', msg)
  return false
})