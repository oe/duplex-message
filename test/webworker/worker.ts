import WorkerServer from 'src/index'

const worker = new WorkerServer()

worker.use((ctx, next) => {
  console.log('recieved in global middle ware', ctx)
  console.log('evt', typeof ctx.event)
  next()
})

worker.route({
  'add' (ctx, next) {
    ctx.response = 'im from add ' + ctx.request
    next()
  }
})

worker.route({
  'add' (ctx) {
    ctx.response += '<br>im from add ' + ctx.request
  }
})

worker.on('haha', (msg) => {
  console.log('message recieved from hahah', msg)
})

worker.on('haha', (msg) => {
  console.log('message recieved from hahah 222', msg)
  return false
})
