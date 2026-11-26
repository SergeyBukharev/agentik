import fs from 'node:fs/promises';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const out=new URL('../../docs/',import.meta.url);await fs.mkdir(out,{recursive:true});
const wb=Workbook.create();const model=wb.worksheets.add('Экономика'),ass=wb.worksheets.add('Допущения'),dev=wb.worksheets.add('Разработка');
for(const s of [model,ass,dev]){s.showGridLines=false;s.getRange('A1:F65').format.font.name='Arial';s.getRange('A1:F65').format.font.size=11;s.getRange('A1:F65').format.rowHeight=23;s.getRange('A:A').format.columnWidth=45;s.getRange('B:E').format.columnWidth=21;s.getRange('F:F').format.columnWidth=50;s.freezePanes.freezeRows(5);}
function title(s,text){s.getRange('A1:F2').merge();s.getRange('A1').values=[[text]];s.getRange('A1:F2').format.fill='#263021';s.getRange('A1:F2').format.font.color='#FFFFFF';s.getRange('A1:F2').format.font.size=21;s.getRange('A1:F2').format.font.bold=true;}
function band(s,range){s.getRange(range).format.fill='#E9F3D7';s.getRange(range).format.font.bold=true;}
title(model,'agentik / Юнит-экономика');title(ass,'Входные допущения');title(dev,'Оценка разработки');
model.getRange('A3:F3').merge();model.getRange('A3').values=[['USD · в месяц · 26.11.2026 · финансовая гипотеза, не прогноз продаж']];
model.getRange('A4:B5').values=[['Сценарий: 1 / 2 / 3',2],['Активный сценарий',null]];
model.getRange('B4').dataValidation={rule:{type:'whole',operator:'between',formula1:1,formula2:3}};
model.getRange('B5').formulas=[['=CHOOSE(B4,"Консервативный","Базовый","Оптимистичный")']];model.getRange('B4').format.font.color='#1762AC';
const drivers=[
 ['MAU, активных пользователей',1000,10000,30000,'Гипотеза размера аудитории; фактических пользователей нет.'],
 ['Конверсия MAU в подписку',.02,.05,.08,'Гипотеза; проверить после пилота.'],
 ['Подписка, USD/мес.',12,12,12,'Гипотеза цены из исходного чата, без налогов.'],
 ['Сообщений на MAU в месяц',200,120,60,'Гипотеза нагрузки; включает бесплатных пользователей.'],
 ['Средний вход, токенов/сообщение',1000,1000,1000,'Включает контекст; измерять фактический биллинг.'],
 ['Средний выход, токенов/сообщение',1000,1000,1000,'Не равно ограничению max_tokens в прототипе.'],
 ['Цена входа, USD/млн токенов',1,1,1,'Условная ставка модели; не актуальный тариф провайдера.'],
 ['Цена выхода, USD/млн токенов',3,3,3,'Условная ставка модели; заменить выбранным тарифом.'],
 ['Прочие переменные на MAU, USD',.10,.03,.01,'Гипотеза инфраструктуры и поддержки.'],
 ['Комиссии от выручки',.03,.03,.03,'Условная комиссия; налоги не включены.'],
 ['Постоянные расходы, USD/мес.',300,550,1500,'Облако, поддержка и инструменты; гипотеза.'],
 ['CAC платящего пользователя, USD',50,30,15,'Гипотеза приобретения подписчика.'],
 ['Месячный отток подписчиков',.12,.08,.05,'Гипотеза; не фактический retention.'],
];
ass.getRange('A3:F3').merge();ass.getRange('A3').values=[['Все значения — редактируемые гипотезы. Активные значения выбраны один раз в колонке B.']];
ass.getRange('A4:F4').values=[['Драйвер','Активный','Консервативный','Базовый','Оптимистичный','Происхождение / ограничения']];band(ass,'A4:F4');
drivers.forEach((d,i)=>{const r=5+i;ass.getRange(`A${r}:F${r}`).values=[[d[0],null,d[1],d[2],d[3],d[4]]];ass.getRange(`B${r}`).formulas=[[`=CHOOSE('Экономика'!$B$4,C${r},D${r},E${r})`]];});
ass.getRange('C5:E17').format.font.color='#1762AC';ass.getRange('F5:F17').format.wrapText=true;ass.getRange('A5:F17').format.rowHeight=46;ass.getRange('B6:E6').setNumberFormat('0.0%');ass.getRange('B14:E14').setNumberFormat('0.0%');ass.getRange('B17:E17').setNumberFormat('0.0%');ass.getRange('B7:E7').setNumberFormat('$0.00');
const items=[['Дизайн и прототип',100,60],['Каталог и сценарии',60,60],['Frontend и кеширование',300,60],['Будущий сервер / мультиплеер',140,60],['QA и доступность',110,60],['Подготовка запуска',40,60],['Документация',16,60]];
dev.getRange('A3:F3').merge();dev.getRange('A3').values=[['Смета коммерческого продукта, не счет за текущую работу. Часы и ставка — допущения.']];
dev.getRange('A6:D6').values=[['Направление','Часы','USD/час','Сумма, USD']];band(dev,'A6:D6');
items.forEach((x,i)=>{const r=7+i;dev.getRange(`A${r}:C${r}`).values=[x];dev.getRange(`D${r}`).formulas=[[`=B${r}*C${r}`]];});
dev.getRange('A15').values=[['Базовая стоимость']];dev.getRange('D15').formulas=[['=SUM(D7:D13)']];dev.getRange('A16:B16').values=[['Резерв бюджета',.2]];dev.getRange('D16').formulas=[['=D15*B16']];dev.getRange('A17').values=[['Итого с резервом']];dev.getRange('D17').formulas=[['=SUM(D15:D16)']];band(dev,'A17:D17');dev.getRange('B16').setNumberFormat('0%');dev.getRange('C7:D17').setNumberFormat('$#,##0');
const labels=['MAU','Платящих пользователей','Валовая выручка, USD','Выручка после комиссий, USD','AI на MAU, USD','Переменные затраты на MAU, USD','Всего переменных затрат, USD','Вклад на MAU, USD','Постоянные затраты, USD','Результат в месяц, USD','Операционная безубыточность, MAU','Разработка с резервом, USD','Возврат разработки, месяцев','LTV/CAC с распределением free-затрат'];
model.getRange('A7:B7').values=[['МЕТРИКА','АКТИВНЫЙ РАСЧЁТ']];band(model,'A7:B7');labels.forEach((l,i)=>model.getRange(`A${8+i}`).values=[[l]]);
const formulas=["='Допущения'!B5","=B8*'Допущения'!B6","=B9*'Допущения'!B7","=B10*(1-'Допущения'!B14)","='Допущения'!B8*('Допущения'!B9*'Допущения'!B11+'Допущения'!B10*'Допущения'!B12)/1000000","=B12+'Допущения'!B13",'=B8*B13','=B11/B8-B13',"='Допущения'!B15",'=B11-B14-B16','=IF(B15>0,ROUNDUP(B16/B15,0),"Нет: отрицательный вклад")',"='Разработка'!D17",'=IF(B17>0,B19/B17,"Нет при этой экономике")',"=IF(B15>0,(B15/'Допущения'!B6)/'Допущения'!B17/'Допущения'!B16,\"Нет: отрицательный вклад\")"];
model.getRange('B8:B21').formulas=formulas.map(f=>[f]);model.getRange('B10:B17').setNumberFormat('$#,##0.000;($#,##0.000);$0.000');model.getRange('B18:B19').setNumberFormat('#,##0');model.getRange('B20:B21').setNumberFormat('0.00');band(model,'A17:B17');
model.getRange('A24:F24').merge();model.getRange('A24').values=[['Снимок сравнения трёх сценариев · пересоздаётся scripts/artifacts/economics.mjs']];band(model,'A24:F24');
model.getRange('A25:D25').values=[['Показатель','Консервативный','Базовый','Оптимистичный']];
const snapshots=[];for(let c=1;c<=3;c++){model.getRange('B4').values=[[c]];await wb.recalculate();snapshots.push([model.getRange('B13').values[0][0],model.getRange('B17').values[0][0],model.getRange('B18').values[0][0],model.getRange('B20').values[0][0]]);}
['Переменные на MAU, USD','Результат в месяц, USD','Безубыточность, MAU','Возврат разработки, месяцев'].forEach((label,i)=>model.getRange(`A${26+i}:D${26+i}`).values=[[label,...snapshots.map(s=>typeof s[i]==='string'?'Нет':s[i])]]);
model.getRange('B26:D27').setNumberFormat('$#,##0.00;($#,##0.00)');model.getRange('B28:D28').setNumberFormat('#,##0');model.getRange('B29:D29').setNumberFormat('0.0');
model.getRange('A32:F35').merge();model.getRange('A32').values=[['Это не финансовая рекомендация. Налоги, валютные ограничения, НДС, возвраты, юридические затраты и сезонность не смоделированы. Платежи в прототипе отсутствуют. LTV/CAC — грубая steady-state оценка с распределением затрат бесплатной аудитории на подписчиков. Изменение входных данных обновляет активный расчёт; снимок сравнения требует повторного запуска builder.']];model.getRange('A32:F35').format.wrapText=true;
model.getRange('B28:D29').format.wrapText=true;model.getRange('B28:D29').format.rowHeight=40;model.getRange('B4').values=[[2]];await wb.recalculate();
const base=model.getRange('B12:B21').values.map(r=>r[0]);if(Math.abs(Number(base[1])-.51)>1e-8||Math.abs(Number(base[5])-170)>1e-6||Number(base[6])!==7639)throw new Error('Base arithmetic verification failed: '+JSON.stringify(base));
const xlsx=await SpreadsheetFile.exportXlsx(wb);await xlsx.save(new URL('unit-economics.xlsx',out).pathname.replace(/^\/([A-Z]:)/,'$1'));
const qa=new URL('../../artifacts/qa/',import.meta.url);await fs.mkdir(qa,{recursive:true});const preview=await wb.render({sheetName:'Экономика',range:'A1:F35',scale:1.5,format:'png'});await fs.writeFile(new URL('economics.png',qa),new Uint8Array(await preview.arrayBuffer()));
console.log((await wb.inspect({kind:'region',sheetId:'Экономика',range:'A8:B21',maxChars:2400,tableMaxRows:14})).ndjson);console.log('Workbook exported; base cost $0.51, result $170, break-even 7639 MAU verified.');
