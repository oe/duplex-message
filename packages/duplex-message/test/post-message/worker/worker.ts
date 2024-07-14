import { PostMessageHub } from 'src/post-message';

const hub = new PostMessageHub();
console.log('hooo worker')
hub.on(self, 'greet', async (msg: string) => {
  return msg
})
