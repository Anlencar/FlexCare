// Painel administrativo FlexCare.
// Segurança no navegador: todo texto vindo do servidor entra na tela via textContent (nunca innerHTML),
// toda alteração manda o token CSRF da sessão, e o servidor confere permissão em cada requisição.

const S = { usuario: null, csrf: null, permissoes: {}, sujo: false };
const TEMAS = [
  { id: 'normal', nome: 'Normal', emoji: '🛍️' },
  { id: 'natal', nome: 'Natal', emoji: '🎄' },
  { id: 'blackfriday', nome: 'Black Friday', emoji: '🏷️' },
];
const NOME_TEMA = Object.fromEntries(TEMAS.map((t) => [t.id, t.nome]));
const MULTICOR = 'conic-gradient(#e74c3c 0 25%,#f1c40f 0 50%,#2ecc71 0 75%,#9b59b6 0)';

// ---------------------------------------------------------------- utilidades de DOM
function h(tag, props, ...filhos) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'multiple' || k === 'required') el[k] = !!v;
      else if (k === 'style') for (const [sk, sv] of Object.entries(v)) el.style.setProperty(sk, sv);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  adicionar(el, filhos);
  return el;
}
function adicionar(el, filhos) {
  for (const f of filhos.flat(Infinity)) {
    if (f === null || f === undefined || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
}

const ICONES = {
  painel: ['M3 3h8v10H3z', 'M13 3h8v6h-8z', 'M13 11h8v10h-8z', 'M3 15h8v6H3z'],
  produtos: ['M21 8 12 3 3 8v8l9 5 9-5z', 'M3 8l9 5 9-5', 'M12 13v8'],
  promo: ['M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z', 'M7.5 7.5h.01'],
  temas: ['M12 3a9 9 0 1 0 9 9c0-1.1-.9-2-2-2h-2.5a2.5 2.5 0 0 1 0-5H18A9 9 0 0 0 12 3z', 'M7.5 10.5h.01', 'M10.5 7h.01'],
  func: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  hist: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5', 'M12 7v5l3 2'],
  conta: ['M12 15a7 7 0 0 0-7 6h14a7 7 0 0 0-7-6z', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  sair: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  menu: ['M3 6h18', 'M3 12h18', 'M3 18h18'],
  mais: ['M12 5v14', 'M5 12h14'],
  editar: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z'],
  lixo: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6'],
  estrela: ['M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z'],
  busca: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-3.5-3.5'],
  foto: ['M4 5h16v14H4z', 'M4 15l4-4 4 4 3-3 5 5', 'M15 9h.01'],
  upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M4 20h16'],
  link: ['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7'],
  trocar: ['M17 1l4 4-4 4', 'M3 11V9a4 4 0 0 1 4-4h14', 'M7 23l-4-4 4-4', 'M21 13v2a4 4 0 0 1-4 4H3'],
  principal: ['M5 12l5 5L20 7'],
  externo: ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14 21 3'],
  chave: ['M15 7a4 4 0 1 1-3.9 5H3v4h3v-2h2v2h3', 'M16 7h.01'],
  olho: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  esq: ['M15 18l-6-6 6-6'],
  ok: ['M20 6 9 17l-5-5'],
  off: ['M12 2v10', 'M18.4 6.6a9 9 0 1 1-12.8 0'],
  caixa: ['M3 7h18v13H3z', 'M3 7l2-4h14l2 4', 'M9 11h6'],
  check: ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  tag2: ['M4 4h7l9 9-7 7-9-9z'],
};
function icone(nome) {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  for (const d of ICONES[nome] || []) { const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); s.append(p); }
  return s;
}

// ---------------------------------------------------------------- formatação
const fmtReais = (c) => 'R$ ' + (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const centsParaTexto = (c) => (c === null || c === undefined || c === '' ? '' : (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }));
function textoParaCents(t) {
  let s = String(t).trim().replace(/\s|R\$/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100);
}
const fmtData = (ms) => (ms ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ms) : '—');
const fmtDia = (ms) => (ms ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short' }).format(ms) : '—');
function relativo(ms) {
  if (!ms) return 'nunca';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'agora mesmo';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `há ${Math.floor(s / 86400)} dia${s >= 172800 ? 's' : ''}`;
  return fmtData(ms);
}
// datetime-local sempre no horário de Brasília (UTC-3)
const OFFSET = 3 * 3600 * 1000;
function msParaInput(ms) {
  if (!ms) return '';
  const d = new Date(ms - OFFSET);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
function inputParaMs(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v || '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + OFFSET : null;
}
function precoFinal(preco, promo) {
  if (!promo || !preco) return null;
  const f = promo.tipo === 'percentual' ? Math.round(preco * (100 - promo.valor) / 100) : promo.valor;
  return f > 0 && f < preco ? { final: f, pct: Math.round((1 - f / preco) * 100) } : null;
}
const urlSegura = (u) => { try { const x = new URL(u, location.href); return x.protocol === 'https:' || x.origin === location.origin ? x.href : ''; } catch { return ''; } };
const pode = (p) => S.usuario && (S.usuario.papel === 'admin' || (p !== 'funcionarios' && S.usuario.permissoes.includes(p)));

// ---------------------------------------------------------------- API
async function api(metodo, caminho, corpo) {
  const op = { method: metodo, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (corpo !== undefined) {
    op.headers['Content-Type'] = 'application/json';
    op.body = JSON.stringify(corpo);
  }
  if (metodo !== 'GET') op.headers['X-CSRF-Token'] = S.csrf || '';
  let r;
  try { r = await fetch('/api/' + caminho, op); } catch { throw new Error('Sem conexão com o servidor. Verifique a internet.'); }
  let dados = {};
  try { dados = await r.json(); } catch { /* vazio */ }
  if (r.status === 401) { S.sujo = false; location.replace('/admin/login?expirou=1'); throw new Error('Sessão expirada.'); }
  if (!r.ok) { const e = new Error(dados.erro || 'Algo deu errado. Tente novamente.'); e.status = r.status; throw e; }
  return dados;
}

// ---------------------------------------------------------------- avisos e modais
let caixaToasts;
function toast(msg, tipo = 'ok') {
  caixaToasts ||= document.body.appendChild(h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }));
  const t = h('div', { class: 'toast ' + tipo, text: msg });
  caixaToasts.append(t);
  setTimeout(() => t.remove(), tipo === 'erro' ? 6000 : 3500);
}
const falha = (e) => toast(e.message || String(e), 'erro');

function modal({ titulo, corpo, botoes, largo }) {
  return new Promise((resolver) => {
    const anterior = document.activeElement;
    const fechar = (v) => { fundo.remove(); document.removeEventListener('keydown', tecla); anterior?.focus?.(); resolver(v); };
    const tecla = (e) => { if (e.key === 'Escape') fechar(null); };
    const rodape = h('footer');
    const caixa = h('div', { class: 'modal' + (largo ? ' largo' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
      h('header', null, h('h2', { text: titulo }), h('button', { class: 'btn ghost icone', type: 'button', 'aria-label': 'Fechar', onclick: () => fechar(null) }, icone('x'))),
      h('div', { class: 'corpo' }, corpo), rodape);
    for (const b of botoes) {
      const bt = h('button', { class: 'btn ' + (b.classe || ''), type: 'button', text: b.texto });
      bt.addEventListener('click', async () => {
        if (!b.acao) return fechar(b.valor ?? null);
        bt.disabled = true;
        try { const v = await b.acao(); if (v !== false) fechar(v ?? true); } catch (e) { falha(e); } finally { bt.disabled = false; }
      });
      rodape.append(bt);
    }
    const fundo = h('div', { class: 'modal-fundo', onmousedown: (e) => { if (e.target === fundo) fechar(null); } }, caixa);
    document.body.append(fundo);
    document.addEventListener('keydown', tecla);
    (caixa.querySelector('.corpo input, .corpo select, .corpo textarea') || rodape.lastChild).focus();
  });
}
const confirmar = (titulo, texto, { botao = 'Confirmar', perigo = false } = {}) => modal({
  titulo, corpo: h('p', { class: 'mudo', text: texto }),
  botoes: [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: botao, classe: perigo ? 'perigo' : '', valor: true }],
});

// ---------------------------------------------------------------- componentes de formulário
let seq = 0;
function campo(rotulo, entrada, ajuda) {
  const alvo = entrada.matches('input,select,textarea') ? entrada : entrada.querySelector('input,select,textarea') || entrada;
  const id = alvo.id || (alvo.id = 'c' + (++seq));
  return h('div', { class: 'campo' }, h('label', { for: id, text: rotulo }), entrada, ajuda ? h('span', { class: 'ajuda', text: ajuda }) : null);
}
const interruptor = (rotulo, checked, onchange, disabled) => h('label', { class: 'sw' },
  h('input', { type: 'checkbox', checked, disabled, onchange: (e) => onchange(e.target.checked, e) }), h('i'), rotulo ? h('span', { text: rotulo }) : null);
function entradaMoeda(valorCents, oninput, props = {}) {
  const i = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: centsParaTexto(valorCents), placeholder: '0,00', maxlength: 12, ...props });
  i.addEventListener('input', () => oninput(textoParaCents(i.value), i));
  return h('div', { class: 'moeda' }, h('span', { text: 'R$' }), i);
}
function thumb(url, icone_) {
  const t = h('div', { class: 'thumb' });
  const u = url ? urlSegura(url) : '';
  if (u) {
    const img = h('img', { src: u, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
    img.onerror = () => { t.classList.add('vazio-t'); t.replaceChildren(icone_ || '📦'); };
    t.append(img);
  } else { t.classList.add('vazio-t'); t.append(icone_ || '📦'); }
  return t;
}
function carregando() { return h('div', { class: 'linha centro-carga' }, h('div', { class: 'spinner' })); }

// ---------------------------------------------------------------- estrutura
const NAV = [
  { rota: '', nome: 'Painel', icone: 'painel' },
  { rota: 'produtos', nome: 'Produtos', icone: 'produtos' },
  { rota: 'promocoes', nome: 'Promoções', icone: 'promo' },
  { rota: 'temas', nome: 'Temas e campanhas', icone: 'temas' },
  { grupo: 'Equipe' },
  { rota: 'funcionarios', nome: 'Funcionários', icone: 'func', perm: 'funcionarios' },
  { rota: 'historico', nome: 'Histórico', icone: 'hist' },
  { rota: 'conta', nome: 'Minha conta', icone: 'conta' },
];
let E = {}; // elementos fixos

function montarLayout() {
  const nav = h('nav', { class: 'nav', 'aria-label': 'Menu do painel' });
  for (const n of NAV) {
    if (n.grupo) { nav.append(h('div', { class: 'grupo', text: n.grupo })); continue; }
    if (n.perm && !pode(n.perm)) continue;
    nav.append(h('a', { href: '#/' + n.rota, 'data-rota': n.rota, onclick: fecharMenu }, icone(n.icone), h('span', { text: n.nome })));
  }
  const iniciais = S.usuario.nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  E.side = h('aside', { class: 'side' },
    h('div', { class: 'marca' }, h('img', { src: '/assets/logo.png', alt: '' }), h('div', null, 'Flex', h('span', { text: 'Care' }), h('small', { text: 'Painel' }))),
    nav,
    h('div', { class: 'rodape' },
      h('div', { class: 'quem' }, h('div', { class: 'avatar', text: iniciais }), h('div', null, h('b', { text: S.usuario.nome }), h('span', { text: S.usuario.papel === 'admin' ? 'Administrador' : 'Funcionário' }))),
      h('button', { class: 'btn sec', type: 'button', onclick: sair }, icone('sair'), 'Sair da conta')));
  E.fundo = h('div', { class: 'fundo-menu', onclick: fecharMenu });
  E.titulo = h('h1');
  E.conteudo = h('div', { class: 'conteudo', id: 'conteudo', tabindex: '-1' });
  const topo = h('header', { class: 'topo' },
    h('button', { class: 'btn sec icone menu-btn', type: 'button', 'aria-label': 'Abrir menu', onclick: () => { E.side.classList.add('aberto'); E.fundo.classList.add('aberto'); } }, icone('menu')),
    E.titulo,
    h('a', { class: 'ver-loja', href: '/', target: '_blank', rel: 'noopener' }, icone('externo'), h('span', { class: 'txt', text: 'Ver loja' })));
  const app = document.getElementById('app');
  app.className = 'layout';
  app.replaceChildren(E.side, E.fundo, h('main', { class: 'main' }, topo, E.conteudo));
}
function fecharMenu() { E.side.classList.remove('aberto'); E.fundo.classList.remove('aberto'); }

async function sair() {
  if (S.sujo && !(await confirmar('Sair do painel?', 'Há alterações não salvas que serão perdidas.', { botao: 'Sair mesmo assim', perigo: true }))) return;
  try { await api('POST', 'auth/logout', {}); } catch { /* sai de qualquer jeito */ }
  S.sujo = false;
  location.replace('/admin/login?saiu=1');
}

// ---------------------------------------------------------------- rotas
const PAGINAS = [
  [/^$/, paginaPainel],
  [/^produtos$/, paginaProdutos],
  [/^produtos\/novo$/, () => paginaProduto(null)],
  [/^produtos\/(prd_[A-Za-z0-9_-]+)$/, (m) => paginaProduto(m[1])],
  [/^promocoes$/, paginaPromocoes],
  [/^temas$/, paginaTemas],
  [/^funcionarios$/, paginaFuncionarios],
  [/^historico$/, paginaHistorico],
  [/^conta$/, paginaConta],
];
let rotaAtual = null;
let renderId = 0;

async function navegar() {
  const rota = location.hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (S.sujo && rotaAtual !== null && rota !== rotaAtual) {
    const ok = await confirmar('Sair sem salvar?', 'Você tem alterações não salvas neste produto.', { botao: 'Descartar alterações', perigo: true });
    if (!ok) { history.replaceState(null, '', '#/' + rotaAtual); return; }
    S.sujo = false;
  }
  rotaAtual = rota;
  const base = rota.split('/')[0];
  E.side.querySelectorAll('.nav a').forEach((a) => { if (a.dataset.rota === base) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const id = ++renderId;
  E.conteudo.replaceChildren(carregando());
  const achou = PAGINAS.find(([re]) => re.test(rota));
  if (!achou) { titulo('Página não encontrada'); E.conteudo.replaceChildren(h('div', { class: 'vazio', text: 'Página não encontrada.' })); return; }
  try {
    const no = await achou[1](achou[0].exec(rota));
    if (id === renderId && no) { E.conteudo.replaceChildren(no); E.conteudo.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  } catch (e) {
    if (id !== renderId) return;
    E.conteudo.replaceChildren(h('div', { class: 'aviso erro', role: 'alert' }, e.message || 'Erro ao carregar.'));
  }
}
const titulo = (t) => { E.titulo.textContent = t; document.title = t + ' | Painel FlexCare'; };

// ================================================================= PAINEL
const ICONE_ACAO = (a) => a.startsWith('produto_excluido') ? ['mal', '🗑️'] : a.startsWith('produto') || a === 'preco_alterado' || a === 'destaque_alterado' ? ['produto', '📦']
  : a.startsWith('promocao') ? ['promo', '🏷️'] : a.startsWith('tema') || a.startsWith('campanha') ? ['tema', '🎨']
    : a.startsWith('funcionario') || a.startsWith('senha') ? ['func', '👤'] : a === 'login' ? ['', '🔑'] : ['', '•'];
function itemHistorico(x) {
  const [cls, emo] = ICONE_ACAO(x.acao);
  return h('li', null, h('div', { class: 'ic ' + cls, text: emo }),
    h('div', { class: 'txt' }, h('b', { text: x.resumo }), h('span', { text: `${x.usuario_nome || 'Sistema'} · ${relativo(x.quando)}`, title: fmtData(x.quando) })));
}

async function paginaPainel() {
  titulo('Painel');
  const d = await api('GET', 'admin/painel');
  const stat = (cls, ic, rot, num, det) => h('div', { class: 'stat ' + cls }, h('div', { class: 'rot' }, h('i', null, icone(ic)), rot), h('div', { class: 'num', text: num }), h('div', { class: 'det', text: det }));
  const t = d.totais;
  const temaInfo = TEMAS.find((x) => x.id === d.tema.id) || TEMAS[0];
  const maxCat = Math.max(1, ...d.categorias.map((c) => c.qtd));
  return h('div', null,
    h('div', { class: 'stats' },
      stat('', 'produtos', 'Produtos cadastrados', t.produtos, `${t.destaques} em destaque`),
      stat('ok', 'ok', 'Ativos', t.ativos, 'aparecendo na loja'),
      stat('off', 'off', 'Desativados', t.inativos, 'escondidos da loja'),
      stat('promo', 'promo', 'Em promoção', t.emPromocao, `${t.emPromocaoAgora} com preço promocional agora`),
      stat('roxo', 'tag2', 'Categorias', t.categorias, d.ultimaAlteracao ? `última alteração ${relativo(d.ultimaAlteracao.quando)}` : '')),
    h('div', { class: 'painel-grade' },
      h('section', { class: 'card' },
        h('div', { class: 'linha entre' }, h('h2', { text: 'Últimas alterações' }), h('a', { class: 'btn ghost peq', href: '#/historico', text: 'Ver tudo' })),
        d.historico.length ? h('ul', { class: 'hist' }, d.historico.map(itemHistorico)) : h('p', { class: 'mudo', text: 'Nenhuma alteração ainda.' })),
      h('div', { class: 'pilha' },
        h('section', { class: 'card' },
          h('h2', { text: 'Tema da loja' }),
          h('p', { class: 'sub', text: d.tema.modo === 'auto' ? 'Automático, pelas datas das campanhas' : 'Escolhido manualmente' }),
          h('div', { class: 'tema-atual' }, h('div', { class: 'bola ' + temaInfo.id, text: temaInfo.emoji }),
            h('div', null, h('b', { text: 'Agora: ' + temaInfo.nome }), h('div', { class: 'mini', text: d.tema.fim && d.tema.id !== 'normal' ? 'até ' + fmtData(d.tema.fim - 1) : 'tema padrão' }))),
          h('div', { class: 'barras' }, d.campanhas.filter((c) => c.id !== 'normal').map((c) => h('div', { class: 'linha entre mini' },
            h('span', { text: `${NOME_TEMA[c.id]}: ${fmtDia(c.inicio)} → ${fmtDia(c.fim - 1)}` }), h('span', { class: 'tag ' + (c.ativo ? 'ok' : 'off'), text: c.ativo ? 'ligada' : 'desligada' })))),
          pode('temas') ? h('a', { class: 'btn sec peq', href: '#/temas', style: { 'margin-top': '14px' }, text: 'Gerenciar temas' }) : null),
        h('section', { class: 'card' },
          h('h2', { text: 'Produtos por categoria' }), h('p', { class: 'sub', text: `${t.categorias} categorias` }),
          h('div', { class: 'barras' }, d.categorias.map((c) => h('div', { class: 'barra' },
            h('div', { class: 'topo-b' }, h('span', { text: c.nome }), h('b', { text: c.qtd })),
            h('div', { class: 'trilho' }, h('i', { style: { width: (c.qtd / maxCat * 100) + '%' } })))))))));
}

// ================================================================= PRODUTOS (lista)
const filtrosProdutos = { q: '', categoria: '', status: '' };

async function paginaProdutos() {
  titulo('Produtos');
  const d = await api('GET', 'admin/produtos');
  const lista = d.produtos;
  const contagem = h('p', { class: 'contagem' });
  const corpo = h('tbody');
  const temaAtual = d.temaAtual;

  const busca = h('input', { type: 'search', placeholder: 'Buscar por nome ou ID…', value: filtrosProdutos.q, 'aria-label': 'Buscar produtos', maxlength: 80 });
  const selCat = h('select', { 'aria-label': 'Filtrar por categoria' }, h('option', { value: '', text: 'Todas as categorias' }), d.categorias.map((c) => h('option', { value: c, text: c, selected: c === filtrosProdutos.categoria })));
  const selStatus = h('select', { 'aria-label': 'Filtrar por status' },
    [['', 'Todos os status'], ['ativo', 'Ativos'], ['inativo', 'Desativados'], ['promo', 'Em promoção'], ['destaque', 'Em destaque']]
      .map(([v, t]) => h('option', { value: v, text: t, selected: v === filtrosProdutos.status })));

  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const temPromo = (p) => Object.values(p.promocoes).some((x) => x.ativo);

  function linha(p) {
    const pr = p.precos[temaAtual];
    const status = interruptor(null, p.ativo, async (v, e) => {
      e.target.disabled = true;
      try { await api('POST', `admin/produtos/${p.id}/status`, { ativo: v }); p.ativo = v; toast(v ? 'Produto ativado — já aparece na loja.' : 'Produto desativado — saiu da loja.'); desenhar(); }
      catch (err) { e.target.checked = !v; falha(err); } finally { e.target.disabled = false; }
    }, !pode('produtos'));
    status.setAttribute('aria-label', p.ativo ? 'Desativar produto' : 'Ativar produto');
    const estrela = h('button', { class: 'estrela', type: 'button', 'aria-pressed': p.destaque > 0 ? 'true' : 'false', title: p.destaque > 0 ? 'Tirar do destaque' : 'Colocar em destaque', 'aria-label': 'Destaque', disabled: !pode('produtos') }, icone('estrela'));
    estrela.addEventListener('click', async () => {
      estrela.disabled = true;
      try { const v = !(p.destaque > 0); await api('POST', `admin/produtos/${p.id}/destaque`, { destaque: v }); p.destaque = v ? 999 : 0; toast(v ? 'Produto em destaque.' : 'Produto tirado do destaque.'); desenhar(); }
      catch (err) { falha(err); } finally { estrela.disabled = false; }
    });
    return h('tr', null,
      h('td', { class: 'cheio' }, h('a', { class: 'prod', href: '#/produtos/' + p.id, style: { 'text-decoration': 'none' } }, thumb(p.imagens[0], p.icone),
        h('div', null, h('b', { text: p.nome }), h('code', { text: p.id })))),
      h('td', { 'data-rot': 'Categoria' }, h('span', { class: 'tag', text: p.categoria })),
      h('td', { 'data-rot': 'Preço', class: 'preco-col' }, h('div', null,
        pr.pct ? h('s', { text: fmtReais(pr.original) }) : null, h('b', { text: fmtReais(pr.final) }),
        pr.pct ? h('span', { class: 'tag promo', style: { 'margin-left': '6px' }, text: '-' + pr.pct + '%' }) : null)),
      h('td', { 'data-rot': 'Situação' }, h('div', { class: 'linha' }, h('span', { class: 'tag ' + (p.ativo ? 'ok' : 'off'), text: p.ativo ? 'Ativo' : 'Desativado' }),
        temPromo(p) ? h('span', { class: 'tag promo', text: 'Promoção' }) : null)),
      h('td', { 'data-rot': 'Ativo' }, status),
      h('td', { 'data-rot': 'Destaque' }, estrela),
      h('td', { class: 'cheio' }, h('div', { class: 'acoes' },
        h('a', { class: 'btn sec peq', href: '#/produtos/' + p.id }, icone('editar'), 'Editar'),
        pode('excluir') ? h('button', { class: 'btn perigo peq', type: 'button', 'aria-label': 'Excluir ' + p.nome, onclick: () => excluirProduto(p, () => { lista.splice(lista.indexOf(p), 1); desenhar(); }) }, icone('lixo')) : null)));
  }

  function desenhar() {
    Object.assign(filtrosProdutos, { q: busca.value, categoria: selCat.value, status: selStatus.value });
    const q = norm(busca.value.trim());
    const vis = lista.filter((p) => (!q || norm(p.nome + ' ' + p.id).includes(q))
      && (!selCat.value || p.categoria === selCat.value)
      && (!selStatus.value || (selStatus.value === 'ativo' && p.ativo) || (selStatus.value === 'inativo' && !p.ativo)
        || (selStatus.value === 'promo' && temPromo(p)) || (selStatus.value === 'destaque' && p.destaque > 0)));
    contagem.textContent = `${vis.length} de ${lista.length} produtos · preços do tema atual (${NOME_TEMA[temaAtual]})`;
    corpo.replaceChildren(...vis.map(linha));
    tabela.hidden = !vis.length; vazio.hidden = !!vis.length;
  }
  busca.addEventListener('input', desenhar); selCat.addEventListener('change', desenhar); selStatus.addEventListener('change', desenhar);
  const tabela = h('table', { class: 'tabela' },
    h('thead', null, h('tr', null, ['Produto', 'Categoria', 'Preço', 'Situação', 'Ativo', 'Destaque', ''].map((t) => h('th', { scope: 'col', text: t })))), corpo);
  const vazio = h('div', { class: 'vazio', text: 'Nenhum produto encontrado com esses filtros.' });
  desenhar();
  return h('div', null,
    h('div', { class: 'ferramentas' },
      h('div', { class: 'busca' }, icone('busca'), busca), selCat, selStatus,
      pode('produtos') ? h('a', { class: 'btn', href: '#/produtos/novo' }, icone('mais'), 'Novo produto') : null),
    contagem, tabela, vazio);
}

async function excluirProduto(p, depois) {
  const ok = await confirmar('Excluir produto?', `“${p.nome}” será apagado de vez, junto com as promoções dele. Isso não pode ser desfeito. Se for só falta de estoque, prefira desativar.`, { botao: 'Excluir definitivamente', perigo: true });
  if (!ok) return;
  try { await api('DELETE', 'admin/produtos/' + p.id, { confirmar: p.id }); toast('Produto excluído.'); depois(); }
  catch (e) { falha(e); }
}

// ================================================================= PRODUTO (formulário)
const MAX_LADO = 1600, MAX_BYTES = 2 * 1024 * 1024;

async function prepararImagem(arquivo) {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) throw new Error(`“${arquivo.name}”: formato não aceito. Use JPG, PNG ou WEBP.`);
  if (arquivo.size > 20 * 1024 * 1024) throw new Error(`“${arquivo.name}”: arquivo grande demais (máx. 20 MB).`);
  let bmp;
  try { bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' }); } catch { throw new Error(`“${arquivo.name}” não é uma imagem válida.`); }
  let escala = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height));
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * escala)); c.height = Math.max(1, Math.round(bmp.height * escala));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    for (const [tipo, q] of [['image/webp', 0.86], ['image/jpeg', 0.82], ['image/webp', 0.7]]) {
      const blob = await new Promise((r) => c.toBlob(r, tipo, q));
      if (blob && blob.type === tipo && blob.size <= MAX_BYTES) return blob;
    }
    escala *= 0.75;
  }
  throw new Error(`“${arquivo.name}”: não consegui reduzir a imagem para menos de 2 MB.`);
}
const blobParaBase64 = (b) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => erro(new Error('Falha ao ler a imagem.')); r.readAsDataURL(b); });

