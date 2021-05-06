import { PostMessageHub } from 'duplex-message'
const postMessageHub = new PostMessageHub

const messageHub = postMessageHub.createDedicatedMessageHub(parent)
const $ = (id: string) => {
  return document.getElementById(id.replace(/^\#/, ''))
}

$('#test-1').addEventListener('click', () => {
  messageHub.emit('page-title', {
    // onprogress: (p) => {
    //   $("#result-1").innerText = `progress: ${p}`
    // }
  }, ($('input-1') as HTMLInputElement).value).then((res) => {
    $('#result-1').innerText = res
  })
})
