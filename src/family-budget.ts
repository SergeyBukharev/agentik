export type BudgetEntry = {id: string; label: string; cents: number; kind: 'bill' | 'purchase'; date?: string};
export type MonthlyBudget = {salaryCents: number | null; entries: BudgetEntry[]};

export const MAX_BUDGET_CENTS = 10_000_000_000;
export const MAX_BUDGET_ENTRIES = 500;
export const MAX_BUDGET_LABEL_LENGTH = 120;

const MAX_ID_LENGTH = 128;
const MAX_STORED_LENGTH = 1_000_000;
const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function emptyBudget(): MonthlyBudget {
  return {salaryCents: null, entries: []};
}

export function parseMoney(input: string): number | null {
  const match = /^(\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const [, whole, fraction = ''] = match;
  const cents = Number(whole.replace(/\s/g, '')) * 100 + Number(fraction.padEnd(2, '0'));
  return isCents(cents, 0) ? cents : null;
}

export function monthKey(date = new Date()): string {
  const year = date.getFullYear();
  if (!(year >= 1 && year <= 9999)) return '';
  return String(year).padStart(4, '0') + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function isMonth(month: string): boolean {
  return /^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/.test(month);
}

function daysInMonth(month: string): number {
  const monthNumber = Number(month.slice(5));
  if (monthNumber === 2) {
    const year = Number(month.slice(0, 4));
    if (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) return 29;
  }
  return daysPerMonth[monthNumber - 1];
}

export function summarizeBudget(budget: MonthlyBudget, month: string, now = new Date()) {
  let bills = 0;
  let purchases = 0;
  for (const entry of budget.entries) {
    if (entry.kind === 'bill') bills += entry.cents;
    else purchases += entry.cents;
  }
  const currentMonth = monthKey(now);
  const days = currentMonth && isMonth(month) && month >= currentMonth
    ? daysInMonth(month) - (month === currentMonth ? now.getDate() - 1 : 0)
    : 0;
  const left = budget.salaryCents === null ? null : budget.salaryCents - bills - purchases;
  const daily = days && left !== null ? Math.max(0, Math.floor(left / days)) : null;
  return {bills, purchases, left, days, daily};
}

function isCents(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= MAX_BUDGET_CENTS;
}

function isDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const month = value.slice(0, 7);
  const day = Number(value.slice(8));
  return isMonth(month) && day >= 1 && day <= daysInMonth(month);
}

function isEntry(value: unknown): value is BudgetEntry {
  if (!value || typeof value !== 'object') return false;
  const {id, label, cents, kind, date} = value as Partial<BudgetEntry>;
  return typeof id === 'string' && id.trim().length > 0 && id.length <= MAX_ID_LENGTH
    && typeof label === 'string' && label.trim().length > 0 && label.length <= MAX_BUDGET_LABEL_LENGTH
    && isCents(cents, 1) && (kind === 'bill' || kind === 'purchase') && (date === undefined || isDate(date));
}

function isBudget(value: unknown): value is MonthlyBudget {
  if (!value || typeof value !== 'object') return false;
  const {salaryCents, entries} = value as Partial<MonthlyBudget>;
  return (salaryCents === null || isCents(salaryCents, 0))
    && Array.isArray(entries) && entries.length <= MAX_BUDGET_ENTRIES && entries.every(isEntry)
    && new Set(entries.map(entry => entry.id)).size === entries.length;
}

function budgetKey(profileId: string, month: string): string | null {
  if (!profileId || profileId.length > MAX_ID_LENGTH || !isMonth(month)) return null;
  return `agentik:family-budget:${profileId}:${month}`;
}

export function loadBudget(storage: Pick<Storage, 'getItem'>, profileId: string, month: string): MonthlyBudget {
  const key = budgetKey(profileId, month);
  if (!key) return emptyBudget();
  try {
    const raw = storage.getItem(key);
    if (!raw || raw.length > MAX_STORED_LENGTH) return emptyBudget();
    const data = JSON.parse(raw) as unknown;
    if (isBudget(data) && 'version' in data && data.version === 1) {
      return {salaryCents: data.salaryCents, entries: data.entries};
    }
  } catch { /* Treat an unavailable or invalid local record as empty. */ }
  return emptyBudget();
}

export function saveBudget(storage: Pick<Storage, 'setItem'>, profileId: string, month: string, value: MonthlyBudget): boolean {
  const key = budgetKey(profileId, month);
  if (!key || !isBudget(value)) return false;
  try {
    storage.setItem(key, JSON.stringify({version: 1, salaryCents: value.salaryCents, entries: value.entries}));
    return true;
  } catch {
    return false;
  }
}
