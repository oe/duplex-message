import { expect, it } from 'vitest';
import { StorageMessageHub } from 'src/storage-message';

it('should throw when Storage not supported', async () => {
  // @ts-expect-error fix type error
  globalThis.BroadcastChannel = undefined;
  expect(() => new StorageMessageHub()).toThrowError();
  expect(() => StorageMessageHub.shared).toThrowError();
  const o = {
    a: { b: { c: 1 } },
  }
  // @ts-expect-error for test
  o.dd = o
  // @ts-expect-error for test
  const fn = () => StorageMessageHub.prototype.sendMessage.call({
    _getMsgKey() {return 'test'},
    // @ts-ignore
  }, 'peer', o)
  expect(fn).toThrowError();
});