async function paginaProduto(id) {
  const [lista, det] = await Promise.all([api('GET', 'admin/produtos'), id ? api('GET', 'admin/produtos/' + id) : null]);
  const p = det?.produto;
  titulo(p ? 'Editar produto' : 'Novo produto');
  const editavel = pode('produtos');
  const podePreco = pode('precos') || (!p && editavel);
  const podePromo = pode('precos');

  // Estado do formulário
  const f = {
    nome: p?.nome || '', categoria: p?.categoria || '', descricao: p?.descricao || '', icone: p?.icone || '',
    preco_cents: p?.preco_cents ?? null, frete_cents: p?.frete_cents ?? 0, checkout_url: p?.checkout_url || '',
    imagens: (p?.imagens || []).map((url) => ({ url, blob: null, previa: url })),
    variantes: [], temas: p ? [...p.temas] : TEMAS.map((t) => t.id), destaque: (p?.destaque || 0) > 0, ativo: p ? p.ativo : true, ordem: p?.ordem || 0,
    promocoes: {},
  };
  f.variantes = (p?.variantes || []).map((v) => ({ nome: v.nome, cor: v.cor, checkout: v.checkout, img: f.imagens.find((i) => i.url === v.imagem) || (v.imagem ? { url: v.imagem, blob: null, previa: v.imagem, solta: true } : null) }));
  for (const t of TEMAS) {
    const pr = p?.promocoes?.[t.id];
    f.promocoes[t.id] = pr ? { tem: true, tipo: pr.tipo, valor: pr.valor, ativo: pr.ativo, checkout_url: pr.checkout_url || '' } : { tem: false, tipo: 'preco', valor: null, ativo: true, checkout_url: '' };
  }
  const marcarSujo = () => { S.sujo = true; statusSalvar.textContent = 'Alterações não salvas'; };
  const erros = h('div', { class: 'aviso erro', role: 'alert', hidden: true });

  // ---- Informações
  const inNome = h('input', { type: 'text', value: f.nome, maxlength: 120, required: true, disabled: !editavel, oninput: (e) => { f.nome = e.target.value; marcarSujo(); } });
  const dl = h('datalist', { id: 'lista-cat' }, lista.categorias.map((c) => h('option', { value: c })));
  const inCat = h('input', { type: 'text', value: f.categoria, list: 'lista-cat', maxlength: 40, required: true, disabled: !editavel, oninput: (e) => { f.categoria = e.target.value; marcarSujo(); } });
  const cont = h('span', { class: 'ajuda' });
  const inDesc = h('textarea', { maxlength: 600, rows: 4, disabled: !editavel, oninput: (e) => { f.descricao = e.target.value; cont.textContent = `${f.descricao.length}/600`; marcarSujo(); } });
  inDesc.value = f.descricao; cont.textContent = `${f.descricao.length}/600`;
  const inIcone = h('input', { type: 'text', value: f.icone, maxlength: 8, placeholder: 'ex.: 🎧', disabled: !editavel, oninput: (e) => { f.icone = e.target.value; marcarSujo(); } });
  const inOrdem = h('input', { type: 'number', min: 0, max: 1000000, step: 1, value: f.ordem, disabled: !editavel, oninput: (e) => { f.ordem = parseInt(e.target.value, 10) || 0; marcarSujo(); } });
  const secInfo = h('section', { class: 'card pilha' }, h('div', null, h('h2', { text: 'Informações' }), p ? h('p', { class: 'mini', text: 'ID: ' + p.id }) : null),
    campo('Nome do produto', inNome),
    h('div', { class: 'grade g2' }, campo('Categoria', inCat, 'Escolha uma existente ou digite uma nova.'), dl,
      h('div', { class: 'grade g2' }, campo('Ícone', inIcone, 'Aparece se a foto falhar.'), campo('Ordem', inOrdem, 'Menor aparece antes.'))),
    h('div', { class: 'campo' }, h('label', { for: inDesc.id = 'desc', text: 'Descrição' }), inDesc, cont));

  // ---- Preço
  const inPreco = entradaMoeda(f.preco_cents, (c) => { f.preco_cents = c; marcarSujo(); atualizarPrevias(); }, { disabled: !podePreco });
  const freteGratis = f.frete_cents === 0;
  const inFrete = entradaMoeda(freteGratis ? null : f.frete_cents, (c) => { f.frete_cents = c ?? 0; marcarSujo(); }, { disabled: !editavel || freteGratis });
  const inCheckout = h('input', { type: 'url', value: f.checkout_url, placeholder: 'https://pay.kaiross.com.br/…', maxlength: 500, disabled: !editavel, oninput: (e) => { f.checkout_url = e.target.value; marcarSujo(); } });
  const secPreco = h('section', { class: 'card pilha' }, h('h2', { text: 'Preço e checkout' }),
    h('div', { class: 'grade g2' },
      campo('Preço original', inPreco, podePreco ? null : 'Você não tem permissão para alterar preços.'),
      h('div', { class: 'campo' }, h('span', { class: 'rot', text: 'Frete' }),
        interruptor('Frete grátis', freteGratis, (v) => { inFrete.querySelector('input').disabled = v; if (v) { f.frete_cents = 0; inFrete.querySelector('input').value = ''; } marcarSujo(); }, !editavel), inFrete)),
    campo('Link de checkout (Kaiross)', inCheckout, 'Para onde o botão “Comprar agora” leva.'),
    h('div', { class: 'aviso' }, '⚠️', h('span', { text: 'O valor cobrado é o que está configurado no checkout da Kaiross. Ao mudar preço ou promoção aqui, mude também lá.' })));

  // ---- Imagens
  const galeria = h('div', { class: 'galeria' });
  const arquivoIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true });
  let substituir = null;
  arquivoIn.addEventListener('change', async () => {
    const arquivos = [...arquivoIn.files]; arquivoIn.value = '';
    for (const a of arquivos) {
      if (!substituir && f.imagens.length >= 12) { toast('Máximo de 12 imagens por produto.', 'erro'); break; }
      try {
        const blob = await prepararImagem(a);
        const nova = { url: null, blob, previa: URL.createObjectURL(blob) };
        if (substituir) { const i = f.imagens.indexOf(substituir); f.imagens[i] = nova; f.variantes.forEach((v) => { if (v.img === substituir) v.img = nova; }); substituir = null; }
        else f.imagens.push(nova);
        marcarSujo();
      } catch (e) { falha(e); }
    }
    substituir = null;
    desenharGaleria(); desenharVariantes();
  });
  function desenharGaleria() {
    galeria.replaceChildren(...f.imagens.map((img, i) => {
      const bts = editavel ? h('div', { class: 'bts' },
        i > 0 ? h('button', { type: 'button', title: 'Tornar principal', 'aria-label': 'Tornar imagem principal', onclick: () => { f.imagens.splice(i, 1); f.imagens.unshift(img); marcarSujo(); desenharGaleria(); desenharVariantes(); } }, icone('principal')) : null,
        i > 0 ? h('button', { type: 'button', title: 'Mover para a esquerda', 'aria-label': 'Mover para a esquerda', onclick: () => { [f.imagens[i - 1], f.imagens[i]] = [f.imagens[i], f.imagens[i - 1]]; marcarSujo(); desenharGaleria(); desenharVariantes(); } }, icone('esq')) : null,
        h('button', { type: 'button', title: 'Substituir', 'aria-label': 'Substituir imagem', onclick: () => { substituir = img; arquivoIn.multiple = false; arquivoIn.click(); arquivoIn.multiple = true; } }, icone('trocar')),
        h('button', { type: 'button', class: 'rem', title: 'Remover', 'aria-label': 'Remover imagem', onclick: async () => {
          if (!(await confirmar('Remover imagem?', 'A imagem sai do produto quando você salvar.', { botao: 'Remover', perigo: true }))) return;
          f.imagens.splice(f.imagens.indexOf(img), 1); f.variantes.forEach((v) => { if (v.img === img) v.img = null; }); marcarSujo(); desenharGaleria(); desenharVariantes();
        } }, icone('lixo'))) : null;
      return h('div', { class: 'foto' + (i === 0 ? ' principal' : '') },
        i === 0 ? h('span', { class: 'selo-f', text: 'Principal' }) : null,
        img.blob ? h('span', { class: 'selo-f novo', text: 'Não salva' }) : null,
        h('div', { class: 'img' }, h('img', { src: urlSegura(img.previa), alt: `Imagem ${i + 1}`, referrerpolicy: 'no-referrer' })), bts);
    }), ...(editavel ? [
      h('button', { type: 'button', class: 'add-foto', onclick: () => arquivoIn.click() }, icone('upload'), 'Enviar do dispositivo', h('span', { class: 'mini', text: 'JPG, PNG ou WEBP' })),
      h('button', { type: 'button', class: 'add-foto', onclick: adicionarPorLink }, icone('link'), 'Adicionar por link'),
    ] : []));
  }
  async function adicionarPorLink() {
    const inp = h('input', { type: 'url', placeholder: 'https://…', maxlength: 500 });
    const url = await modal({ titulo: 'Adicionar imagem por link', corpo: campo('Endereço da imagem', inp, 'Precisa começar com https://'),
      botoes: [{ texto: 'Cancelar', classe: 'sec' }, { texto: 'Adicionar', acao: () => { const u = inp.value.trim(); if (!/^https:\/\/\S+$/.test(u)) throw new Error('Informe um link que comece com https://'); return u; } }] });
    if (!url) return;
    if (f.imagens.length >= 12) return toast('Máximo de 12 imagens por produto.', 'erro');
    f.imagens.push({ url, blob: null, previa: url }); marcarSujo(); desenharGaleria(); desenharVariantes();
  }
  const secImagens = h('section', { class: 'card' }, h('h2', { text: 'Imagens' }),
    h('p', { class: 'sub', text: 'A primeira é a imagem principal (aparece no card da loja). Fotos do celular são reduzidas automaticamente antes do envio.' }), galeria, arquivoIn);

  // ---- Promoções por tema
  const previas = {};
  function atualizarPrevias() {
    for (const t of TEMAS) {
      const pr = f.promocoes[t.id], el = previas[t.id];
      if (!el) continue;
      const r = pr.tem && pr.valor ? precoFinal(f.preco_cents, pr) : null;
      el.replaceChildren(...(!pr.tem ? [] : !f.preco_cents ? [h('span', { class: 'mudo', text: 'Informe o preço original.' })]
        : r ? [h('span', { class: 'mudo', text: 'De' }), h('s', { text: fmtReais(f.preco_cents) }), h('span', { class: 'mudo', text: 'por' }), h('b', { text: fmtReais(r.final) }), h('span', { class: 'tag promo', text: '-' + r.pct + '%' }), pr.ativo ? null : h('span', { class: 'tag off', text: 'pausada' })]
          : [h('span', { class: 'erro-campo', text: 'O preço promocional precisa ser menor que o original.' })]).filter(Boolean));
      el.hidden = !pr.tem;
    }
  }
  const secPromo = h('section', { class: 'card' }, h('h2', { text: 'Promoções por tema' }),
    h('p', { class: 'sub', text: podePromo ? 'Defina um preço promocional para cada tema. Ele só vale enquanto o tema estiver ativo na loja.' : 'Você não tem permissão para alterar promoções.' }),
    TEMAS.map((t) => {
      const pr = f.promocoes[t.id];
      const corpoP = h('div', { class: 'pilha', style: { 'margin-top': '12px' }, hidden: !pr.tem });
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Tipo de desconto' });
      const valorWrap = h('div');
      const desenharValor = () => {
        seg.replaceChildren(...[['preco', 'Preço fixo'], ['percentual', 'Porcentagem']].map(([v, txt]) => h('button', { type: 'button', 'aria-pressed': pr.tipo === v ? 'true' : 'false', disabled: !podePromo, text: txt,
          onclick: () => { if (pr.tipo === v) return; pr.tipo = v; pr.valor = null; marcarSujo(); desenharValor(); atualizarPrevias(); } })));
        valorWrap.replaceChildren(pr.tipo === 'preco'
          ? campo('Preço promocional', entradaMoeda(pr.valor, (c) => { pr.valor = c; marcarSujo(); atualizarPrevias(); }, { disabled: !podePromo }))
          : campo('Desconto', h('div', { class: 'sufixo' }, h('input', { type: 'number', min: 1, max: 95, step: 1, value: pr.valor ?? '', disabled: !podePromo, oninput: (e) => { pr.valor = parseInt(e.target.value, 10) || null; marcarSujo(); atualizarPrevias(); } }), h('span', { text: '%' }))));
      };
      desenharValor();
      const inLink = h('input', { type: 'url', value: pr.checkout_url, placeholder: 'Opcional — se a promoção usar outro link', maxlength: 500, disabled: !podePromo, oninput: (e) => { pr.checkout_url = e.target.value; marcarSujo(); } });
      previas[t.id] = h('div', { class: 'previa-preco' });
      adicionar(corpoP, [h('div', { class: 'linha entre' }, seg, interruptor('Promoção ativa', pr.ativo, (v) => { pr.ativo = v; marcarSujo(); atualizarPrevias(); }, !podePromo)), valorWrap, campo('Link de checkout da promoção', inLink), previas[t.id]]);
      return h('div', { class: 'promo-tema' },
        h('div', { class: 'cab' }, h('b', null, t.emoji, ' ', t.nome), interruptor('Ter promoção', pr.tem, (v) => { pr.tem = v; corpoP.hidden = !v; marcarSujo(); atualizarPrevias(); }, !podePromo)),
        corpoP);
    }));

  // ---- Publicação
  const secPub = h('section', { class: 'card pilha' }, h('h2', { text: 'Publicação' }),
    interruptor('Produto ativo (aparece na loja)', f.ativo, (v) => { f.ativo = v; marcarSujo(); }, !editavel),
    interruptor('Em destaque (topo da página)', f.destaque, (v) => { f.destaque = v; marcarSujo(); }, !editavel),
    h('div', { class: 'campo' }, h('span', { class: 'rot', text: 'Aparece nos temas' }),
      TEMAS.map((t) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: f.temas.includes(t.id), disabled: !editavel,
        onchange: (e) => { f.temas = e.target.checked ? [...f.temas, t.id] : f.temas.filter((x) => x !== t.id); marcarSujo(); } }), `${t.emoji} ${t.nome}`)),
      h('span', { class: 'ajuda', text: 'Desmarque para esconder o produto durante aquele tema.' })));

  // ---- Variações
  const listaVar = h('div');
  function desenharVariantes() {
    listaVar.replaceChildren(...f.variantes.map((v, i) => {
      const multi = v.cor === 'multicolor';
      const cor = h('input', { type: 'color', value: multi ? '#888888' : v.cor, disabled: !editavel || multi, 'aria-label': 'Cor', oninput: (e) => { v.cor = e.target.value; marcarSujo(); } });
      const selImg = h('select', { disabled: !editavel, 'aria-label': 'Imagem da variação', onchange: (e) => { v.img = e.target.value === '' ? null : f.imagens[+e.target.value]; marcarSujo(); } },
        h('option', { value: '', text: 'Imagem: a principal' }), f.imagens.map((img, j) => h('option', { value: j, text: `Imagem ${j + 1}${j === 0 ? ' (principal)' : ''}`, selected: v.img === img })));
      if (v.img && !f.imagens.includes(v.img)) selImg.append(h('option', { value: '', text: 'Imagem atual (link)', selected: true }));
      return h('div', { class: 'var-linha' },
        campo('Nome', h('input', { type: 'text', value: v.nome, maxlength: 30, placeholder: 'ex.: Azul', disabled: !editavel, oninput: (e) => { v.nome = e.target.value; marcarSujo(); } })),
        h('div', { class: 'campo' }, h('span', { class: 'rot', text: 'Cor' }), h('div', { class: 'cor-campo' }, cor,
          h('label', { class: 'check mini', title: 'Várias cores' }, h('input', { type: 'checkbox', checked: multi, disabled: !editavel, onchange: (e) => { v.cor = e.target.checked ? 'multicolor' : cor.value; cor.disabled = e.target.checked; marcarSujo(); } }), 'Várias'))),
        campo('Link de checkout', h('input', { type: 'url', value: v.checkout, maxlength: 500, placeholder: 'https://…', disabled: !editavel, oninput: (e) => { v.checkout = e.target.value; marcarSujo(); } })),
        editavel ? h('button', { class: 'btn perigo icone', type: 'button', 'aria-label': 'Remover variação', onclick: () => { f.variantes.splice(i, 1); marcarSujo(); desenharVariantes(); } }, icone('lixo')) : h('span'),
        h('div', { class: 'campo', style: { 'grid-column': '1/-1' } }, selImg));
    }));
    if (!f.variantes.length) listaVar.append(h('p', { class: 'mudo mini', text: 'Sem variações. Use para oferecer cores com links de checkout diferentes.' }));
  }
  const secVar = h('section', { class: 'card pilha' }, h('div', { class: 'linha entre' }, h('h2', { text: 'Variações de cor' }),
    editavel ? h('button', { class: 'btn sec peq', type: 'button', onclick: () => { if (f.variantes.length >= 10) return toast('Máximo de 10 variações.', 'erro'); f.variantes.push({ nome: '', cor: '#2563eb', checkout: '', img: null }); marcarSujo(); desenharVariantes(); } }, icone('mais'), 'Adicionar') : null),
  listaVar);

  // ---- Barra de salvar
  const statusSalvar = h('span', { class: 'status', text: p ? `Última alteração ${relativo(p.atualizado_em)} por ${p.atualizado_por || '—'}` : 'Produto novo' });
  const btSalvar = h('button', { class: 'btn', type: 'button', disabled: !editavel, onclick: salvar }, icone('ok'), 'Salvar produto');
  const barra = h('div', { class: 'barra-salvar' }, statusSalvar,
    p && pode('excluir') ? h('button', { class: 'btn perigo', type: 'button', onclick: () => excluirProduto(p, () => { S.sujo = false; location.hash = '#/produtos'; }) }, icone('lixo'), h('span', { text: 'Excluir' })) : null,
    h('a', { class: 'btn sec', href: '#/produtos', text: 'Voltar' }), btSalvar);

  function validar() {
    const msgs = [];
    const marca = (el, ruim) => el.setAttribute('aria-invalid', ruim ? 'true' : 'false');
    const nomeOk = f.nome.trim().length >= 2; marca(inNome, !nomeOk); if (!nomeOk) msgs.push('Nome: mínimo de 2 caracteres.');
    const catOk = f.categoria.trim().length >= 2; marca(inCat, !catOk); if (!catOk) msgs.push('Categoria é obrigatória.');
    const precoOk = Number.isInteger(f.preco_cents) && f.preco_cents > 0; marca(inPreco.querySelector('input'), !precoOk); if (!precoOk) msgs.push('Preço original inválido (ex.: 69,90).');
    if (!Number.isInteger(f.frete_cents) || f.frete_cents < 0) msgs.push('Valor do frete inválido.');
    const linkOk = /^https:\/\/\S+$/.test(f.checkout_url.trim()); marca(inCheckout, !linkOk); if (!linkOk) msgs.push('Link de checkout precisa começar com https://');
    for (const t of TEMAS) {
      const pr = f.promocoes[t.id];
      if (!pr.tem) continue;
      if (!pr.valor || (pr.tipo === 'percentual' && (pr.valor < 1 || pr.valor > 95)) || Number.isNaN(pr.valor)) msgs.push(`Promoção ${t.nome}: informe o valor.`);
      else if (precoOk && !precoFinal(f.preco_cents, pr)) msgs.push(`Promoção ${t.nome}: o preço promocional precisa ser menor que o original.`);
      if (pr.checkout_url.trim() && !/^https:\/\/\S+$/.test(pr.checkout_url.trim())) msgs.push(`Promoção ${t.nome}: link precisa começar com https://`);
    }
    f.variantes.forEach((v, i) => {
      if (!v.nome.trim()) msgs.push(`Variação ${i + 1}: informe o nome.`);
      if (!/^https:\/\/\S+$/.test(v.checkout.trim())) msgs.push(`Variação ${i + 1}: link de checkout precisa começar com https://`);
    });
    erros.replaceChildren(h('div', null, h('b', { text: 'Corrija antes de salvar:' }), h('ul', null, msgs.map((m) => h('li', { text: m })))));
    erros.hidden = !msgs.length;
    if (msgs.length) erros.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return !msgs.length;
  }

  async function salvar() {
    if (!validar()) return;
    btSalvar.disabled = true;
    try {
      for (const img of f.imagens.filter((x) => x.blob)) {
        statusSalvar.textContent = 'Enviando imagens…';
        const r = await api('POST', 'admin/imagens', { dados: await blobParaBase64(img.blob) });
        img.url = r.url; img.blob = null;
      }
      statusSalvar.textContent = 'Salvando…';
      const corpo = {
        nome: f.nome, categoria: f.categoria, descricao: f.descricao, icone: f.icone, preco_cents: f.preco_cents, frete_cents: f.frete_cents,
        checkout_url: f.checkout_url.trim(), imagens: f.imagens.map((i) => i.url), temas: f.temas, destaque: f.destaque, ativo: f.ativo, ordem: f.ordem,
        variantes: f.variantes.map((v) => ({ nome: v.nome, cor: v.cor, checkout: v.checkout.trim(), imagem: v.img?.url || null })),
      };
      if (podePromo) {
        corpo.promocoes = {};
        for (const t of TEMAS) { const pr = f.promocoes[t.id]; if (pr.tem) corpo.promocoes[t.id] = { tipo: pr.tipo, valor: pr.valor, ativo: pr.ativo, checkout_url: pr.checkout_url.trim() || null }; }
      }
      if (p) { corpo.versao = p.versao; await api('PUT', 'admin/produtos/' + p.id, corpo); }
      else { const r = await api('POST', 'admin/produtos', corpo); S.sujo = false; toast('Produto criado. Já está na loja.'); location.hash = '#/produtos/' + r.id; return; }
      S.sujo = false; toast('Alterações salvas. A loja atualiza em alguns segundos.');
      navegar();
    } catch (e) {
      falha(e);
      if (e.status === 409) erros.replaceChildren(h('span', { text: e.message })), erros.hidden = false;
      statusSalvar.textContent = 'Não salvo';
    } finally { btSalvar.disabled = !editavel; }
  }

  desenharGaleria(); desenharVariantes(); atualizarPrevias();
  S.sujo = false;
  return h('div', null, h('p', null, h('a', { class: 'btn ghost peq', href: '#/produtos' }, icone('esq'), 'Produtos')), erros,
    h('div', { class: 'form-prod' },
      h('div', { class: 'pilha' }, secInfo, secImagens, secVar),
      h('div', { class: 'pilha' }, secPub, secPreco, secPromo)),
    barra);
}

