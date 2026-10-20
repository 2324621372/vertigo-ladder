import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const bundle = await build({ entryPoints: ['app.js'], bundle: true, minify: true, write: false, format: 'iife', target: ['es2020'], legalComments: 'inline' });
let html = await readFile('index.html', 'utf8');
html = html.replace(/<link\b[^>]*href="\.\/([^"?]+\.css)"[^>]*>/g, (_, path) => `<style data-source="${path}"></style>`);
for (const match of [...html.matchAll(/<style data-source="([^"]+)"><\/style>/g)]) {
  const css = await readFile(match[1], 'utf8');
  if (/url\(\s*['"]?(?!data:|#)/i.test(css)) throw new Error('External CSS resource must be embedded');
  html = html.replace(match[0], () => `<style>${css}</style>`);
}
const icon = await readFile('icon.svg', 'utf8');
html = html.replace('href="./icon.svg"', `href="data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}"`);
html = html.replace(/<script type="module" src="\.\/app.js"><\/script>/, () => `<script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`);
if (/<(?:script|link)\b[^>]*(?:src|href)="\.\//.test(html)) throw new Error('Unbundled resource');
await mkdir('public', { recursive: true });
await writeFile('public/index.html', html);
await writeFile('public/.nojekyll', '');
console.log(`Single-file game: public/index.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB)`);