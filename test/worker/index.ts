import WorkerServer from '../../src/index'
// const workerts = require.resolve('./worker.ts')
const worker = new WorkerServer({ type: 'worker', peer: new Worker('./worker.ts') })
const result = document.getElementById('result')!
document.getElementById('xxx')!.addEventListener('keyup', (e) => {
  if (e.keyCode === 13) {
    // @ts-ignore
    worker.fetch('add', e.target!.value).then((resp) => {
      // @ts-ignore
      result.innerHTML = resp
    })
    // @ts-ignore
    worker.emit('haha', 'hi from ' + e.target.value)
  }
})


worker.on('tick', (resp) => {
  console.log('resp', resp)
})