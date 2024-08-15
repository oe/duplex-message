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
    p1.off('hello');

    expect(p2.emit('hello', 'world')).rejects.toThrowError();
    p1.on('hello', cb);
    p1.destroy();
    p1.destroy();
    expect(p2.emit('hello', 'world')).rejects.toThrowError();
  });

  it('use shared instance', async () => {
    const shared = PageScriptMessageHub.shared;
    const cb = vi.fn();
    const p2 = new PageScriptMessageHub();
    shared.on('hello', cb)
    p2.emit('hello', 'world');
    expect(cb).toBeCalledWith('world');
    const shared2 = PageScriptMessageHub.shared;
    shared2.off('hello');
    expect(p2.emit('hello', 'world')).rejects.toThrowError();
  })
});