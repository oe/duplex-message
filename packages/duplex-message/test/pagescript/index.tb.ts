import { track } from '../resources'
import { expect, describe, it, vi } from 'vitest';
import { PageScriptMessageHub } from 'src/page-script-message';

describe('page script', () => {
  it('creates a usable shared instance after destroy', async () => {
    const original = track(PageScriptMessageHub.shared)
    original.destroy()
    const replacement = track(PageScriptMessageHub.shared)
    expect(replacement).not.toBe(original)
    replacement.on('echo', (value: string) => value)
    const client = track(new PageScriptMessageHub())
    await expect(client.emit('echo', 'ready')).resolves.toBe('ready')
  })

  it('normal usage', async () => {
    const p1 = track(new PageScriptMessageHub());
    const p2 = track(new PageScriptMessageHub());
    const cb = vi.fn();
    p1.on('hello', cb)
    await p2.emit('hello', 'world');
    expect(cb).toHaveBeenCalledWith('world');
    p1.off('hello');

    await expect(p2.emit('hello', 'world')).rejects.toThrowError();
    p1.on('hello', cb);
    p1.destroy();
    p1.destroy();
    await expect(p2.emit('hello', 'world')).rejects.toThrowError();
  });

  it('use shared instance', async () => {
    const shared = track(PageScriptMessageHub.shared);
    const cb = vi.fn();
    const p2 = track(new PageScriptMessageHub());
    shared.on('hello', cb)
    await p2.emit('hello', 'world');
    expect(cb).toHaveBeenCalledWith('world');
    const shared2 = track(PageScriptMessageHub.shared);
    shared2.off('hello');
    await expect(p2.emit('hello', 'world')).rejects.toThrowError();
  })
});
