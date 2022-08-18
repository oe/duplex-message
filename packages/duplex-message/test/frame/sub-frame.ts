import { PostMessageHub } from '../../src'
const postMessageHub = new PostMessageHub

const messageHub = postMessageHub.createDedicatedMessageHub(parent)
const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, '')) as HTMLElement
}

$('#test-1').addEventListener('click', () => {
  messageHub
    .emit("page-title", {
      echo: ($("input-1") as HTMLInputElement).value,
      // onprogress: (p) => {
      //   $("#result-1").innerText = `progress: ${p}`
      // }
    })
    .then((res: any) => {
      $("#result-1").innerText = res;
    });
})

$('#test-2').addEventListener('click', () => {
  messageHub.emit('page-title-222').then((res: any) => {
    $('#result-2').innerText = res
  }).catch(err => {
    $("#result-2").innerText = 'error: ' + JSON.stringify(err)
  })
})
