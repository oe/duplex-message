import MessageHub from '../../src'
const peer = self
// const messageHub = new MessageHub({
//   type: 'worker'
// })

// tik count
let tikCount = 0

setInterval(() => {
  // console.log('tick tok')
  MessageHub.emit(self, 'tik-tok', `<i>I'm alive: ${tikCount++}</i>`)
}, 1000)


setTimeout(async (param) => {
  console.log('mes from h', param)
  // get data from main thread
  const title = await MessageHub.emit(peer, 'pageTitle')
  console.log('page title', title)
  return `# ${param} (${title})`
}, 1000)
