// Ponto de entrada único do back-end na Vercel. Todas as rotas /api/* e /admin passam por aqui.
import { db } from '../lib/db.js';
import { ErroHttp, erro, enviar, enviarBruto, lerJson, checarOrigem } from '../lib/http.js';
import { sessaoAtual, iguais } from '../lib/seguranca.js';
import { carregarTudo, montarCatalogo } from '../lib/catalogo.js';
import * as A from '../lib/rotas-auth.js';
import * as R from '../lib/rotas-admin.js';
import { PAGINA_ADMIN, CSP_ADMIN } from '../lib/pagina-admin.js';

// [método, caminho, função, opções]  — auth: precisa estar logado.
const ROTAS = [
  ['GET', 'catalogo', catalogo, { publica: true }],
  ['GET', 'img/:img', imagem, { publica: true }],
  ['GET', 'admin-page', paginaAdmin, { publica: true }],

  ['GET', 'auth/estado', A.estado, { publica: true }],
  ['POST', 'auth/setup', A.configurar, { publica: true }],
  ['POST', 'auth/login', A.entrar, { publica: true }],
  ['POST', 'auth/logout', A.sair, { publica: true, sessaoOpcional: true }],
  ['GET', 'auth/eu', A.eu],
  ['POST', 'auth/senha', A.trocarSenha],

  ['GET', 'admin/painel', R.painel],
  ['GET', 'admin/produtos', R.listarProdutos],
  ['POST', 'admin/produtos', R.criarProduto],
  ['GET', 'admin/produtos/:id', R.verProduto],
  ['PUT', 'admin/produtos/:id', R.editarProduto],
  ['DELETE', 'admin/produtos/:id', R.excluirProduto],
  ['POST', 'admin/produtos/:id/status', R.alterarStatus],
  ['POST', 'admin/produtos/:id/destaque', R.alterarDestaque],
  ['PUT', 'admin/produtos/:id/promocoes/:tema', R.salvarPromocao],
  ['GET', 'admin/campanhas', R.listarCampanhas],
  ['PUT', 'admin/tema', R.alterarModoTema],
  ['PUT', 'admin/campanhas/:id', R.editarCampanha],
  ['PUT', 'admin/campanhas/:id/produtos', R.participantesCampanha],
  ['POST', 'admin/imagens', R.enviarImagem],
  ['GET', 'admin/usuarios', R.listarUsuarios],
  ['POST', 'admin/usuarios', R.criarUsuario],
  ['PUT', 'admin/usuarios/:id', R.editarUsuario],
  ['POST', 'admin/usuarios/:id/senha', R.redefinirSenha],
  ['GET', 'admin/historico', R.historico],
].map(([metodo, caminho, fn, op = {}]) => {
  const nomes = [];
  const re = new RegExp('^' + caminho.split('/').map((s) => (s.startsWith(':') ? (nomes.push(s.slice(1)), '([A-Za-z0-9_-]{1,64})') : s)).join('/') + '$');
  return { metodo, re, nomes, fn, op };
});

function descobrirRota(req) {
  const url = new URL(req.url, 'http://x');
  let rota = url.searchParams.get('route');
  if (rota === null) {
    const p = url.pathname.replace(/\/+$/, '');
    rota = ['/admin', '/painel'].includes(p) ? 'admin-page' : p.replace(/^\/api\//, '');
  }
  url.searchParams.delete('route');
  return { rota: rota.replace(/^\/+|\/+$/g, ''), query: url.searchParams };
}

export default async function handler(req, res) {
  try {
    const { rota, query } = descobrirRota(req);
    const metodo = req.method === 'HEAD' ? 'GET' : req.method;
    let achou = null, metodoErrado = false;
    for (const r of ROTAS) {
      const m = r.re.exec(rota);
      if (!m) continue;
      if (r.metodo !== metodo) { metodoErrado = true; continue; }
      achou = { ...r, params: Object.fromEntries(r.nomes.map((n, i) => [n, m[i + 1]])) };
      break;
    }
    if (!achou) throw erro(metodoErrado ? 405 : 404, metodoErrado ? 'Método não permitido.' : 'Rota não encontrada.');

    const banco = await db();
    const mutacao = metodo !== 'GET';
    if (mutacao) checarOrigem(req); // bloqueia formulários e scripts de outros sites

    let sessao = null;
    if (!achou.op.publica || achou.op.sessaoOpcional) {
      sessao = await sessaoAtual(banco, req);
      if (!sessao && !achou.op.sessaoOpcional) throw erro(401, 'Sua sessão expirou. Entre novamente.');
      // Proteção CSRF extra: toda alteração precisa do token da sessão no cabeçalho.
      if (sessao && mutacao && !iguais(req.headers['x-csrf-token'] || '', sessao.csrf)) throw erro(403, 'Token de segurança inválido. Recarregue a página.');
    }
    const corpo = mutacao ? await lerJson(req) : {};
    await achou.fn({ db: banco, req, res, sessao, corpo, params: achou.params, query });
  } catch (e) {
    if (res.headersSent) return;
    if (e instanceof ErroHttp) return enviar(res, e.status, { erro: e.message, ...(e.extra || {}) });
    console.error('[erro interno]', e);
    enviar(res, 500, { erro: 'Erro interno. Tente novamente em instantes.' });
  }
}

// ---------- Rotas públicas ----------
async function catalogo({ db, res }) {
  const dados = await carregarTudo(db);
  enviar(res, 200, montarCatalogo(dados), {
    'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=60',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
}

async function imagem({ db, res, params }) {
  if (!/^img_[A-Za-z0-9_-]{16}$/.test(params.img)) throw erro(404, 'Imagem não encontrada.');
  const r = await db.query(`SELECT mime, dados FROM imagens WHERE id = $1`, [params.img]);
  if (!r.length) throw erro(404, 'Imagem não encontrada.');
  enviarBruto(res, 200, Buffer.from(r[0].dados, 'base64'), {
    'Content-Type': r[0].mime,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Content-Disposition': 'inline',
  });
}

// O HTML do painel só é entregue para quem está logado. Sem sessão → tela de login.
async function paginaAdmin({ db, req, res }) {
  const sessao = await sessaoAtual(db, req);
  if (!sessao) {
    res.writeHead(302, { Location: '/admin/login', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    return res.end();
  }
  enviarBruto(res, 200, PAGINA_ADMIN, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': CSP_ADMIN,
    'X-Robots-Tag': 'noindex, nofollow',
  });
}
