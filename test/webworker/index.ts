import WorkerServer from 'src/index'

const worker = new WorkerServer('worker-loader!./worker.js')
const result = document.getElementById('result')!
document.getElementById('xxx')!.addEventListener('keyup', async (e) => {
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