// ================================================================= PROMOÇÕES
let temaPromo = null;
async function paginaPromocoes() {
  titulo('Promoções');
  const d = await api('GET', 'admin/produtos');
  temaPromo ||= d.temaAtual;
  const editar = pode('precos');
  const corpo = h('div');
  const busca = h('input', { type: 'search', placeholder: 'Buscar produto…', 'aria-label': 'Buscar produto', maxlength: 80 });
  const soPromo = h('input', { type: 'checkbox' });
  const abas = h('div', { class: 'seg', role: 'tablist' });
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function desenharAbas() {
    abas.replaceChildren(...TEMAS.map((t) => h('button', { type: 'button', role: 'tab', 'aria-pressed': temaPromo === t.id ? 'true' : 'false', 'aria-selected': temaPromo === t.id ? 'true' : 'false',
      onclick: () => { temaPromo = t.id; desenharAbas(); desenhar(); } }, `${t.emoji} ${t.nome}`, t.id === d.temaAtual ? ' • no ar' : '')));
  }
  function linha(p) {
    const atual = p.promocoes[temaPromo];
    const e = atual ? { tipo: atual.tipo, valor: atual.valor, ativo: atual.ativo, checkout_url: atual.checkout_url } : { tipo: 'preco', valor: null, ativo: true, checkout_url: null };
    const prev = h('div', { class: 'preco-col' });
    const btSalvar = h('button', { class: 'btn peq', type: 'button', disabled: true, text: 'Salvar' });
    const camp = d.campanhas.find((c) => c.id === temaPromo);
    const mostrar = () => {
      const r = e.valor ? precoFinal(p.preco_cents, e) : null;
      const geral = !atual && camp?.desconto_pct ? p.precos[temaPromo] : null;
      prev.replaceChildren(r ? h('div', null, h('b', { text: fmtReais(r.final) }), h('span', { class: 'tag promo', style: { 'margin-left': '6px' }, text: '-' + r.pct + '%' }))
        : geral && geral.pct ? h('div', null, h('b', { text: fmtReais(geral.final) }), h('span', { class: 'mini', text: ` (desconto geral ${camp.desconto_pct}%)` }))
          : h('span', { class: e.valor ? 'erro-campo' : 'mini', text: e.valor ? 'maior que o original' : 'sem promoção' }));
      btSalvar.disabled = !editar || !e.valor || !r;
    };
    const tipo = h('select', { 'aria-label': 'Tipo', disabled: !editar, onchange: (ev) => { e.tipo = ev.target.value; e.valor = null; desenharValor(); mostrar(); } },
      h('option', { value: 'preco', text: 'Preço fixo', selected: e.tipo === 'preco' }), h('option', { value: 'percentual', text: '% de desconto', selected: e.tipo === 'percentual' }));
    const valorBox = h('div');
    const desenharValor = () => valorBox.replaceChildren(e.tipo === 'preco'
      ? entradaMoeda(e.valor, (c) => { e.valor = Number.isNaN(c) ? null : c; mostrar(); }, { disabled: !editar, 'aria-label': 'Preço promocional' })
      : h('div', { class: 'sufixo' }, h('input', { type: 'number', min: 1, max: 95, value: e.valor ?? '', disabled: !editar, 'aria-label': 'Desconto em %', oninput: (ev) => { e.valor = parseInt(ev.target.value, 10) || null; mostrar(); } }), h('span', { text: '%' })));
    desenharValor(); mostrar();
    const sw = interruptor(null, atual ? atual.ativo : false, async (v, ev) => {
      if (!atual) { ev.target.checked = false; return toast('Defina o valor e salve a promoção primeiro.', 'info'); }
      ev.target.disabled = true;
      try { await api('PUT', `admin/produtos/${p.id}/promocoes/${temaPromo}`, { ...atual, ativo: v }); atual.ativo = v; toast(v ? 'Promoção ativada.' : 'Promoção desativada.'); }
      catch (err) { ev.target.checked = !v; falha(err); } finally { ev.target.disabled = !editar; }
    }, !editar);
    btSalvar.addEventListener('click', async () => {
      btSalvar.disabled = true;
      try {
        const corpoP = { tipo: e.tipo, valor: e.valor, ativo: atual ? atual.ativo : true, checkout_url: e.checkout_url || null };
        await api('PUT', `admin/produtos/${p.id}/promocoes/${temaPromo}`, corpoP);
        p.promocoes[temaPromo] = { ...corpoP, produto_id: p.id, campanha_id: temaPromo };
        toast('Promoção salva.'); desenhar();
      } catch (err) { falha(err); mostrar(); }
    });
    const btRemover = atual && editar ? h('button', { class: 'btn perigo peq', type: 'button', 'aria-label': 'Remover promoção', onclick: async () => {
      if (!(await confirmar('Remover promoção?', `O produto “${p.nome}” volta ao preço original no tema ${NOME_TEMA[temaPromo]}.`, { botao: 'Remover', perigo: true }))) return;
      try { await api('PUT', `admin/produtos/${p.id}/promocoes/${temaPromo}`, { remover: true }); delete p.promocoes[temaPromo]; toast('Promoção removida.'); desenhar(); } catch (err) { falha(err); }
    } }, icone('lixo')) : null;
    return h('tr', null,
      h('td', { class: 'cheio' }, h('div', { class: 'prod' }, thumb(p.imagens[0], p.icone), h('div', null, h('b', { text: p.nome }), h('code', { text: p.ativo ? p.categoria : p.categoria + ' · desativado' })))),
      h('td', { 'data-rot': 'Original', class: 'preco-col' }, h('b', { text: fmtReais(p.preco_cents) })),
      h('td', { 'data-rot': 'Tipo' }, tipo),
      h('td', { 'data-rot': 'Valor' }, valorBox),
      h('td', { 'data-rot': 'Final' }, prev),
      h('td', { 'data-rot': 'Ativa' }, sw),
      h('td', { class: 'cheio' }, h('div', { class: 'acoes' }, btSalvar, btRemover)));
  }
  function desenhar() {
    const q = norm(busca.value.trim());
    const vis = d.produtos.filter((p) => (!q || norm(p.nome).includes(q)) && (!soPromo.checked || p.promocoes[temaPromo]));
    const camp = d.campanhas.find((c) => c.id === temaPromo);
    const ativas = d.produtos.filter((p) => p.promocoes[temaPromo]?.ativo).length;
    corpo.replaceChildren(
      h('p', { class: 'contagem', text: `${ativas} promoções ativas no tema ${NOME_TEMA[temaPromo]}${camp?.desconto_pct ? ` · desconto geral da campanha: ${camp.desconto_pct}% nos produtos sem promoção própria` : ''}` }),
      vis.length ? h('table', { class: 'tabela' }, h('thead', null, h('tr', null, ['Produto', 'Original', 'Tipo', 'Valor', 'Preço final', 'Ativa', ''].map((t) => h('th', { text: t })))), h('tbody', null, vis.map(linha)))
        : h('div', { class: 'vazio', text: 'Nenhum produto encontrado.' }));
  }
  busca.addEventListener('input', desenhar); soPromo.addEventListener('change', desenhar);
  desenharAbas(); desenhar();
  return h('div', { class: 'pilha' },
    editar ? null : h('div', { class: 'aviso info', text: 'Você pode ver as promoções, mas não tem permissão para alterá-las.' }),
    h('div', { class: 'aviso' }, '⚠️', h('span', { text: 'Lembre de colocar o mesmo valor promocional no checkout da Kaiross — é ele que cobra o cliente.' })),
    h('div', { class: 'ferramentas' }, abas, h('div', { class: 'busca' }, icone('busca'), busca), h('label', { class: 'check' }, soPromo, 'Só com promoção')),
    corpo);
}

