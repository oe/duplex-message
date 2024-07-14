import { expect, describe, it, vi } from 'vitest';

import { setConfig } from 'src/abstract';
import { BroadcastMessageHub } from 'src/broadcast-message';

describe('broadcast', () => {
  it('normal usage', async (ctx) => {
    // ctx.
    const hub = new BroadcastMessageHub();
    const cb = vi.fn();
    const shared = BroadcastMessageHub.shared;
    expect(shared.isDestroyed).toBe(false);
    setConfig({ debug: true })
  });
});