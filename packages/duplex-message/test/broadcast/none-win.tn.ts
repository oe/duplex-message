import { expect, it } from 'vitest';
import { BroadcastMessageHub } from 'src/broadcast-message';

it('should throw when broadcast not supported', async () => {
  const OldBroadcastChannel = globalThis.BroadcastChannel;
  // @ts-expect-error fix type error
  globalThis.BroadcastChannel = undefined;
  expect(() => new BroadcastMessageHub()).toThrowError();
  expect(() => BroadcastMessageHub.shared).toThrowError();
  globalThis.BroadcastChannel = OldBroadcastChannel;
});
