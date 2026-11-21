import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../frontend/', import.meta.url));
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!target.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403); res.end(); return; }
    if (!(await stat(target)).isFile()) throw new Error('Not found');
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Archivo no encontrado'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Villa Horizonte: http://127.0.0.1:${port}`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
