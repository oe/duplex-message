import MessageHub from '../../src'
const peer = self

// tik count
let tikCount = 0

setInterval(() => {
  MessageHub.emit(peer, 'tik-tok', `<i>I'm alive: ${tikCount++}</i>`)
}, 1000)


setTimeout(async (param) => {
  console.log('mes from h', param)
  // get data from main thread
  const title = await MessageHub.emit(peer, 'page-title')
  console.log('page title', title)
  return `# ${param} (${title})`
}, 1000)
