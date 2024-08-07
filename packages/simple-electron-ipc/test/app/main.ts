import { MainMessageHub } from '../../src';

const hub = new MainMessageHub();
hub.on('*', 'ping', (data) => {
  console.log('ping', data);
  return 'good'
})
