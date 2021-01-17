import MessageHub from '../../src'

document.body.addEventListener('click', (e) => {
  MessageHub.emit(parent, 'page-title', 'ssss').then((resp) => {
    console.log('response from outer', resp)
  }).catch((err) => { console.warn(err) });
})