// ================================================================= TEMAS E CAMPANHAS
async function paginaTemas() {
  titulo('Temas e campanhas');
  const d = await api('GET', 'admin/campanhas');
  const editar = pode('temas');
  const modoSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Tema do site' });
  const desenharModo = () => modoSeg.replaceChildren(...[['auto', '📅 Automático'], ...TEMAS.map((t) => [t.id, `${t.emoji} ${t.nome}`])].map(([v, txt]) =>
    h('button', { type: 'button', 'aria-pressed': d.modo === v ? 'true' : 'false', disabled: !editar, text: txt, onclick: async () => {
      if (d.modo === v) return;
      const msg = v === 'auto' ? 'O tema vai mudar sozinho conforme as datas de cada campanha.' : `A loja vai mostrar o tema ${NOME_TEMA[v]} agora, ignorando as datas, até você mudar de novo.`;
      if (!(await confirmar('Mudar o tema da loja?', msg, { botao: 'Mudar tema' }))) return;
      try { await api('PUT', 'admin/tema', { modo: v }); toast('Tema alterado. A loja atualiza em alguns segundos.'); navegar(); } catch (e) { falha(e); }
    } })));
  desenharModo();
  const atual = TEMAS.find((t) => t.id === d.temaAtual);

  const cartao = (c) => {
    const t = TEMAS.find((x) => x.id === c.id);
    const e = { ativo: c.ativo, inicio: msParaInput(c.inicio), fim: msParaInput(c.fim), dia: msParaInput(c.dia_evento), desconto: c.desconto_pct };
    const bt = h('button', { class: 'btn peq', type: 'button', disabled: true, text: 'Salvar campanha' });
    const sujo = () => { bt.disabled = !editar; };
    const dt = (chave, rot, ajuda) => campo(rot, h('input', { type: 'datetime-local', value: e[chave], disabled: !editar, oninput: (ev) => { e[chave] = ev.target.value; sujo(); } }), ajuda);
    bt.addEventListener('click', async () => {
      const corpoC = { desconto_pct: parseInt(e.desconto, 10) || 0 };
      if (c.id !== 'normal') {
        Object.assign(corpoC, { ativo: e.ativo, inicio: inputParaMs(e.inicio), fim: inputParaMs(e.fim), dia_evento: inputParaMs(e.dia) });
        if (!corpoC.inicio || !corpoC.fim) return toast('Informe as datas de início e de encerramento.', 'erro');
        if (corpoC.fim <= corpoC.inicio) return toast('O encerramento precisa ser depois do início.', 'erro');
      }
      if (corpoC.desconto_pct < 0 || corpoC.desconto_pct > 90) return toast('Desconto geral: de 0 a 90%.', 'erro');
      bt.disabled = true;
      try { await api('PUT', 'admin/campanhas/' + c.id, corpoC); toast('Campanha salva.'); navegar(); } catch (err) { falha(err); bt.disabled = false; }
    });
    const no = t.id === d.temaAtual;
    return h('div', { class: 'camp' }, h('div', { class: 'faixa ' + c.id }),
      h('div', { class: 'corpo' },
        h('div', { class: 'cab' }, h('span', { text: t.emoji }), h('h3', { text: t.nome }), no ? h('span', { class: 'tag ok', text: 'No ar' }) : null,
          c.id !== 'normal' ? interruptor('Ligada', e.ativo, (v) => { e.ativo = v; sujo(); }, !editar) : null),
        c.id === 'normal' ? h('p', { class: 'mudo mini', text: 'Tema padrão: aparece quando nenhuma campanha está valendo.' })
          : h('div', { class: 'pilha' }, dt('inicio', 'Início'), dt('fim', 'Encerramento', 'A campanha sai do ar neste momento.'), dt('dia', 'Dia do evento', 'Usado na contagem “faltam X dias”.')),
        campo('Desconto geral da campanha', h('div', { class: 'sufixo' }, h('input', { type: 'number', min: 0, max: 90, value: e.desconto, disabled: !editar, oninput: (ev) => { e.desconto = ev.target.value; sujo(); } }), h('span', { text: '%' })),
          'Vale para os produtos desta campanha que não têm promoção própria. 0 = desligado.'),
        h('div', { class: 'linha entre' },
          h('span', { class: 'mini', text: `${c.participantes.length} de ${d.produtos.length} produtos participam · ${c.promocoes} promoções ativas` }),
          h('div', { class: 'linha' }, h('button', { class: 'btn sec peq', type: 'button', onclick: () => escolherProdutos(c) }, icone('check'), editar ? 'Produtos participantes' : 'Ver produtos'), bt))));
  };

  async function escolherProdutos(c) {
    const marcados = new Set(c.participantes);
    const busca = h('input', { type: 'search', placeholder: 'Buscar…', 'aria-label': 'Buscar produto' });
    const listaEl = h('div', { class: 'lista-check' });
    const cont = h('span', { class: 'mini' });
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const desenhar = () => {
      const q = norm(busca.value);
      listaEl.replaceChildren(...d.produtos.filter((p) => !q || norm(p.nome).includes(q)).map((p) => h('label', null,
        h('input', { type: 'checkbox', checked: marcados.has(p.id), disabled: !editar, onchange: (e) => { e.target.checked ? marcados.add(p.id) : marcados.delete(p.id); cont.textContent = `${marcados.size} selecionados`; } }),
        thumb(p.imagem, p.icone), h('div', null, h('b', { text: p.nome }), h('div', { class: 'mini', text: p.categoria + (p.ativo ? '' : ' · desativado') })))));
      cont.textContent = `${marcados.size} selecionados`;
    };
    busca.addEventListener('input', desenhar); desenhar();
    const todos = (v) => { d.produtos.forEach((p) => (v ? marcados.add(p.id) : marcados.delete(p.id))); desenhar(); };
    await modal({ titulo: `Produtos no tema ${NOME_TEMA[c.id]}`, largo: true,
      corpo: h('div', { class: 'pilha' }, h('p', { class: 'mudo mini', text: 'Desmarcados não aparecem na loja enquanto este tema estiver no ar.' }),
        h('div', { class: 'linha' }, h('div', { class: 'busca', style: { flex: '1' } }, busca), editar ? h('button', { class: 'btn sec peq', type: 'button', text: 'Marcar todos', onclick: () => todos(true) }) : null,
          editar ? h('button', { class: 'btn sec peq', type: 'button', text: 'Desmarcar todos', onclick: () => todos(false) }) : null), cont, listaEl),
      botoes: editar ? [{ texto: 'Cancelar', classe: 'sec' }, { texto: 'Salvar', acao: async () => { const r = await api('PUT', `admin/campanhas/${c.id}/produtos`, { produtos: [...marcados] }); toast(`Salvo: ${r.adicionados} adicionados, ${r.retirados} retirados.`); navegar(); } }]
        : [{ texto: 'Fechar', classe: 'sec' }] });
  }

  return h('div', { class: 'pilha' },
    editar ? null : h('div', { class: 'aviso info', text: 'Você pode ver os temas, mas não tem permissão para alterá-los.' }),
    h('section', { class: 'card' }, h('h2', { text: 'Tema ativo no site' }),
      h('p', { class: 'sub', text: 'No automático, a loja troca de tema sozinha nas datas de cada campanha. Ou escolha um tema para forçar agora.' }),
      h('div', { class: 'tema-atual' }, h('div', { class: 'bola ' + atual.id, text: atual.emoji }), h('div', null, h('b', { text: `A loja está mostrando: ${atual.nome}` }), h('div', { class: 'mini', text: d.modo === 'auto' ? 'Modo automático' : 'Modo manual (forçado)' }))),
      modoSeg),
    h('div', { class: 'grade g3' }, d.campanhas.map(cartao)),
    h('div', { class: 'aviso info', text: 'Datas no horário de Brasília. Para o próximo ano, é só atualizar as datas de cada campanha.' }));
}

