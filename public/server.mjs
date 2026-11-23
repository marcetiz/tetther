import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

const capturedBounties = [];

function resolveSafePath(urlPath) {
  let clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  if (!clean) clean = 'es/index.html';
  const resolved = path.resolve(__dirname, clean);
  if (resolved !== __dirname && !resolved.startsWith(__dirname + path.sep)) {
    return null;
  }
  return resolved;
}

const server = http.createServer(async (req, res) => {
  const reqUrl = req.url || '/';

  // Optional live transparency refresh with local disk fallback
  if (reqUrl.startsWith('/assets/data/transparency.json') && req.method === 'GET') {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      const upstream = await fetch('https://app.tether.to/transparency.json', { signal: controller.signal });
      clearTimeout(t);
      if (upstream.ok) {
        const text = await upstream.text();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(text);
        return;
      }
    } catch {
      // fall through to local snapshot
    }
  }

  // Optional local Bug Bounty receiver endpoint
  if (reqUrl.startsWith('/api/bounty') && req.method === 'POST') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      capturedBounties.push({ ...body, receivedAt: new Date().toISOString() });
    } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'success', msg: 'Reporte recibido en servidor autónomo.' }));
    return;
  }

  let filePath = resolveSafePath(reqUrl);
  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Ruta inválida');
    return;
  }

  try {
    let stat = await fs.stat(filePath).catch(() => null);
    if (stat && stat.isDirectory()) {
      const qIdx = reqUrl.indexOf('?');
      const pathOnly = qIdx !== -1 ? reqUrl.slice(0, qIdx) : reqUrl;
      const qs = qIdx !== -1 ? reqUrl.slice(qIdx) : '';
      if (pathOnly && !pathOnly.endsWith('/')) {
        res.writeHead(302, { Location: pathOnly + '/' + qs });
        res.end();
        return;
      }
      filePath = path.join(filePath, 'index.html');
      stat = await fs.stat(filePath).catch(() => null);
    }
    if (!stat || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Archivo no encontrado');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const data = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Error interno del servidor');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Proyecto autónomo ejecutándose en http://localhost:${PORT}/es/index.html`);
});
