import {useEffect, useRef} from 'react';
import {ArrowLeft, Download, Moon, Sun} from 'lucide-react';
import palette from '../../design-system/colors.json';
import paletteDownload from '../../design-system/colors.json?url';
import {kitPages, kitPaths, type KitPage} from '../kits';
import {useUi} from '../language';
import {useTheme} from '../useTheme';
import {BrandLogo} from './BrandLogo';
import {UiKitShowcase} from './UiKitShowcase';
import './kit-pages.css';

const base = import.meta.env.BASE_URL;
const mark = base + 'favicon.svg';
const cover = base + 'illustrations/ideas.svg';
const logoLight = base + 'brand/agentik-wordmark-light.svg';
const logoDark = base + 'brand/agentik-wordmark-dark.svg';
const paletteNames = ['brand-lime', 'brand-ink', 'ink', 'muted', 'canvas', 'surface', 'soft', 'line', 'lime-soft', 'focus', 'danger'] as const;

export default function KitPages({page}: {page: KitPage}) {
  const {t} = useUi();
  const {dark, toggleTheme} = useTheme(() => document.documentElement.dataset.theme === 'dark');
  const heading = useRef<HTMLHeadingElement>(null);
  const headingText = t(...kitPages[page]);

  useEffect(() => {
    heading.current?.focus({preventScroll:true});
  }, [page]);

  return <main className="kit-shell">
    <nav className="kit-nav" aria-label={t('Материалы Agentik', 'Agentik kits')}>
      {kitPaths.map(kit => <a key={kit} href={`#/${kit}`} aria-current={page === kit ? 'page' : undefined}>{t(...kitPages[kit])}</a>)}
      <button type="button" className="icon-button kit-theme" aria-label={dark ? t('Светлая тема','Light theme') : t('Тёмная тема','Dark theme')}
        onClick={toggleTheme}>{dark ? <Sun size={19} aria-hidden="true"/> : <Moon size={19} aria-hidden="true"/>}</button>
    </nav>
    <header className="kit-header">
      <h1 tabIndex={-1} ref={heading}>{headingText}</h1>
      <p>{page === 'ui-kit' ? t('Компоненты, которые можно попробовать в обеих темах.', 'Try Agentik components in both themes.')
        : page === 'brand-kit' ? t('Логотип, цвета и правила оформления Agentik.', 'The Agentik logo, colors and design guidelines.')
          : t('Материалы для публикаций, презентаций и обзоров Agentik.', 'Assets for articles, presentations and reviews of Agentik.')}</p>
    </header>
    {page === 'brand-kit' ? <BrandKit dark={dark}/> : page === 'press-kit' ? <PressKit/> : <UiKitShowcase/>}
    <footer className="kit-footer"><a className="button button--secondary" href="#/"><ArrowLeft size={17} aria-hidden="true"/>{t('На главную','Home')}</a></footer>
  </main>;
}

function BrandKit({dark}: {dark: boolean}) {
  const {t} = useUi();
  const colors = dark ? palette.dark : palette.light;
  return <>
    <section className="kit-section" aria-labelledby="kit-brand-logo">
      <h2 id="kit-brand-logo">{t('Логотип','Logo')}</h2>
      <div className="kit-logo-grid">
        <BrandLogo background="light" src={logoLight}/>
        <BrandLogo background="dark" src={logoDark}/>
      </div>
      <ul className="kit-rules">
        <li>{t('Пишите название строчными буквами без точки в логотипе.','Set the wordmark in lowercase without punctuation.')}</li>
        <li>{t('Оставляйте вокруг логотипа поле не меньше четверти высоты знака.','Leave clear space equal to at least a quarter of the mark height.')}</li>
        <li>{t('Используйте знак высотой от 24 px. Для компактных аватаров и иконки сайта подходит отдельный знак.','Keep the mark at least 24 px high. Use it on its own for compact avatars and the site icon.')}</li>
        <li>{t('Сохраняйте пропорции знака и салатовый акцент. Для тёмного фона используйте светлое написание.','Keep the mark’s proportions and lime accent. Use the light wordmark on dark backgrounds.')}</li>
      </ul>
    </section>
    <section className="kit-section" aria-labelledby="kit-brand-colors">
      <h2 id="kit-brand-colors">{t('Палитра','Palette')}</h2>
      <p className="kit-copy">{t('Салатовый связывает знак и ключевые действия. Цвет текста, поверхностей и фокуса выбирается по назначению.', 'Lime connects the mark and primary actions. Text, surfaces and focus each have their own semantic color.')}</p>
      <ul className="kit-swatches">
        {paletteNames.map(name => <li key={name}><span className="kit-swatch" style={{backgroundColor:colors[name]}} aria-hidden="true"/><b>{name}</b><code>{colors[name]}</code></li>)}
      </ul>
      <a className="button button--secondary" href={paletteDownload} download="agentik-colors.json"><Download size={17} aria-hidden="true"/>{t('Скачать палитру JSON','Download palette JSON')}</a>
    </section>
    <section className="kit-section" aria-labelledby="kit-brand-type">
      <h2 id="kit-brand-type">{t('Типографика','Typography')}</h2>
      <div className="kit-type"><b>Manrope</b><p>{t('Заголовки и название продукта','Headings and wordmark')}</p></div>
      <div className="kit-type"><strong>Inter</strong><p>{t('Текст, поля и навигация','Body text, fields and navigation')}</p></div>
    </section>
  </>;
}

function PressKit() {
  const {t} = useUi();
  const releases = [
    {title:t('Скачать знак','Download mark'), href:mark, file:'agentik-mark.svg'},
    {title:t('Логотип для светлого фона','Logo for light backgrounds'), href:logoLight, file:'agentik-wordmark-light.svg'},
    {title:t('Логотип для тёмного фона','Logo for dark backgrounds'), href:logoDark, file:'agentik-wordmark-dark.svg'},
    {title:t('Иллюстрация Agentik','Agentik illustration'), href:cover, file:'agentik-illustration.svg'},
  ];

  return <>
    <section className="kit-press" aria-labelledby="kit-press-summary">
      <div><h2 id="kit-press-summary">{t('О сервисе','About Agentik')}</h2>
        <p>{t('Agentik объединяет AI-помощников для повседневных задач, работы и учёбы. В каталоге можно подобрать помощника по роли, открыть диалог с готовыми подсказками и продолжить разговор из истории.',
          'Agentik brings together AI assistants for daily tasks, work and learning. Pick an assistant by role, start with suggested prompts and pick up the conversation in your history.')}</p>
        <p className="kit-credit">{t('Автор — Сергей Бухарев','Created by Sergey Buharev')} · 2026</p>
      </div>
      <img src={cover} width="320" height="220" alt="" decoding="async"/>
    </section>
    <section className="kit-section" aria-labelledby="kit-press-assets">
      <h2 id="kit-press-assets">{t('Файлы для публикаций','Publication assets')}</h2>
      <ul className="kit-assets">{releases.map(asset => <li key={asset.file}>
        <a href={asset.href} download={asset.file}><span>{asset.title}</span><span className="kit-file">SVG <Download size={17} aria-hidden="true"/></span></a>
      </li>)}</ul>
      <a className="text-link" href="#/brand-kit">{t('Правила использования логотипа','Logo usage guidelines')}</a>
    </section>
  </>;
}