// ================================================================= FUNCIONÁRIOS
function gerarSenha() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%*-_';
  const v = crypto.getRandomValues(new Uint32Array(16));
  return [...v].map((x) => a[x % a.length]).join('');
}
function campoSenha(rotulo, ajuda) {
  const inp = h('input', { type: 'password', autocomplete: 'new-password', maxlength: 128 });
  const ver = h('button', { type: 'button', 'aria-label': 'Mostrar senha', onclick: () => { inp.type = inp.type === 'password' ? 'text' : 'password'; } }, icone('olho'));
  const c = campo(rotulo, inp, ajuda);
  const caixa = h('div', { class: 'olho' });
  c.replaceChild(caixa, inp);
  caixa.append(inp, ver);
  const gerar = h('button', { class: 'btn ghost peq', type: 'button', onclick: () => { inp.value = gerarSenha(); inp.type = 'text'; } }, icone('chave'), 'Gerar senha forte');
  c.append(gerar);
  return { el: c, inp };
}

async function paginaFuncionarios() {
  titulo('Funcionários');
  if (!pode('funcionarios')) return h('div', { class: 'aviso erro', text: 'Só administradores podem gerenciar funcionários.' });
  const d = await api('GET', 'admin/usuarios');
  const NOMES_PERM = d.permissoes;

  function formulario(u) {
    const nome = h('input', { type: 'text', value: u?.nome || '', maxlength: 60 });
    const login = h('input', { type: 'text', value: u?.usuario || '', maxlength: 32, autocapitalize: 'none', spellcheck: 'false', disabled: !!u });
    const papel = h('select', null, h('option', { value: 'funcionario', text: 'Funcionário', selected: u?.papel !== 'admin' }), h('option', { value: 'admin', text: 'Administrador (acesso total)', selected: u?.papel === 'admin' }));
    const perms = h('div', { class: 'pilha', style: { gap: '8px' } }, Object.entries(NOMES_PERM).map(([k, txt]) => h('label', { class: 'check' }, h('input', { type: 'checkbox', value: k, checked: u ? u.permissoes.includes(k) : k === 'produtos' }), txt)));
    const caixaPerm = h('div', { class: 'campo' }, h('span', { class: 'rot', text: 'Permissões' }), perms);
    const syncPapel = () => { caixaPerm.hidden = papel.value === 'admin'; };
    papel.addEventListener('change', syncPapel); syncPapel();
    const senha = u ? null : campoSenha('Senha inicial', 'Mínimo de 10 caracteres. Passe para o funcionário por um canal seguro.');
    const el = h('div', { class: 'pilha' }, campo('Nome', nome), campo('Usuário de acesso', login, u ? 'O usuário não pode ser alterado.' : 'Letras minúsculas, números, ponto, hífen ou _.'), senha?.el, campo('Função', papel), caixaPerm);
    const ler = () => ({ nome: nome.value.trim(), usuario: login.value.trim().toLowerCase(), papel: papel.value, permissoes: [...perms.querySelectorAll('input:checked')].map((i) => i.value), senha: senha?.inp.value });
    return { el, ler };
  }

  async function novo() {
    const fm = formulario(null);
    await modal({ titulo: 'Novo funcionário', corpo: fm.el, botoes: [{ texto: 'Cancelar', classe: 'sec' }, { texto: 'Criar conta', acao: async () => {
      const v = fm.ler();
      if (v.nome.length < 2) throw new Error('Informe o nome.');
      if (!/^[a-z0-9._-]{3,32}$/.test(v.usuario)) throw new Error('Usuário: 3 a 32 caracteres (letras minúsculas, números, ponto, hífen ou _).');
      if (!v.senha || v.senha.length < 10) throw new Error('A senha precisa ter pelo menos 10 caracteres.');
      await api('POST', 'admin/usuarios', v); toast('Conta criada.'); navegar();
    } }] });
  }
  async function editar(u) {
    const fm = formulario(u);
    const ativo = interruptor('Conta ativa', u.ativo, () => {}, u.id === S.usuario.id);
    fm.el.append(ativo);
    await modal({ titulo: 'Editar funcionário', corpo: fm.el, botoes: [{ texto: 'Cancelar', classe: 'sec' }, { texto: 'Salvar', acao: async () => {
      const v = fm.ler();
      if (v.nome.length < 2) throw new Error('Informe o nome.');
      await api('PUT', 'admin/usuarios/' + u.id, { nome: v.nome, papel: v.papel, permissoes: v.permissoes, ativo: ativo.querySelector('input').checked });
      toast('Funcionário atualizado.'); navegar();
    } }] });
  }
  async function redefinir(u) {
    const s = campoSenha('Nova senha', 'O funcionário será desconectado de todos os aparelhos.');
    await modal({ titulo: `Redefinir senha de ${u.nome}`, corpo: s.el, botoes: [{ texto: 'Cancelar', classe: 'sec' }, { texto: 'Redefinir senha', acao: async () => {
      if (s.inp.value.length < 10) throw new Error('A senha precisa ter pelo menos 10 caracteres.');
      await api('POST', `admin/usuarios/${u.id}/senha`, { senha: s.inp.value }); toast('Senha redefinida.');
    } }] });
  }
  async function alternar(u) {
    const vai = !u.ativo;
    if (!(await confirmar(vai ? 'Reativar conta?' : 'Desativar conta?', vai ? `${u.nome} poderá entrar no painel de novo.` : `${u.nome} será desconectado na hora e não conseguirá mais entrar.`, { botao: vai ? 'Reativar' : 'Desativar', perigo: !vai }))) return;
    try { await api('PUT', 'admin/usuarios/' + u.id, { nome: u.nome, papel: u.papel, permissoes: u.permissoes, ativo: vai }); toast(vai ? 'Conta reativada.' : 'Conta desativada.'); navegar(); } catch (e) { falha(e); }
  }

  const linhas = d.usuarios.map((u) => h('tr', null,
    h('td', { class: 'cheio' }, h('div', { class: 'prod' }, h('div', { class: 'avatar', text: u.nome.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase() }),
      h('div', null, h('b', null, u.nome, u.id === S.usuario.id ? h('span', { class: 'mini', text: ' (você)' }) : null), h('code', { text: '@' + u.usuario })))),
    h('td', { 'data-rot': 'Função' }, h('span', { class: 'tag ' + (u.papel === 'admin' ? 'roxo' : 'azul'), text: u.papel === 'admin' ? 'Administrador' : 'Funcionário' })),
    h('td', { 'data-rot': 'Permissões' }, h('div', { class: 'linha' }, u.papel === 'admin' ? h('span', { class: 'mini', text: 'Tudo' }) : u.permissoes.length ? u.permissoes.map((p) => h('span', { class: 'tag', text: p })) : h('span', { class: 'mini', text: 'Só visualizar' }))),
    h('td', { 'data-rot': 'Situação' }, h('span', { class: 'tag ' + (u.ativo ? 'ok' : 'mal'), text: u.ativo ? 'Ativa' : 'Desativada' })),
    h('td', { 'data-rot': 'Último acesso' }, h('span', { class: 'mini', text: relativo(u.ultimo_login), title: fmtData(u.ultimo_login) })),
    h('td', { class: 'cheio' }, h('div', { class: 'acoes' },
      h('button', { class: 'btn sec peq', type: 'button', onclick: () => editar(u) }, icone('editar'), 'Editar'),
      h('button', { class: 'btn sec peq', type: 'button', onclick: () => redefinir(u) }, icone('chave'), 'Senha'),
      u.id !== S.usuario.id ? h('button', { class: 'btn peq ' + (u.ativo ? 'perigo' : 'sec'), type: 'button', onclick: () => alternar(u), text: u.ativo ? 'Desativar' : 'Reativar' }) : null))));
  return h('div', { class: 'pilha' },
    h('div', { class: 'linha entre' }, h('p', { class: 'contagem', text: `${d.usuarios.filter((u) => u.ativo).length} contas ativas` }), h('button', { class: 'btn', type: 'button', onclick: novo }, icone('mais'), 'Novo funcionário')),
    h('table', { class: 'tabela' }, h('thead', null, h('tr', null, ['Funcionário', 'Função', 'Permissões', 'Situação', 'Último acesso', ''].map((t) => h('th', { text: t })))), h('tbody', null, linhas)),
    h('section', { class: 'card' }, h('h3', { text: 'O que cada permissão libera' }), h('ul', { class: 'mudo' }, Object.entries(NOMES_PERM).map(([k, v]) => h('li', null, h('b', { text: k }), ' — ', v)),
      h('li', { text: 'Sem permissões: o funcionário só consegue ver o painel, sem alterar nada.' }), h('li', { text: 'Administrador: tudo, inclusive gerenciar funcionários.' }))));
}

