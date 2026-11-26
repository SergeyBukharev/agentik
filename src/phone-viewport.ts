let phoneZoom = 1;

export function getPhoneZoom() {
  return phoneZoom;
}

export function startPhoneViewport() {
  const phone = window.matchMedia('(any-pointer: coarse) and ((max-device-width: 600px) or ((max-device-width: 1200px) and (max-device-height: 600px)))');
  if (!phone.matches) return;
  const viewport = window.visualViewport;
  if (!viewport || !CSS.supports('zoom', '1')) return;

  const root = document.documentElement;
  let previousWidth = 0;
  let previousScreenWidth = 0;

  const update = () => {
    const width = window.innerWidth;
    const screenWidth = screen.width;
    if (width === previousWidth && screenWidth === previousScreenWidth) return;
    previousWidth = width;
    previousScreenWidth = screenWidth;

    // A wide virtual viewport can be scaled to fit the phone despite the viewport tag.
    // Read the fit scale on layout changes, leaving user pinch zoom alone.
    const fitted = phone.matches && width > 820 && viewport.scale < .85 && Math.abs(viewport.width - width) <= 18;
    phoneZoom = fitted ? 1 / viewport.scale : 1;
    root.toggleAttribute('data-wide-phone-viewport', fitted);
    if (fitted) root.style.setProperty('--phone-zoom', String(phoneZoom));
    else root.style.removeProperty('--phone-zoom');
  };

  update();
  window.addEventListener('resize', update, {passive:true});
}
