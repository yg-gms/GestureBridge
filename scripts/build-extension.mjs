import { build } from 'vite';
import {
  cp,
  mkdir,
  readFile,
  writeFile,
  stat,
  rm,
  readdir,
} from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import config from '../vite.config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL('../dist-extension/', import.meta.url));
const manifest = JSON.parse(
  await readFile(
    new URL('../extension/manifest.json', import.meta.url),
    'utf8',
  ),
);
await build({
  ...config,
  configFile: false,
  root,
  base: '/',
  publicDir: 'public',
  build: {
    outDir: output,
    emptyOutDir: true,
    minify: false,
    rolldownOptions: {
      input: ['index', 'camera'].map((page) =>
        fileURLToPath(new URL(`../extension/${page}.html`, import.meta.url)),
      ),
    },
  },
});
await writeFile(
  `${output}/manifest.json`,
  JSON.stringify(manifest, null, 2) + '\n',
);
await cp(
  new URL('../extension/background.js', import.meta.url),
  `${output}/background.js`,
);
await cp(
  new URL('../extension/README.md', import.meta.url),
  `${output}/INSTALL.md`,
);
const dependencyPaths = execFileSync(
  'npm',
  ['ls', '--omit=dev', '--all', '--parseable'],
  { cwd: root, encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter((path) => path.includes('/node_modules/'));
dependencyPaths.push(`${root}/node_modules/shadcn`);
const notices = [
  'Third-party software bundled with GestureBridge.\nMediaPipe Tasks Vision declares Apache-2.0; the Apache text is included below.\nHand model source: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task\n',
];
for (const path of new Set(dependencyPaths)) {
  const pkg = JSON.parse(await readFile(`${path}/package.json`, 'utf8'));
  notices.push(
    `\n--- ${pkg.name} ${pkg.version} (${pkg.license || 'see package'}) ---\n`,
  );
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isFile() && /^(licen[sc]e|notice|ofl)(\.|$)/i.test(entry.name))
      notices.push(await readFile(`${path}/${entry.name}`, 'utf8'));
  }
}
await writeFile(`${output}/THIRD_PARTY_NOTICES.txt`, notices.join('\n'));
for (const path of [
  manifest.side_panel.default_path,
  manifest.background.service_worker,
  'extension/camera.html',
  'mediapipe/hand_landmarker.task',
  'mediapipe/wasm/vision_wasm_internal.js',
  'mediapipe/wasm/vision_wasm_internal.wasm',
]) {
  assert.ok(
    (await stat(`${output}/${path}`)).size > 0,
    `Missing packaged resource: ${path}`,
  );
}
assert.equal(
  (await readFile(`${output}/mediapipe/wasm/vision_wasm_internal.wasm`))
    .subarray(0, 4)
    .toString('hex'),
  '0061736d',
);
await mkdir(`${root}/releases`, { recursive: true });
const zip = `${root}/releases/gesturebridge-slides-${manifest.version}.zip`;
// Replacing an existing archive prevents old build entries surviving a rebuild.
await rm(zip, { force: true });
execFileSync('zip', ['-qr', zip, '.'], { cwd: output });
execFileSync('unzip', ['-tq', zip]);
console.log(`Load unpacked: ${output}\nZIP: ${zip}`);
