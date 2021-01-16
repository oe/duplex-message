import messageHub from '../../src'

document.body.addEventListener('click', (e) => {
  messageHub.emit(parent, 'page-title', 'ssss').then((resp) => {
    console.log('response from outer', resp)
  }).catch((err) => { console.warn(err) });
})