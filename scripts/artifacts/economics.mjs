import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';

const wb = Workbook.create();
const model = wb.worksheets.add('Экономика');
const drivers = wb.worksheets.add('Допущения');
const work = wb.worksheets.add('Разработка');
const currency = '$#,##0.00;($#,##0.00);$0.00';
const caseNames = ['Консервативный', 'Базовый', 'Оптимистичный'];

for (const sheet of [model, drivers, work]) {
  sheet.showGridLines = false;
  const cells = sheet.getRange('A1:F44');
  cells.format.font.name = 'Arial';
  cells.format.font.size = 11;
  cells.format.rowHeight = 23;
  sheet.getRange('A:A').format.columnWidth = 45;
  sheet.getRange('B:E').format.columnWidth = 21;
  sheet.getRange('F:F').format.columnWidth = 55;
  sheet.freezePanes.freezeRows(5);
}

function title(sheet, name, subtitle, lastColumn = 'F') {
  const header = sheet.getRange(`A1:${lastColumn}2`);
  header.merge();
  sheet.getRange('A1').values = [[name]];
  header.format.fill = '#242822';
  header.format.font.color = '#ffffff';
  header.format.font.size = 20;
  header.format.font.bold = true;
  sheet.getRange(`A3:${lastColumn}3`).merge();
  sheet.getRange('A3').values = [[subtitle]];
}

function band(sheet, address) {
  const row = sheet.getRange(address);
  row.format.fill = '#ecf7db';
  row.format.font.bold = true;
}

title(model, 'Agentik · Юнит-экономика', 'Пилотная модель · USD в месяц · 26 ноября 2026', 'E');
title(drivers, 'Допущения пилота', 'Синие ячейки редактируются. Все ставки и объёмы сценариев заданы для расчёта.');
title(work, 'Оценка следующих работ', 'Часы и ставка оценочные. В расчёте указана стоимость следующих работ перед коммерческим пилотом.');
model.getRange('A4:B4').values = [['Сценарий 1 / 2 / 3', 2]];
model.getRange('B4').dataValidation = {rule:{type:'whole',operator:'between',formula1:1,formula2:3}};
model.getRange('B4').format.font.color = '#1762ac';
model.getRange('A5').values = [['Выбранный сценарий']];
model.getRange('B5').formulas = [[`=CHOOSE(B4,${caseNames.map(name=>'"'+name+'"').join(',')})`]];

const inputs = [
  ['mau','MAU',1000,10000,30000,'Активные за месяц. Проверить после первого пилота.'],
  ['conversion','Конверсия MAU в PRO',.02,.05,.08,'Подтверждённые покупки после подключения оплаты.'],
  ['webPrice','Web PRO, USD в месяц',12,12,12,'Исходная гипотеза цены для сайта.'],
  ['telegramMix','Доля Telegram среди платящих',.45,.25,.2,'Измерять отдельно от доли визитов Telegram.'],
  ['stars','Telegram PRO, Stars в месяц',500,500,500,'Гипотеза цены. Внутри Telegram цифровой доступ оплачивается в XTR.'],
  ['starNet','Чистая выручка, USD на Star',.018,.02,.022,'Условный курс расчёта. Заменить полученной чистой выручкой на Star.'],
  ['webFee','Издержки веб-платежей',.03,.03,.03,'Условная доля от веб-выручки. В чистой стоимости Star комиссии уже учтены входным параметром.'],
  ['freeUsage','AI-запросов на Free в месяц',1.2,1.6,2,'Допущение для пилота с серверной квотой. Два демосообщения в интерфейсе сами по себе не создают расходов AI.'],
  ['paidUsage','AI-запросов на PRO в месяц',220,120,60,'Собирать медиану и p95 по каждому маршруту модели.'],
  ['tokensIn','Токенов на вход запроса',1000,1000,1000,'Включая контекст. Использовать данные биллинга провайдера.'],
  ['tokensOut','Токенов на выход запроса',1000,1000,1000,'Среднее по успешно обработанным запросам.'],
  ['priceIn','Вход, USD за 1 млн токенов',1,1,1,'Условная смешанная ставка. Заменить ставками выбранных моделей.'],
  ['priceOut','Выход, USD за 1 млн токенов',3,3,3,'Условная смешанная ставка. Заменить ставками выбранных моделей.'],
  ['shares','Новых общих копий на MAU',.3,.75,1.4,'Проверить число созданных копий за месяц и просмотры.'],
  ['shareCost','Создание и просмотры копии, USD',.006,.004,.003,'Средняя переменная стоимость записи, хранения и выдачи одной копии.'],
  ['other','Остальные переменные на MAU, USD',.1,.03,.01,'Поддержка и инфраструктура за вычетом AI и копий.'],
  ['fixed','Постоянные расходы, USD в месяц',300,550,1500,'Хостинг, инструменты и сопровождение.'],
  ['cac','CAC платящего, USD',50,30,15,'Считать по первому подтверждённому платежу.'],
  ['churn','Месячный отток PRO',.12,.08,.05,'Заменить наблюдениями после первого полного периода продления.'],
];

