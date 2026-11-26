import {useState, type FormEvent} from 'react';
import {ChevronLeft, ChevronRight, Plus} from 'lucide-react';
import {MAX_BUDGET_ENTRIES, MAX_BUDGET_LABEL_LENGTH, emptyBudget, loadBudget, monthKey, parseMoney, saveBudget, summarizeBudget, type BudgetEntry, type MonthlyBudget} from '../family-budget';
import {useUi} from '../language';
import {Modal} from './Modal';
import './family-budget.css';

export function FamilyBudget({profileId}: {profileId: string}) {
  const {language, t} = useUi();
  const [month, setMonth] = useState(monthKey);
  const [year, number] = month.split('-').map(Number);
  const label = new Intl.DateTimeFormat(language, {month:'long', year:'numeric'}).format(new Date(year, number - 1, 1));

  return <div className="family-budget">
    <div className="family-budget__month" role="group" aria-label={t('Месяц бюджета', 'Budget month')}>
      <button type="button" className="icon-button" aria-label={t('Предыдущий месяц', 'Previous month')}
        onClick={() => setMonth(monthKey(new Date(year, number - 2, 1)))}><ChevronLeft size={18} aria-hidden="true"/></button>
      <span>{label}</span>
      <button type="button" className="icon-button" aria-label={t('Следующий месяц', 'Next month')}
        onClick={() => setMonth(monthKey(new Date(year, number, 1)))}><ChevronRight size={18} aria-hidden="true"/></button>
    </div>
    <BudgetMonth key={month} month={month} profileId={profileId}/>
  </div>;
}

function BudgetMonth({month, profileId}: {month: string; profileId: string}) {
  const {language, t} = useUi();
  const [budget, setBudget] = useState(() => {
    try {return loadBudget(localStorage, profileId, month);}
    catch {return emptyBudget();}
  });
  const [salary, setSalary] = useState(budget.salaryCents === null ? '' : String(budget.salaryCents / 100));
  const [salaryError, setSalaryError] = useState(false);
  const [saved, setSaved] = useState(true);
  const [editor, setEditor] = useState<{kind:BudgetEntry['kind']; row?:BudgetEntry}>();
  const totals = summarizeBudget(budget, month);
  const currency = new Intl.NumberFormat(language, {style:'currency', currency:'RUB', minimumFractionDigits:0, maximumFractionDigits:2});
  const money = (cents:number|null) => cents === null ? '—' : currency.format(cents / 100);
  const shortDate = new Intl.DateTimeFormat(language, {day:'numeric', month:'short'});
  const groups = [
    {kind:'bill', label:t('Постоянные траты','Monthly bills'), total:totals.bills, empty:t('Например, аренда или интернет.', 'For example, rent or internet.')},
    {kind:'purchase', label:t('Покупки месяца','Purchases this month'), total:totals.purchases, empty:t('Например, продукты или одежда.', 'For example, groceries or clothes.')},
  ] as const;

  function commit(next: MonthlyBudget) {
    setBudget(next);
    try {setSaved(saveBudget(localStorage, profileId, month, next));}
    catch {setSaved(false);}
  }

  function saveSalary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseMoney(salary);
    if (salary.trim() && cents === null) {setSalaryError(true); return;}
    setSalaryError(false);
    commit({...budget, salaryCents:cents});
  }

  return <>
    <form className="family-budget__salary" noValidate onSubmit={saveSalary}>
      <label className="form__label" htmlFor="budget-salary">{t('Общая зарплата семьи за месяц, ₽','Total family income this month, ₽')}</label>
      <div>
        <input id="budget-salary" className="form__input" inputMode="decimal" maxLength={18} value={salary}
          aria-invalid={salaryError || undefined} aria-describedby={salaryError ? 'budget-salary-error' : undefined}
          placeholder="60 000" onChange={event => {setSalary(event.target.value);setSalaryError(false);}}/>
        <button type="submit" className="button button--secondary">{t('Сохранить зарплату','Save income')}</button>
      </div>
      {salaryError && <p className="notice notice--error" role="alert" id="budget-salary-error">{t('Введите сумму, например 60 000.','Enter an amount, for example 60 000.')}</p>}
    </form>

    <dl className="family-budget__totals" aria-live="polite">
      <div><dt>{t('Ушло за месяц', 'Spent this month')}</dt><dd>{money(totals.bills + totals.purchases)}</dd></div>
      <div><dt>{t('Осталось', 'Left')}</dt><dd data-budget-left data-negative={totals.left !== null && totals.left < 0 || undefined}>{money(totals.left)}</dd></div>
      <div><dt>{t('На день', 'Per day')}</dt><dd data-budget-daily>{money(totals.daily)}</dd></div>
    </dl>
    <p className="family-budget__note">{totals.days === 0 ? t('Этот месяц уже закончился.','This month has ended.') : totals.daily === null
      ? t('Укажите зарплату, чтобы посчитать бюджет на день.','Add your income to calculate the daily budget.')
      : t(`Остаток поделён на число дней до конца месяца: ${totals.days}.`, `Remaining money divided by ${totals.days} days left in the month.`)}</p>

    <table className="family-budget__table" aria-label={t('Расходы месяца','Monthly expenses')}>
      <thead><tr><th scope="col">{t('Что','Expense')}</th><th scope="col">{t('Когда','When')}</th><th scope="col">{t('Сумма','Amount')}</th></tr></thead>
      {groups.map(group => {
        const rows = budget.entries.filter(item => item.kind === group.kind);
        return <tbody key={group.kind}>
          <tr className="family-budget__group"><th scope="rowgroup" colSpan={2}>{group.label}</th><td>{money(group.total)}</td></tr>
          {rows.map(row => <tr key={row.id}>
            <th scope="row"><button type="button" onClick={() => setEditor({kind:row.kind,row})}>{row.label}</button></th>
            <td>{row.kind === 'bill' ? t('Раз в месяц','Monthly') : row.date ? shortDate.format(new Date(row.date + 'T12:00:00')) : '—'}</td>
            <td>{money(row.cents)}</td>
          </tr>)}
          {rows.length === 0 && <tr><td colSpan={3} className="family-budget__empty">{group.empty}</td></tr>}
        </tbody>;
      })}
    </table>
    <div className="family-budget__actions">
      <button type="button" className="button button--secondary" disabled={budget.entries.length >= MAX_BUDGET_ENTRIES}
        onClick={() => setEditor({kind:'bill'})}><Plus size={16} aria-hidden="true"/>{t('Добавить платёж','Add bill')}</button>
      <button type="button" className="button button--secondary" disabled={budget.entries.length >= MAX_BUDGET_ENTRIES}
        onClick={() => setEditor({kind:'purchase'})}><Plus size={16} aria-hidden="true"/>{t('Добавить покупку','Add purchase')}</button>
    </div>
    {!saved && <p className="notice notice--error" role="alert">{t('Браузер не сохранил изменения. Они доступны до закрытия экрана.','The browser could not save your changes. They are available until you close this screen.')}</p>}
    {editor && <BudgetEntryEditor month={month} {...editor} onClose={() => setEditor(undefined)} onSave={row => {
      const entries = editor.row ? budget.entries.map(item => item.id === row.id ? row : item) : [...budget.entries, row];
      commit({...budget, entries});
      setEditor(undefined);
    }} onRemove={row => {
      commit({...budget, entries:budget.entries.filter(item => item.id !== row.id)});
      setEditor(undefined);
    }}/>}
  </>;
}

