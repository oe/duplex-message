import MessageHub from '../../src'

const messageHub = new MessageHub({ type: 'frame', peer: parent })
messageHub.use((ctx, next) => {
  console.log('request from iframe', ctx.request)
  return next()
})

messageHub.route('getName', (ctx, next) => {
  ctx.response = 'hahahahahah'
})

document.body.addEventListener('click', (e) => {
  // use ready to make sure the peer is ready
  messageHub.ready().then(() =>
    messageHub.fetch('page-title', 'ssss').then((resp) => {
      console.log('response from outer', resp)
    })
  )
})