import WorkerServer from '../../src/index'

const worker = new WorkerServer({ type: 'frame', peer: parent })
// worker.use((ctx, next) => {
//   console.log('request from iframe', ctx.request)
//   next()
// })

// worker.route('getName', (ctx, next) => {
//   ctx.response = 'hahahahahah'
// })

document.body.addEventListener('click', (e) => {
  console.log('click', e)
  worker.fetch('getName', 'ssss').then((resp) => {
    console.log('response from outer', resp)
  })
})