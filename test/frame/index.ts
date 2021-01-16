import messageHub from '../../src'

const frameWin = (document.getElementById('frame') as HTMLFrameElement).contentWindow

messageHub.on(frameWin, {
  'page-title': (arg) => {
    throw new Error('can not get title')
    return document.title + ' --- ' + arg
  }
})