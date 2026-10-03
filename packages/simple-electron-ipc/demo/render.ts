import type { DemoApi } from './api'

const api: DemoApi = window.duplexDemo
const text = (id: string, value: string) => { document.getElementById(id)!.textContent = value }
const message = (error: unknown) => error instanceof Error ? error.message : String(error)

document.getElementById('download')!.addEventListener('click', () => {
  void api.download(count => text('download-resp', `Progress: ${count}%`))
    .then(result => text('download-resp', result), error => text('download-resp', message(error)))
})
document.getElementById('cancel')!.addEventListener('click', () => api.cancelDownload())
document.getElementById('get-title')!.addEventListener('click', () => {
  void api.getTitle('Title: ').then(result => text('get-title-resp', result), error => text('get-title-resp', message(error)))
})
document.getElementById('get-calc')!.addEventListener('click', () => {
  void api.calculate(2, 3).then(result => text('get-calc-resp', String(result)), error => text('get-calc-resp', message(error)))
})
