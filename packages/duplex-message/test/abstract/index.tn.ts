import { describe, it, expect } from 'vitest';
import { AbstractHub } from '../../src/abstract';

describe('duplex-message abstract static methods', () => {
  it('generateInstanceID', () => {
    // @ts-ignore
    const id = AbstractHub.generateInstanceID();
    expect(typeof id).toBe('string');
    expect(id.length > 20).toBe(true);
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


  it('getMethodCallbacks', () => {
    const fn1 = () => {}
    const fn2 = () => {console.log('test')}
    const fn3 = () => {console.log('test2')}
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

})