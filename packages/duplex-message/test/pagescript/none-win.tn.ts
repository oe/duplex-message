import { expect, it } from 'vitest';
import { PageScriptMessageHub } from 'src/page-script-message';

it('should throw in non window env', async () => {
  expect(() => new PageScriptMessageHub()).toThrowError();
  expect(() => PageScriptMessageHub.shared).toThrowError();
});
