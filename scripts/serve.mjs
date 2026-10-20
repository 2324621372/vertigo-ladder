import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT || 4174);
http.createServer(async (req, res) => {
  try { const pathname = new URL(req.url, 'http://localhost').pathname; const path = resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname)); if (!path.startsWith(root + sep)) throw new Error('Forbidden'); const content = await readFile(path); res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(content); }
  catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`Vertigo: http://localhost:${port}`));