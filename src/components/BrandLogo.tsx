import {useEffect, useId, useRef, useState, type KeyboardEvent} from 'react';
import {Check, ChevronDown, Copy, Download} from 'lucide-react';
import logoLightSvg from '/brand/agentik-wordmark-light.svg?raw';
import logoDarkSvg from '/brand/agentik-wordmark-dark.svg?raw';
import {useUi} from '../language';

const logoSources = {light:logoLightSvg, dark:logoDarkSvg};
const pngScales = [1, 2] as const;
type PngScale = typeof pngScales[number];
type PngFile = {scale:PngScale; width:number; height:number; size:number; url:string};

async function rasterizeLogo(source: string, scale: PngScale) {
  const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  const [, , viewWidth, viewHeight] = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number) ?? [];
  const width = Math.round(viewWidth * scale);
  const height = Math.round(viewHeight * scale);
  if (!(width > 0 && height > 0)) throw new Error('Invalid wordmark dimensions');

  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  const markup = new XMLSerializer().serializeToString(svg);
  const svgUrl = URL.createObjectURL(new Blob([markup], {type:'image/svg+xml'}));
  try {
    const image = new Image();
    image.src = svgUrl;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(file => file ? resolve(file) : reject(new Error('PNG encoding failed')), 'image/png');
    });
    return {scale, width, height, blob};
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function copySelectedSvg(source: string) {
  const focused = document.activeElement;
  const selection = document.createElement('textarea');
  selection.value = source;
  selection.readOnly = true;
  selection.tabIndex = -1;
  selection.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.append(selection);
  try {
    selection.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    selection.remove();
    if (focused instanceof HTMLElement) focused.focus({preventScroll:true});
  }
}

export function BrandLogo({background, src}: {background:keyof typeof logoSources; src:string}) {
  const {t} = useUi();
  const caption = useId();
  const source = logoSources[background];
  const [copyState, setCopyState] = useState<'copied' | 'error'>();

  async function copySvg() {
    setCopyState(undefined);
    try {
      await navigator.clipboard.writeText(source);
      setCopyState('copied');
    } catch {
      setCopyState(copySelectedSvg(source) ? 'copied' : 'error');
    }
  }

  return <div className="kit-logo-card" role="group" aria-labelledby={caption}>
    <figure className={`kit-logo kit-logo--${background}`}>
      <img src={src} alt="agentik" width="180" height="48"/>
      <figcaption id={caption}>{background === 'light' ? t('На светлом фоне','Light background') : t('На тёмном фоне','Dark background')}</figcaption>
    </figure>
    <div className="kit-logo-card__actions">
      <button type="button" className="button button--secondary" onClick={() => void copySvg()}>
        {copyState === 'copied' ? <Check size={16} aria-hidden="true"/> : <Copy size={16} aria-hidden="true"/>}
        <span>{t('Копировать SVG','Copy SVG')}</span>
      </button>
      <PngDownload source={source} filename={`agentik-wordmark-${background}`}/>
    </div>
    <p role="status" className={copyState ? 'kit-logo-card__feedback' : 'sr-only'} data-error={copyState === 'error' || undefined}>
      {copyState === 'copied' ? t('SVG скопирован','SVG copied') : copyState === 'error' ? t('Не удалось скопировать SVG','Couldn’t copy SVG') : ''}
    </p>
  </div>;
}

function PngDownload({source, filename}: {source:string; filename:string}) {
  const {t, language} = useUi();
  const control = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const focusLast = useRef(false);
  const menuId = useId();
  const label = t('Скачать PNG','Download PNG');
  const [open, setOpen] = useState(false);
  const [opensAbove, setOpensAbove] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [failed, setFailed] = useState(false);
  const [files, setFiles] = useState<PngFile[]>();

  useEffect(() => {
    if (!generation) return;
    let active = true;
    const urls: string[] = [];
    Promise.all(pngScales.map(scale => rasterizeLogo(source, scale))).then(results => {
      if (!active) return;
      setFiles(results.map(({blob, ...file}) => {
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return {...file, size:blob.size, url};
      }));
    }).catch(() => {if (active) setFailed(true);});
    return () => {
      active = false;
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [generation, source]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !control.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  useEffect(() => {
    if (!open || !menu.current) return;
    const items = menu.current.querySelectorAll('a');
    (items[focusLast.current ? items.length - 1 : 0] ?? menu.current).focus({preventScroll:true});
  }, [open, files]);

  function openMenu(fromEnd = false) {
    const bounds = trigger.current?.getBoundingClientRect();
    const viewportBottom = window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : window.innerHeight;
    setOpensAbove(Boolean(bounds && viewportBottom - bounds.bottom < 120 && bounds.top > 120));
    focusLast.current = fromEnd;
    setOpen(true);
    if (!generation || failed) {
      setFailed(false);
      setGeneration(value => value + 1);
    }
  }

  function closeMenu() {
    setOpen(false);
    trigger.current?.focus({preventScroll:true});
  }

  function menuKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      closeMenu();
      return;
    }
    const items = Array.from(event.currentTarget.querySelectorAll('a'));
    if (!items.length) return;
    const current = items.findIndex(item => item === document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (current + 1) % items.length
        : event.key === 'ArrowUp' ? (current - 1 + items.length) % items.length : -1;
    if (next < 0) return;
    event.preventDefault();
    items[next].focus();
  }

  return <div className="kit-logo-card__png" ref={control} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button type="button" className="button button--secondary" ref={trigger} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}
      onClick={() => open ? closeMenu() : openMenu()}
      onKeyDown={event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        openMenu(event.key === 'ArrowUp');
      }}>
      <span>{label}</span><ChevronDown size={15} aria-hidden="true"/>
    </button>
    <div id={menuId} role="menu" aria-label={label} aria-busy={!files && !failed} hidden={!open} tabIndex={-1}
      className="kit-logo-card__menu" data-above={opensAbove || undefined} ref={menu} onKeyDown={menuKeys}>
      {files ? files.map(file => <a key={file.scale} role="menuitem" tabIndex={-1} href={file.url}
        download={`${filename}@${file.scale}x.png`} onClick={closeMenu}>
        <span><b>{file.scale}×</b><span className="kit-logo-card__metadata">
          {file.width} × {file.height} px · {new Intl.NumberFormat(language).format(file.size)} {t('Б','B')}
        </span></span>
        <Download size={17} aria-hidden="true"/>
      </a>) : <p role="status" className="kit-logo-card__pending">
        {failed ? t('Не удалось подготовить PNG','Couldn’t prepare PNG') : t('Подготовка PNG…','Preparing PNG…')}
      </p>}
    </div>
  </div>;
}