drivers.getRange('A5:F5').values = [['Драйвер','Активный',...caseNames,'Источник или условие']];
band(drivers, 'A5:F5');
const rows = new Map();
inputs.forEach(([key, label, low, base, high, note], index) => {
  const row = index + 6;
  rows.set(key, row);
  drivers.getRange(`A${row}:F${row}`).values = [[label,null,low,base,high,note]];
  drivers.getRange(`B${row}`).formulas = [[`=CHOOSE('Экономика'!$B$4,C${row},D${row},E${row})`]];
});
drivers.getRange('C6:E24').format.font.color = '#1762ac';
drivers.getRange('F6:F24').format.wrapText = true;
drivers.getRange('A6:F24').format.rowHeight = 37;
for (const key of ['conversion','telegramMix','webFee','churn']) {
  const row = rows.get(key);
  drivers.getRange(`B${row}:E${row}`).setNumberFormat('0.0%');
}
for (const key of ['starNet','shareCost']) {
  const row = rows.get(key);
  drivers.getRange(`B${row}:E${row}`).setNumberFormat('$0.000');
}
drivers.getRange('A26:F27').merge();
drivers.getRange('A26').values = [['Правила цифровых платежей Telegram и валюта XTR опубликованы в https://core.telegram.org/bots/payments-stars. Ставки Stars в расчёте являются допущениями.']];
drivers.getRange('A26:F27').format.wrapText = true;

const nextWork = [
  ['Мобильные сценарии и дизайн',32,60],
  ['Синхронизация групп и права',120,60],
  ['Квоты AI и измерение затрат',64,60],
  ['Stars, возвраты и поддержка',48,60],
  ['Проверка Telegram на устройствах',40,60],
  ['Хранение копий и документация',16,60],
  ['Пилот и измерение каналов',32,60],
];
work.getRange('A6:D6').values = [['Работа','Часы','USD/час','Сумма, USD']];
band(work, 'A6:D6');
nextWork.forEach((item, index) => {
  const row = index + 7;
  work.getRange(`A${row}:C${row}`).values = [item];
  work.getRange(`D${row}`).formulas = [[`=B${row}*C${row}`]];
});
work.getRange('A15').values = [['Сумма работ']];
work.getRange('A16:B16').values = [['Резерв',.2]];
work.getRange('A17').values = [['Итого с резервом']];
work.getRange('D15:D17').formulas = [['=SUM(D7:D13)'],['=D15*B16'],['=D15+D16']];
work.getRange('B7:C13').format.font.color = '#1762ac';
work.getRange('B16').setNumberFormat('0%');
work.getRange('C7:D17').setNumberFormat(currency);
band(work,'A17:D17');