// ================================================================= HISTÓRICO
async function paginaHistorico() {
  titulo('Histórico de alterações');
  const lista = h('ul', { class: 'hist' });
  const mais = h('button', { class: 'btn sec', type: 'button', text: 'Carregar mais', hidden: true });
  const grupo = h('select', { 'aria-label': 'Tipo de alteração' }, [['', 'Todas as alterações'], ['produtos', 'Produtos'], ['promocoes', 'Promoções'], ['temas', 'Temas e campanhas'], ['funcionarios', 'Funcionários'], ['acessos', 'Acessos (login)']].map(([v, t]) => h('option', { value: v, text: t })));
  const quem = h('select', { 'aria-label': 'Funcionário' }, h('option', { value: '', text: 'Todos os funcionários' }));
  const busca = h('input', { type: 'search', placeholder: 'Buscar no histórico…', maxlength: 60, 'aria-label': 'Buscar no histórico' });
  let antes = null, carregouUsuarios = false, req = 0;
  async function carregar(reset) {
    if (reset) { antes = null; lista.replaceChildren(); }
    const id = ++req;
    const q = new URLSearchParams();
    if (antes) q.set('antes', antes);
    if (grupo.value) q.set('grupo', grupo.value);
    if (quem.value) q.set('usuario', quem.value);
    if (busca.value.trim()) q.set('q', busca.value.trim());
    const d = await api('GET', 'admin/historico?' + q);
    if (id !== req) return;
    if (!carregouUsuarios) { quem.append(...d.usuarios.map((u) => h('option', { value: u.id, text: u.nome }))); carregouUsuarios = true; }
    lista.append(...d.itens.map(itemHistorico));
    if (!lista.children.length) lista.append(h('li', { class: 'mudo', text: 'Nada encontrado.' }));
    antes = d.itens.length ? d.itens[d.itens.length - 1].quando : null;
    mais.hidden = !d.temMais;
  }
  let t;
  grupo.addEventListener('change', () => carregar(true).catch(falha));
  quem.addEventListener('change', () => carregar(true).catch(falha));
  busca.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => carregar(true).catch(falha), 300); });
  mais.addEventListener('click', () => carregar(false).catch(falha));
  await carregar(true);
  return h('div', null, h('div', { class: 'ferramentas' }, h('div', { class: 'busca' }, icone('busca'), busca), grupo, quem),
    h('section', { class: 'card' }, lista, h('div', { class: 'linha', style: { 'justify-content': 'center', 'margin-top': '10px' } }, mais)));
}

