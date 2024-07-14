import { beforeEach, describe, it, vi } from 'vitest';
import { server } from '@vitest/browser/context'
import { BroadcastMessageHub } from '../src/broadcast-message';

describe('broadcast', () => {
  // let hubOuter: BroadcastMessageHub;
  // let hubInner: BroadcastMessageHub;
  // beforeEach(() => {
  //   hubOuter = new BroadcastMessageHub();
  //   const iframe = document.createElement('iframe');
  //   document.body.appendChild(iframe);
  //   hubInner = new BroadcastMessageHub();
  //   // iframe.contentWindow.postMessage = hubInner.bc.postMessage.bind(hubInner.bc);
  // });
  it('normal usage', async (ctx) => {
    // ctx.
    const hub = new BroadcastMessageHub();
    const cb = vi.fn();

    
  });
});