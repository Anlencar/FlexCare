// Utilitários HTTP: respostas, leitura segura do corpo, cookies e cabeçalhos de segurança.

export class ErroHttp extends Error {
  constructor(status, mensagem, extra) { super(mensagem); this.status = status; this.extra = extra; }
}
export const erro = (status, mensagem, extra) => new ErroHttp(status, mensagem, extra);

const CABECALHOS_BASE = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export function enviar(res, status, corpo, cabecalhos = {}) {
  const json = JSON.stringify(corpo);
  res.writeHead(status, {
    ...CABECALHOS_BASE,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...cabecalhos,
  });
  res.end(json);
}

export function enviarBruto(res, status, corpo, cabecalhos) {
  res.writeHead(status, { ...CABECALHOS_BASE, ...cabecalhos });
  res.end(corpo);
}

const LIMITE_CORPO = 4 * 1024 * 1024; // 4 MB (a Vercel corta em 4,5 MB)

export async function lerJson(req) {
  const tipo = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (tipo !== 'application/json') throw erro(415, 'Envie os dados em JSON.');
  let bruto;
  // Na Vercel o corpo pode já vir lido em req.body.
  let jaLido;
  try { jaLido = req.body; } catch { throw erro(400, 'JSON inválido.'); }
  if (jaLido !== undefined && jaLido !== null) {
    if (typeof jaLido === 'object' && !Buffer.isBuffer(jaLido)) return jaLido;
    bruto = Buffer.isBuffer(jaLido) ? jaLido.toString('utf8') : String(jaLido);
  } else {
    const partes = []; let total = 0;
    for await (const c of req) {
      total += c.length;
      if (total > LIMITE_CORPO) throw erro(413, 'Arquivo ou dados grandes demais.');
      partes.push(c);
    }
    bruto = Buffer.concat(partes).toString('utf8');
  }
  if (bruto.length > LIMITE_CORPO) throw erro(413, 'Arquivo ou dados grandes demais.');
  if (!bruto) return {};
  try {
    const v = JSON.parse(bruto);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw 0;
    return v;
  } catch { throw erro(400, 'JSON inválido.'); }
}

export function lerCookies(req) {
  const out = {};
  for (const parte of String(req.headers.cookie || '').split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    const k = parte.slice(0, i).trim();
    if (k && !(k in out)) { try { out[k] = decodeURIComponent(parte.slice(i + 1).trim()); } catch { /* ignora */ } }
  }
  return out;
}

export function ehHttps(req) {
  return process.env.VERCEL === '1' || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

export function ipDe(req) {
  return String(req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || '?').trim().slice(0, 64);
}

// Bloqueia requisições de outros sites (CSRF): o Origin precisa ser o próprio domínio.
export function checarOrigem(req) {
  const origem = req.headers.origin;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  if (!origem || !host) throw erro(403, 'Origem da requisição não permitida.');
  let o;
  try { o = new URL(origem); } catch { throw erro(403, 'Origem da requisição não permitida.'); }
  if (o.host.toLowerCase() !== host) throw erro(403, 'Origem da requisição não permitida.');
}
