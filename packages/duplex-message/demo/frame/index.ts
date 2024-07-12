import { PostMessageHub, setConfig } from '../../src'

setConfig({debug: true})
const postMessageHub = PostMessageHub.shared

// @ts-ignore
window.pm = postMessageHub

const frameWin = (document.getElementById('frame') as HTMLFrameElement).contentWindow

const messageHub = postMessageHub.createDedicatedMessageHub(frameWin!)
// @ts-ignore
window.mh = messageHub
const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, '')) as HTMLElement
}

postMessageHub.on('*', "page-title", (arg) => {
  return new Promise((resolve, reject) => {
    let count = 0;
    if (!arg || !arg.onprogress) return resolve(
      document.title + (arg.echo ? ", echo  --- " + arg.echo : "")
    );
    const tid = setInterval(() => {
      arg.onprogress((count += 10));
      if (count >= 100) {
        clearInterval(tid);
        resolve(document.title + (arg.echo ? ", echo  --- " + arg.echo : ""));
      }
    }, 100);
  });
});

// listen message from frameWin
messageHub.on({
  testError (...args) {
    console.log('arguments from testError', args)
    throw new TypeError('testError not implemented')
  },
  'tik-tok': msg => {
    $('tik-tok').innerHTML = msg
  }
})


$('#button-1').addEventListener('click', () => {
  messageHub.emit('hi', ($('input-1') as HTMLInputElement).value).then((res) => {
    console.log('response from hi', res)
  })
})

$('#button-2').addEventListener('click', () => {
  messageHub.emit('getHead',).then((res) => {
    $('#result-2').innerText = res as string
  })
})

$('#button-3').addEventListener('click', () => {
  messageHub.emit('not-existing-method',).then((res) => {
    $('#result-3').innerHTML = 'success: ' + res
  }).catch(err => {
    console.log('err', err)
    $('#result-3').innerHTML = 'failed: ' + JSON.stringify(err)
  })
})

