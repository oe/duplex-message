import { PostMessageHub } from '../../src'
const postMessageHub = new PostMessageHub

const peer = self

// tik count
let tikCount = 0

setInterval(() => {
  postMessageHub.emit(peer, 'tik-tok', `<i>I'm alive: ${tikCount++}</i>`)
}, 1000)


setTimeout(async (param) => {
  console.log('mes from h', param)
  // get data from main thread
  const title = await postMessageHub.emit(peer, 'page-title', {
    onprogress(e) { console.log('progress from worker thread', e)}
  })
  console.log('page title received in worker', title)
  return `# ${param} (${title})`
}, 1000)
