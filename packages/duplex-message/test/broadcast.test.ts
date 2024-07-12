import { beforeEach, describe, it, vi } from 'vitest';
import { BroadcastMessageHub } from '../src/broadcast-message';

describe('broadcast', () => {
  let hubOuter: BroadcastMessageHub;
  let hubInner: BroadcastMessageHub;
  beforeEach(() => {
    hubOuter = new BroadcastMessageHub();
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    hubInner = new BroadcastMessageHub();
    // iframe.contentWindow.postMessage = hubInner.bc.postMessage.bind(hubInner.bc);
  });
  it('normal usage', async () => {
    const hub = new BroadcastMessageHub();
    const cb = vi.fn();
    
  });
});