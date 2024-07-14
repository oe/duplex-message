import { expect, describe, it, vi } from 'vitest';
import { PageScriptMessageHub } from 'src/page-script-message';

describe('page script', () => {
  it('normal usage', async () => {
    const p1 = new PageScriptMessageHub();
    const p2 = new PageScriptMessageHub();
    const cb = vi.fn();
    p1.on('hello', cb)
    p2.emit('hello', 'world');

    expect(cb).toBeCalledWith('world');
  });
});