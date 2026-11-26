import {readFile, writeFile} from 'node:fs/promises';

const palette = new URL('../design-system/colors.json', import.meta.url);
const target = new URL('../src/colors.generated.css', import.meta.url);
const themes = {
  light: ':root',
  dark: ":root[data-theme='dark']",
};
const colors = JSON.parse(await readFile(palette, 'utf8'));
const tokens = Object.keys(colors.light);
const rules = [];

function validColor(value) {
  if (typeof value !== 'string') return false;
  if (/^#[0-9a-f]{6}$/i.test(value)) return true;
  const channels = /^oklch\((\d+(?:\.\d+)?) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)\)$/.exec(value);
  if (!channels) return false;
  const [lightness, chroma, hue] = channels.slice(1).map(Number);
  return lightness <= 1 && chroma <= 0.4 && hue < 360;
}

for (const [theme, selector] of Object.entries(themes)) {
  const themeColors = colors[theme];
  if (Object.keys(themeColors).length !== tokens.length) {
    throw new Error(`The color token sets do not match for ${theme}.`);
  }

  const declarations = tokens.map(name => {
    const value = themeColors[name];
    if (!/^[a-z][a-z0-9-]*$/.test(name) || !validColor(value)) {
      throw new Error(`Invalid color token ${theme}.${name}.`);
    }
    return `  --${name}: ${value};`;
  });
  rules.push(`${selector} {\n${declarations.join('\n')}\n}`);
}

const css = [
  '/* Generated from design-system/colors.json by node scripts/color-tokens.mjs. */',
  ...rules,
].join('\n\n') + '\n';

if (process.argv.includes('--check')) {
  if ((await readFile(target, 'utf8')).replace(/\r\n/g, '\n') !== css) {
    process.exitCode = 1;
    console.error('Color CSS is out of sync. Run node scripts/color-tokens.mjs.');
  }
} else {
  await writeFile(target, css);
}