function BudgetEntryEditor({month, kind, row, onSave, onRemove, onClose}: {
  month: string;
  kind: BudgetEntry['kind'];
  row?: BudgetEntry;
  onSave: (row:BudgetEntry) => void;
  onRemove: (row:BudgetEntry) => void;
  onClose: () => void;
}) {
  const {t} = useUi();
  const [error, setError] = useState('');
  const now = new Date();
  const bill = kind === 'bill';
  const [year, number] = month.split('-').map(Number);
  const lastDay = new Date(year, number, 0).getDate();
  const date = row?.date ?? month + '-' + String(month === monthKey(now) ? now.getDate() : 1).padStart(2, '0');
  const title = bill ? (row ? t('Изменить платёж','Edit bill') : t('Добавить платёж','Add bill'))
    : (row ? t('Изменить покупку','Edit purchase') : t('Добавить покупку','Add purchase'));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const label = String(values.get('label') ?? '').trim();
    const cents = parseMoney(String(values.get('amount') ?? ''));
    if (!label) {setError(t('Напишите название.','Enter a name.'));return;}
    if (cents === null || cents <= 0) {setError(t('Введите сумму больше нуля.','Enter an amount greater than zero.'));return;}
    const purchaseDate = String(values.get('date') ?? '');
    if (!bill && (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) || purchaseDate < `${month}-01` || purchaseDate > `${month}-${lastDay}`)) {
      setError(t('Выберите дату в этом месяце.','Choose a date in this month.'));return;
    }
    onSave({id:row?.id ?? crypto.randomUUID(), kind, label, cents, ...(!bill ? {date:purchaseDate} : {})});
  }

  return <Modal title={title} description={t('Введите название и сумму.','Enter a name and amount.')} onClose={onClose}>
    <form className="form" noValidate onSubmit={submit} onChange={() => setError('')}>
      <label className="form__label" htmlFor="budget-entry-label">{bill ? t('Название платежа','Bill name') : t('Что купили','What you bought')}</label>
      <input id="budget-entry-label" name="label" className="form__input" maxLength={MAX_BUDGET_LABEL_LENGTH} defaultValue={row?.label}/>
      <label className="form__label" htmlFor="budget-entry-amount">{t('Сумма, ₽','Amount, ₽')}</label>
      <input id="budget-entry-amount" name="amount" className="form__input" inputMode="decimal" maxLength={18} defaultValue={row ? row.cents / 100 : ''}/>
      {!bill && <><label className="form__label" htmlFor="budget-entry-date">{t('Дата покупки','Purchase date')}</label>
        <input id="budget-entry-date" name="date" type="date" className="form__input" defaultValue={date} min={month+'-01'} max={month+'-'+lastDay}/></>}
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      <div className="family-budget__actions">
        <button type="submit" className="button button--primary">{t('Сохранить','Save')}</button>
        {row && <button type="button" className="button button--text" onClick={() => onRemove(row)}>{t('Удалить запись','Delete entry')}</button>}
      </div>
    </form>
  </Modal>;
}
