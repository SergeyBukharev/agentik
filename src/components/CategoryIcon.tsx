import type {CSSProperties} from 'react';

type SymbolSpec = {
  kind: string;
  ink: string;
  tint: string;
  body: string;
  detail: string;
};

const symbols: Record<string, SymbolSpec> = {
  'Все': {
    kind: 'all', ink: '#365322', tint: '#d9edb9',
    body: 'M3.5 3.5h5v5h-5zm8 0h5v5h-5zm-8 8h5v5h-5z',
    detail: 'M11.5 11.5h5v5h-5z',
  },
  'Работа': {
    kind: 'work', ink: '#385278', tint: '#dbe8fb',
    body: 'M2.75 7.25h14.5v9.5H2.75zM6.75 7.25v-3h6.5v3',
    detail: 'M2.75 11.25h14.5M8.5 10.5v2.25h3V10.5',
  },
  'Жизнь': {
    kind: 'life', ink: '#853f53', tint: '#f9dce7',
    body: 'M10 16.5 3.7 10.3C.6 7.2 4.7 2.2 8.3 5.1L10 6.7l1.7-1.6c3.6-2.9 7.7 2.1 4.6 5.2z',
    detail: 'm6 10.2 2.1-.1.9-1.7 1.5 3.4 1.2-1.6H14',
  },
  'Творчество': {
    kind: 'creative', ink: '#684c88', tint: '#ede1fb',
    body: 'M10 2.8c.7 4.8 2.4 6.5 7.2 7.2-4.8.7-6.5 2.4-7.2 7.2C9.3 12.4 7.6 10.7 2.8 10 7.6 9.3 9.3 7.6 10 2.8Z',
    detail: 'M15.3 3.2v3.5m-1.75-1.75h3.5',
  },
  'Обучение': {
    kind: 'learn', ink: '#705821', tint: '#f8eac3',
    body: 'M2.5 5.25c2.75-.8 5.5-.35 7.5 1.25 2-1.6 4.75-2.05 7.5-1.25v9.5c-2.75-.8-5.5-.35-7.5 1.25-2-1.6-4.75-2.05-7.5-1.25z',
    detail: 'M10 6.5V16m-5-7 2 .5m5.5 1 2-.5',
  },
  'Дом': {
    kind: 'home', ink: '#784734', tint: '#fbe3d4',
    body: 'M2.8 9.8 10 3.7l7.2 6.1m-12.3-.7v7.3h10.2V9.1',
    detail: 'M8.25 16.4v-4.9h3.5v4.9',
  },
  'Дизайн': {
    kind: 'design', ink: '#55509a', tint: '#e4e2fb',
    body: 'M4.8 13.9 9 3.4l7.6 7.6-10.5 4.2-2.7 1.4 1.4-2.7ZM8.8 3.8l7.4 7.4',
    detail: 'm4.8 13.9 5.5-5.5m-4.2 6.8 2.3.35',
  },
  'Продукт': {
    kind: 'product', ink: '#295d50', tint: '#d3f0e4',
    body: 'M3.8 3.75v12.5h12.5M7.5 13v-2.5m3.25 2.5V8.25M14 13V5.5',
    detail: 'M6.75 8.5 14 3.75m-3.3.25L14 3.75l-.15 3.25',
  },
  'Мои помощники': {
    kind: 'custom', ink: '#435563', tint: '#ddebf1',
    body: 'M3.75 4h12.5v12h-12.5z',
    detail: 'M10 7v6M7 10h6',
  },
};

export function CategoryIcon({category}: {category: string}) {
  const {kind, ink, tint, body, detail} = Object.hasOwn(symbols, category) ? symbols[category] : symbols['Все'];
  return (
    <span className={`category-icon category-icon--${kind}`} style={{'--category-ink': ink, '--category-tint': tint} as CSSProperties} aria-hidden="true">
      <span className="category-icon__background"/>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
        <path className="category-icon__body" d={body}/>
        <path className="category-icon__detail" d={detail}/>
      </svg>
    </span>
  );
}
