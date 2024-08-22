import { PostMessageHub } from 'src/post-message';

import DemoWorker from './worker?worker'

console.log('frame proxy postMessage', location.href)

const hub = new PostMessageHub({instanceID: 'iframe'});

const worker = new DemoWorker()

// make this frame as a transparent proxy
hub.createProxy(parent, worker)
hub.createProxy(worker, parent)

try {
  hub.createProxy(self, self)
} catch (error) {
  console.log('unable to proxy message to own', error)
}
