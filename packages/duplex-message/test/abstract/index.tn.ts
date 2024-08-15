import { describe, it, expect, vi } from 'vitest';
import { AbstractHub } from '../../src/abstract';

describe('duplex-message abstract static methods', () => {
  it('generateInstanceID', () => {
    // @ts-ignore
    const id = AbstractHub.generateInstanceID();
    expect(typeof id).toBe('string');
    expect(id.length > 10).toBe(true);
  })

  it('normalizeRequest', () => {
    // @ts-ignore
    const req = AbstractHub.normalizeRequest('test', {});
    expect(req).toEqual({});
    // @ts-ignore
    const req2 = AbstractHub.normalizeRequest('test', { progress: false });
    expect(req2).toEqual({ progress: false });

    const msg = {
      progress: true,
      data: [{header: 1, onprogress: () => {}}],
    }
    // @ts-ignore
    const req3 = AbstractHub.normalizeRequest('test', msg);
    expect(req3).toEqual({ progress: true, data: [{header: 1}] });
    expect(msg === req3).toBe(false);
  })

  it('mergeEventMap', () => {
    const fn1 = () => {}
    const fn2 = () => {console.log('test')}
    const fn3 = () => {console.log('test2')}
    const map1 = {
      'test': [fn2],
      'test2': [fn1],
    }
    const map2 = {
      'test': [fn3],
      'test3': [fn1],
    }
    // @ts-ignore
    const map = AbstractHub.mergeEventMap(map1, map2);
    expect(map).toEqual({
      'test': [fn2, fn3],
      'test2': [fn1],
      'test3': [fn1],
    })
  })

})

describe("wrapResponseCallback", () => {
  it("should return 0 when the response is not a message", () => {
    // @ts-ignore
    const instance = new AbstractHub();
    const reqMsg = { messageID: 1, from: "peer1", type: "request" };
    const callback = vi.fn();
    // @ts-ignore
    const wrappedCallback = AbstractHub.wrapResponseCallback(instance, reqMsg, callback);
    const resp = { data: "response" };
    // @ts-ignore
    const result = wrappedCallback(resp);
    expect(result).toBe(0);
    expect(callback).not.toHaveBeenCalled();
  });

  it("should return 0 when the response is not designed for the request", () => {
    // @ts-ignore
    const instance = new AbstractHub({ instanceID: "peer1" });
    const reqMsg = { messageID: 1, from: "peer1", type: "request" };
    const callback = vi.fn();
    // @ts-ignore
    const wrappedCallback = AbstractHub.wrapResponseCallback(instance, reqMsg, callback);
    const resp = { from: "peer2", to: "peer3", messageID: 1, type: "response", data: "response" };
    // @ts-ignore
    const result = wrappedCallback(resp);
    expect(result).toBe(0);
    expect(callback).not.toHaveBeenCalled();
  });

  it("should return 2 when the response is a progress message with CONTINUE_INDICATOR", () => {
    // @ts-ignore
    const instance = new AbstractHub({ instanceID: "peer1" });
    const reqMsg = { messageID: 1, from: "peer1", type: "request" };
    const callback = vi.fn();
    // @ts-ignore
    const wrappedCallback = AbstractHub.wrapResponseCallback(instance, reqMsg, callback);
    // @ts-ignore
    const resp = { from: "peer2", to: "peer1", messageID: 1, type: "progress", data: '--message-hub-to-be-continued--' };
    // @ts-ignore
    const result = wrappedCallback(resp);
    expect(result).toBe(2);
    expect(callback).not.toHaveBeenCalled();
    // @ts-ignore
    const result2 = wrappedCallback(resp);
    expect(result2).toBe(2);
  });

  it("should call the callback with the response when the response is a valid response message", () => {
    // @ts-ignore
    const instance = new AbstractHub({ instanceID: "peer1" });
    const reqMsg = { messageID: 1, from: "peer1", type: "request" };
    const callback = vi.fn();
    // @ts-ignore
    const wrappedCallback = AbstractHub.wrapResponseCallback(instance, reqMsg, callback);
    const resp = { from: "peer2", to: "peer1", messageID: 1, type: "response", isSuccess: true, data: "response" };
    callback.mockReturnValue('test');
    // @ts-ignore
    const result = wrappedCallback(resp);
    expect(result).toBe('test');
    expect(callback).toHaveBeenCalledWith(resp);
  });
});


describe('getMethodCallbacks', () => {
  it('should return undefined when handlerTuple is undefined', () => {
    // @ts-ignore
    const result = AbstractHub.getMethodCallbacks('methodName', undefined);
    expect(result).toBeUndefined();
  });

  it('should return undefined when handlerMap is undefined', () => {
    const handlerTuple: [any, undefined] = [null, undefined];
    // @ts-ignore
    const result = AbstractHub.getMethodCallbacks('methodName', handlerTuple);
    expect(result).toBeUndefined();
  });

  it('should return [callbacks, false] when callbacks exist in handlerMap', () => {
    const callbacks = [() => {}, () => {}];
    const handlerMap = { methodName: callbacks };
    const handlerTuple: [any, typeof handlerMap] = [null, handlerMap];
    // @ts-ignore
    const result = AbstractHub.getMethodCallbacks('methodName', handlerTuple);
    expect(result).toEqual([callbacks, false]);
  });

  it('should return [handlerMap, true] when handlerMap is a function', () => {
    const handlerMap = () => {};
    const handlerTuple: [any, typeof handlerMap] = [null, handlerMap];
    // @ts-ignore
    const result = AbstractHub.getMethodCallbacks('methodName', handlerTuple);
    expect(result).toEqual([handlerMap, true]);
  });

  it('other cases', () => {
    const fn1 = () => {}
    const fn2 = () => {console.log('test')}
    const handlerTuple = [
      '*',
      fn1
    ]
    // @ts-ignore
    const cb1 = AbstractHub.getMethodCallbacks('test', handlerTuple);
    expect(cb1).toEqual([fn1, true]);

    const handlerTuple2 = [
      'test',
      {'abc': fn2}
    ]
    // @ts-ignore
    const cb2 = AbstractHub.getMethodCallbacks('test', handlerTuple2);
    expect(cb2).toEqual(undefined);

    const handlerTuple3 = [
      'test',
      {'test': [fn2]}
    ]
    // @ts-ignore
    const cb3 = AbstractHub.getMethodCallbacks('test', handlerTuple3);
    expect(cb3).toEqual([[fn2], false]);
  })
});


describe('duplex-message abstract instance utils methods', () => { 
  it('isRequestMessage', () => {
    // @ts-expect-error for test
    const instance = new AbstractHub({ instanceID: 'test' });

    const testsMaps = [
      [{}, false],
      [{to: 'test', messageID: 'abc', type: 'progress'}, false],
      [{to: 'test', from: 'xxx', messageID: 'abc', type: 'progress'}, false],
      [{to: 'test', from: 'xxx', messageID: 'abc', type: 'request'}, true],
      [{data: 'test', from: 'xxx', messageID: 'abc', type: 'request'}, true],
    ]

    testsMaps.forEach(([msg, expected]) => {
      // @ts-ignore
      expect(!!instance.isRequestMessage(msg)).toBe(expected);
    })

  })
})