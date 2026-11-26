import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {messageBalanceKey} from './message-balance';
import {useMessageBalance} from './useMessageBalance';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

it('marks the second accepted message and refuses later attempts without charging a rejected draft', async () => {
  const accountId = 'trial-budget';
  const {result, unmount} = renderHook(() => useMessageBalance(accountId, false));
  const commit = vi.fn(() => true);
  expect(result.current).toMatchObject({remaining: 2, price: 1});

  await act(async () => {
    expect(await result.current.submit(() => false)).toBe('failed');
    expect(await result.current.submit(commit)).toBe('accepted');
  });
  expect(result.current.remaining).toBe(1);
  await act(async () => {
    expect(await result.current.submit(commit)).toBe('last');
    expect(await result.current.submit(commit)).toBe('blocked');
  });
  expect(commit).toHaveBeenCalledTimes(2);
  expect(result.current.remaining).toBe(0);
  unmount();
  const returned = renderHook(() => useMessageBalance(accountId, false));
  expect(returned.result.current.remaining).toBe(0);
});

it('isolates balances between accounts and preserves the Free balance when enabling and disabling PRO', async () => {
  const {result, rerender} = renderHook(
    ({accountId, pro}) => useMessageBalance(accountId, pro),
    {initialProps:{accountId:'plan-budget', pro:false}},
  );
  await act(async () => { await result.current.submit(() => true); });
  expect(result.current.remaining).toBe(1);

  rerender({accountId:'other-account', pro:false});
  expect(result.current.remaining).toBe(2);
  rerender({accountId:'plan-budget', pro:true});
  expect(result.current).toMatchObject({remaining: Infinity, price: 0});
  await act(async () => {
    expect(await result.current.submit(() => true)).toBe('accepted');
  });
  rerender({accountId:'plan-budget', pro:false});
  expect(result.current.remaining).toBe(1);
});

it('learns when another tab spends a token and ignores a stale replacement', async () => {
  const accountId='synced-budget';
  const key=messageBalanceKey(accountId);
  const {result}=renderHook(() => useMessageBalance(accountId, false));
  const update = (value:string) => act(() => {
    localStorage.setItem(key,value);
    window.dispatchEvent(new StorageEvent('storage',{key,newValue:value,storageArea:localStorage}));
  });
  update('1');
  expect(result.current.remaining).toBe(1);
  update('0');
  update('1');
  expect(result.current.remaining).toBe(0);
  const commit=vi.fn(() => true);
  await act(async () => { expect(await result.current.submit(commit)).toBe('blocked'); });
  expect(commit).not.toHaveBeenCalled();
});

it('retains the current account balance in memory if storage is unavailable', async () => {
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(() => { throw new Error('storage blocked'); });
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw new Error('storage blocked'); });
  const useBudget=() => useMessageBalance('in-memory-budget', false);
  const {result,unmount}=renderHook(useBudget);
  await act(async () => { expect(await result.current.submit(() => true)).toBe('accepted'); });
  unmount();
  expect(renderHook(useBudget).result.current.remaining).toBe(1);
});

it('does not commit a locked operation after the account switches', async () => {
  let runLock!:() => void;
  let resolveLock!:(value:unknown) => void;
  const lock = vi.fn((_name, _options, run:() => unknown) => new Promise(resolve => {
    resolveLock=resolve;
    runLock=() => resolveLock(run());
  }));
  vi.stubGlobal('navigator',Object.create(navigator,{locks:{value:{request:lock}}}));
  try {
    const {result,rerender}=renderHook(id=>useMessageBalance(id,false),{initialProps:'locked-budget'});
    const commit=vi.fn(() => true);
    const pending=result.current.submit(commit);
    expect(lock).toHaveBeenCalledOnce();
    rerender('new-budget');
    await act(async () => {
      runLock();
      expect(await pending).toBe('failed');
    });
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.remaining).toBe(2);
  } finally {
    vi.unstubAllGlobals();
  }
});

it('rechecks persisted tokens when a queued operation obtains its lock', async () => {
  let release!:() => void;
  const accountId = 'recheck-budget';
  const lock = vi.fn((_name, _options, run:() => unknown) => new Promise(resolve => {
    release = () => resolve(run());
  }));
  vi.stubGlobal('navigator',Object.create(navigator,{locks:{value:{request:lock}}}));
  try {
    const {result}=renderHook(() => useMessageBalance(accountId, false));
    const commit=vi.fn(() => true);
    const pending=result.current.submit(commit);
    localStorage.setItem(messageBalanceKey(accountId),'1');
    await act(async () => {
      release();
      expect(await pending).toBe('last');
    });
    expect(commit).toHaveBeenCalledOnce();
    expect(result.current.remaining).toBe(0);
  } finally {
    vi.unstubAllGlobals();
  }
});