// ================================================================= MINHA CONTA
async function paginaConta() {
  titulo('Minha conta');
  const atual = h('input', { type: 'password', autocomplete: 'current-password', maxlength: 128 });
  const nova = campoSenha('Nova senha', 'Mínimo de 10 caracteres. Seus outros aparelhos serão desconectados.');
  const conf = h('input', { type: 'password', autocomplete: 'new-password', maxlength: 128 });
  const bt = h('button', { class: 'btn', type: 'submit', text: 'Alterar senha' });
  const form = h('form', { class: 'pilha', novalidate: true }, campo('Senha atual', atual), nova.el, campo('Repita a nova senha', conf), h('div', null, bt));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (nova.inp.value.length < 10) return toast('A nova senha precisa ter pelo menos 10 caracteres.', 'erro');
    if (nova.inp.value !== conf.value) return toast('As senhas novas não são iguais.', 'erro');
    bt.disabled = true;
    try { await api('POST', 'auth/senha', { atual: atual.value, nova: nova.inp.value }); toast('Senha alterada.'); form.reset(); }
    catch (err) { falha(err); } finally { bt.disabled = false; }
  });
  const u = S.usuario;
  return h('div', { class: 'grade g2' },
    h('section', { class: 'card pilha' }, h('h2', { text: 'Seus dados' }),
      h('div', { class: 'quem' }, h('div', { class: 'avatar', text: u.nome[0].toUpperCase() }), h('div', null, h('b', { text: u.nome }), h('span', { text: '@' + u.usuario }))),
      h('p', { class: 'mudo', text: u.papel === 'admin' ? 'Administrador — acesso total.' : 'Funcionário — permissões: ' + (u.permissoes.join(', ') || 'só visualizar') }),
      h('button', { class: 'btn sec', type: 'button', onclick: sair }, icone('sair'), 'Sair da conta')),
    h('section', { class: 'card' }, h('h2', { text: 'Trocar senha' }), form));
}

// ================================================================= INÍCIO
(async () => {
  try {
    const eu = await api('GET', 'auth/eu');
    S.usuario = eu.usuario; S.csrf = eu.csrf; S.permissoes = eu.permissoesDisponiveis;
  } catch { return; }
  montarLayout();
  window.addEventListener('hashchange', navegar);
  window.addEventListener('beforeunload', (e) => { if (S.sujo) { e.preventDefault(); e.returnValue = ''; } });
  navegar();
})();
