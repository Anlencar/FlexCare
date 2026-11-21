// Servidor local que imita a Vercel (arquivos de /public + rotas da função api/app.js).
// Uso: SETUP_TOKEN=um-codigo-bem-grande npm run dev   → http://localhost:3000
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../api/app.js';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const config = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url)));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function arquivo(p) {
  const limpo = path.normalize(decodeURIComponent(p)).replace(/^(\.\.[/\\])+/, '');
  for (const c of [limpo, limpo + '.html', path.join(limpo, 'index.html')]) {
    const f = path.join(raiz, c);
    if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

function cabecalhos(p) {
  const out = {};
  for (const h of config.headers) {
    const re = new RegExp('^' + h.source.replace('(.*)', '.*') + '$');
    if (re.test(p)) for (const { key, value } of h.headers) out[key] = value;
  }
  delete out['Strict-Transport-Security'];
  return out;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const extra = cabecalhos(p);
  const f = arquivo(p);
  if (f && req.method === 'GET') {
    res.writeHead(200, { ...extra, 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
    return fs.createReadStream(f).pipe(res);
  }
  if (p === '/login') { res.writeHead(302, { Location: '/admin/login' }); return res.end(); }
  if (p.startsWith('/api/') || p === '/admin' || p === '/painel') {
    const orig = res.writeHead.bind(res);
    res.writeHead = (s, h = {}) => orig(s, { ...extra, ...h });
    return handler(req, res);
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
}).listen(process.env.PORT || 3000, () => console.log('FlexCare local em http://localhost:' + (process.env.PORT || 3000)));