const metrics = [
  ['MAU','#,##0', (c,i)=>i('mau')],
  ['Всего платящих','#,##0', (c,i)=>`${c}8*${i('conversion')}`],
  ['Платящих на сайте','#,##0', (c,i)=>`${c}9-${c}11`],
  ['Платящих в Telegram','#,##0', (c,i)=>`${c}9*${i('telegramMix')}`],
  ['Валовая выручка на сайте, USD',currency, (c,i)=>`${c}10*${i('webPrice')}`],
  ['Выручка в Telegram, Stars','#,##0', (c,i)=>`${c}11*${i('stars')}`],
  ['Чистая выручка на сайте, USD',currency, (c,i)=>`${c}12*(1-${i('webFee')})`],
  ['Чистая выручка Telegram, USD',currency, (c,i)=>`${c}13*${i('starNet')}`],
  ['Всего чистой выручки, USD',currency, c=>`${c}14+${c}15`],
  ['AI-запросов за месяц','#,##0', (c,i)=>`(${c}8-${c}9)*${i('freeUsage')}+${c}9*${i('paidUsage')}`],
  ['Переменные расходы AI, USD',currency, (c,i)=>`${c}17*(${i('tokensIn')}*${i('priceIn')}+${i('tokensOut')}*${i('priceOut')})/1000000`],
  ['Общие копии чатов, USD',currency, (c,i)=>`${c}8*${i('shares')}*${i('shareCost')}`],
  ['Остальные переменные, USD',currency, (c,i)=>`${c}8*${i('other')}`],
  ['Все переменные расходы, USD',currency, c=>`SUM(${c}18:${c}20)`],
  ['Вклад на MAU, USD','$0.000', c=>`IF(${c}8>0,(${c}16-${c}21)/${c}8,0)`],
  ['Постоянные расходы, USD',currency, (c,i)=>i('fixed')],
  ['Результат за месяц, USD',currency, c=>`${c}16-${c}21-${c}23`],
  ['Безубыточность, MAU','#,##0', c=>`IF(${c}22>0,ROUNDUP(${c}23/${c}22,0),"Нет")`],
  ['Возврат оценки разработки, мес.','0.0', c=>`IF(${c}24>0,'Разработка'!$D$17/${c}24,"Нет")`],
  ['LTV/CAC с затратами Free','0.00', (c,i)=>`IF(AND(${c}9>0,${c}22>0,${i('churn')}>0,${i('cac')}>0),(${c}16-${c}21)/${c}9/${i('churn')}/${i('cac')},"Нет")`],
];

model.getRange('A7:E7').values = [['Показатель','Активный',...caseNames]];
band(model,'A7:E7');
model.getRange('B7:E7').format.horizontalAlignment = 'center';
model.getRange('B8:E27').format.horizontalAlignment = 'right';
metrics.forEach(([label, format, formula], index) => {
  const row = index + 8;
  model.getRange(`A${row}`).values = [[label]];
  model.getRange(`B${row}:E${row}`).formulas = [['B','C','D','E'].map(column =>
    '=' + formula(column, key=>`'Допущения'!${column}${rows.get(key)}`))];
  model.getRange(`B${row}:E${row}`).setNumberFormat(format);
});
for (const row of [16,21,24,25]) band(model,`A${row}:E${row}`);
model.getRange('A30:E33').merge();
model.getRange('A30').values = [['В демо доступны два сообщения Free и тестовый PRO. Покупки пока отключены. Сценарии показывают экономику после серверных квот и оплаты. Налоги, возвраты и валютные разницы следует добавить по фактическим данным.']];
model.getRange('A30:E33').format.wrapText = true;

await wb.recalculate();
for (const [cell, expected] of [['B13',62500],['B16',5615],['B17',75200],['B21',630.8],['B24',4434.2],['B25',1104]]) {
  const actual = Number(model.getRange(cell).values[0][0]);
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-7) throw new Error(`Unexpected base case at ${cell}`);
}
const output = new URL('../../docs/unit-economics.xlsx', import.meta.url);
const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(fileURLToPath(output));
const qa = new URL('../../artifacts/qa/', import.meta.url);
await mkdir(qa,{recursive:true});
const preview = await wb.render({sheetName:'Экономика',range:'A1:E33',scale:1.5,format:'png'});
await writeFile(new URL('economics.png',qa), new Uint8Array(await preview.arrayBuffer()));
console.log('Workbook exported with six verified base-scenario values.');
