import WorkerServer from '../../src'

const frameWin = (document.getElementById('frame') as HTMLFrameElement).contentWindow
const worker = new WorkerServer({ type: 'frame', peer: frameWin, targetOrigin: '*' })
worker.use((ctx, next) => {
  console.log('request from iframe', ctx.request)
  next()
})

worker.route('getName', (ctx, next) => {
  ctx.response = 'hahahahahah'
})