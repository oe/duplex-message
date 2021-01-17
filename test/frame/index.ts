import MessageHub from '../../src'

const frameWin = (document.getElementById('frame') as HTMLFrameElement).contentWindow

MessageHub.on(frameWin, {
  'page-title': (arg) => {
    throw new Error('can not get title')
    return document.title + ' --- ' + arg
  }
})