import {describe, expect, it, vi} from 'vitest';
import {emptyBudget, loadBudget, MAX_BUDGET_CENTS, monthKey, parseMoney, saveBudget, summarizeBudget, type MonthlyBudget} from './family-budget';

const budget: MonthlyBudget = {
  salaryCents: 100_001,
  entries: [
    {id: 'rent', label: 'Квартплата', cents: 60_000, kind: 'bill', date: '2028-02-29'},
    {id: 'food', label: 'Продукты', cents: 10_000, kind: 'purchase'},
  ],
};

describe('family budget', () => {
  it('parses money exactly in cents and rejects malformed or excessive values', () => {
    expect(parseMoney(' 12\u202f345,67 ')).toBe(1_234_567);
    expect(parseMoney('0')).toBe(0);
    expect(parseMoney('0.01')).toBe(1);
    expect(parseMoney('9,5')).toBe(950);
    expect(parseMoney(String(MAX_BUDGET_CENTS / 100))).toBe(MAX_BUDGET_CENTS);
    for (const value of ['', '-1', '1.001', '18,50.2', '4e2', '1 2', '100000000.01']) {
      expect(parseMoney(value)).toBeNull();
    }
  });

  it('counts the current day, handles leap years and rounds down in cents', () => {
    const now = new Date(2028, 1, 28, 23, 59);
    expect(monthKey(now)).toBe('2028-02');
    expect(summarizeBudget(budget, '2028-02', now)).toEqual({
      bills: 60_000, purchases: 10_000, left: 30_001, days: 2, daily: 15_000,
    });
    expect(summarizeBudget(budget, '2028-02', new Date(2028, 1, 29)).daily).toBe(30_001);
    expect(summarizeBudget(budget, '2028-02', new Date(2027, 11, 31)).days).toBe(29);
    expect(summarizeBudget(budget, '2027-02', new Date(2027, 0, 1)).days).toBe(28);
    expect(summarizeBudget(budget, '2028-02', new Date(2028, 2, 1))).toMatchObject({days: 0, daily: null});
  });

  it('shows expenses without salary and preserves the deficit separately from the daily limit', () => {
    const now = new Date(2028, 1, 1);
    expect(summarizeBudget({...budget, salaryCents: null}, '2028-02', now)).toMatchObject({
      bills: 60_000, purchases: 10_000, left: null, daily: null,
    });
    expect(summarizeBudget({...budget, salaryCents: 1_000}, '2028-02', now)).toMatchObject({
      left: -69_000, daily: 0,
    });
  });

  it('loads and saves each profile and month independently', () => {
    const data = new Map<string, string>();
    const storage = {getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }};
    expect(saveBudget(storage, 'profile-a', '2028-02', budget)).toBe(true);
    expect(loadBudget(storage, 'profile-a', '2028-02')).toEqual(budget);
    expect(loadBudget(storage, 'profile-b', '2028-02')).toEqual(emptyBudget());
    expect(loadBudget(storage, 'profile-a', '2028-03')).toEqual(emptyBudget());
  });

  it('rejects invalid entries before replacing valid data and handles storage errors', () => {
    const storage = {getItem: () => '{"version":1,"salaryCents":-4,"entries":[]}', setItem: () => {throw new Error('Quota exceeded');}};
    expect(loadBudget(storage, 'profile-a', '2028-02')).toEqual(emptyBudget());
    expect(saveBudget(storage, 'profile-a', '2028-02', budget)).toBe(false);
    const destination = {setItem: vi.fn()};
    const invalidDate = {...budget.entries[0], date: '2028-02-30'};
    expect(saveBudget(destination, 'profile-a', '2028-02', {...budget, entries: [invalidDate]})).toBe(false);
    expect(saveBudget(destination, 'profile-a', '2028-02', {...budget, entries: [budget.entries[0], budget.entries[0]]})).toBe(false);
    expect(saveBudget(destination, 'profile-a', '2028-13', budget)).toBe(false);
    expect(destination.setItem).not.toHaveBeenCalled();
    expect(loadBudget({getItem: () => {throw new Error('Unavailable');}}, 'profile-a', '2028-02')).toEqual(emptyBudget());
  });
});
