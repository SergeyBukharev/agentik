import {cp, mkdir, mkdtemp, readdir, realpath, rm, stat} from 'node:fs/promises';
import {resolve, sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'vite';

const root = resolve(import.meta.dirname, '..');
const work = resolve(root, '.private');
const output = resolve(root, 'artifacts/Agentik-Telegram-Mini-App.zip');
await mkdir(work, {recursive: true});
await mkdir(resolve(root, 'artifacts'), {recursive: true});
const stage = await mkdtemp(resolve(work, 'telegram-archive-'));

try {
  // The archive uses one origin for the app and API. Public-site settings belong to its separate build.
  for (const key of ['VITE_ACCESS_PREVIEW_URL','VITE_API_URL','VITE_DEMO_ACCESS','VITE_PRO_CHECKOUT_URL','VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','VITE_SERVICE_ANNOUNCEMENTS']) {
    process.env[key] = '';
  }
  process.env.VITE_TELEGRAM_MINI_APP = 'true';
  await build({root, build: {outDir: resolve(stage, 'dist')}});
  await build({root, configFile: false, publicDir: false, build: {
    ssr: resolve(root, 'server/telegram-mini-app.ts'), outDir: stage, emptyOutDir: false,
    rolldownOptions: {output: {entryFileNames: 'server.mjs'}},
  }});

  for (const item of ['.env.example', 'backend-specs.md', 'design-system/colors.json', '.agents/skills/build-native-app-from-repo']) {
    await cp(resolve(root, item), resolve(stage, item), {recursive: true});
  }
  await cp(resolve(root, 'docs/telegram-mini-app.md'), resolve(stage, 'README-TELEGRAM.md'));
  for (const file of await readdir(resolve(root, 'docs'), {withFileTypes: true})) {
    if (file.isFile() && (/\.(?:md|pdf|pptx|xlsx)$/i.test(file.name) || file.name === 'file-list.txt')) {
      await cp(resolve(root, 'docs', file.name), resolve(stage, 'docs', file.name));
    }
  }

  const archive = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-c',
    'import pathlib, sys, zipfile\nsource=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2], "w", zipfile.ZIP_DEFLATED) as out:\n    for item in sorted(source.rglob("*")):\n        if item.is_file(): out.write(item, item.relative_to(source).as_posix())',
    stage, output], {stdio: 'inherit', windowsHide: true});
  if (archive.error || archive.status !== 0) throw archive.error ?? new Error('ZIP creation failed');
  console.log(`${output} (${(await stat(output)).size} bytes)`);
} finally {
  const absolute = await realpath(stage);
  const parent = await realpath(work);
  if (absolute.startsWith(parent + sep + 'telegram-archive-')) await rm(absolute, {recursive: true, force: true});
}
