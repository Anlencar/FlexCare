// Rotas do painel: painel inicial, produtos, promoções, temas/campanhas, imagens, funcionários e histórico.
import { erro, enviar } from './http.js';
import { exigir, pode, novoId, registroHistorico, gerarHash, encerrarSessoesDoUsuario, PERMISSOES } from './seguranca.js';
import * as V from './validacao.js';
import { carregarTudo, calcularPreco, temaAtual, linhaProduto } from './catalogo.js';

const reais = (c) => 'R$ ' + (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NOMES_TEMA = { normal: 'Normal', natal: 'Natal', blackfriday: 'Black Friday' };

// ---------- Painel inicial ----------
export async function painel({ db, res }) {
  const dados = await carregarTudo(db);
  const tema = temaAtual(dados.campanhas, dados.modo);
  const promoAtiva = new Set(dados.promocoes.filter((p) => p.ativo).map((p) => p.produto_id));
  const promoTema = dados.produtos.filter((p) => {
    const pr = dados.promocoes.find((x) => x.produto_id === p.id && x.campanha_id === tema.id);
    return p.ativo && p.temas.includes(tema.id) && calcularPreco(p.preco_cents, pr, tema).pct > 0;
  }).length;
  const categorias = {};
  for (const p of dados.produtos) categorias[p.categoria] = (categorias[p.categoria] || 0) + 1;
  const historico = await db.query(`SELECT * FROM historico ORDER BY quando DESC LIMIT 12`);
  const ultima = dados.produtos.reduce((m, p) => (p.atualizado_em > (m?.atualizado_em || 0) ? p : m), null);
  enviar(res, 200, {
    totais: {
      produtos: dados.produtos.length,
      ativos: dados.produtos.filter((p) => p.ativo).length,
      inativos: dados.produtos.filter((p) => !p.ativo).length,
      emPromocao: dados.produtos.filter((p) => promoAtiva.has(p.id)).length,
      emPromocaoAgora: promoTema,
      destaques: dados.produtos.filter((p) => p.destaque > 0 && p.ativo).length,
      categorias: Object.keys(categorias).length,
    },
    categorias: Object.entries(categorias).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd),
    tema: { id: tema.id, nome: tema.nome, modo: dados.modo, fim: tema.fim || null },
    campanhas: dados.campanhas,
    ultimaAlteracao: ultima ? { produto: ultima.nome, quando: ultima.atualizado_em, por: ultima.atualizado_por } : null,
    historico: historico.map(linhaHistorico),
  });
}

const linhaHistorico = (h) => ({
  id: h.id, quando: Number(h.quando), usuario_id: h.usuario_id, usuario_nome: h.usuario_nome,
  acao: h.acao, alvo_tipo: h.alvo_tipo, alvo_id: h.alvo_id, resumo: h.resumo,
});

// ---------- Produtos ----------
function comPrecos(p, dados) {
  const promocoes = {};
  const precos = {};
  for (const c of dados.campanhas) {
    const pr = dados.promocoes.find((x) => x.produto_id === p.id && x.campanha_id === c.id) || null;
    if (pr) promocoes[c.id] = pr;
    precos[c.id] = calcularPreco(p.preco_cents, pr, c);
  }
  return { ...p, promocoes, precos };
}

export async function listarProdutos({ db, res }) {
  const dados = await carregarTudo(db);
  enviar(res, 200, {
    produtos: dados.produtos.map((p) => comPrecos(p, dados)),
    campanhas: dados.campanhas,
    temaAtual: temaAtual(dados.campanhas, dados.modo).id,
    categorias: [...new Set(dados.produtos.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  });
}

async function buscarProduto(db, id) {
  V.idValido(id, 'prd');
  const r = await db.query(`SELECT * FROM produtos WHERE id = $1`, [id]);
  if (!r.length) throw erro(404, 'Produto não encontrado. Ele pode ter sido excluído.');
  return linhaProduto(r[0]);
}

export async function verProduto({ db, res, params }) {
  const p = await buscarProduto(db, params.id);
  const dados = await carregarTudo(db);
  enviar(res, 200, { produto: comPrecos(p, dados) });
}

const mesmo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const promoIgual = (a, b) => (!a && !b) || (a && b && a.tipo === b.tipo && a.valor === b.valor && !!a.ativo === !!b.ativo && (a.checkout_url || null) === (b.checkout_url || null));

function opsPromocoes(usuario, prod, atuais, novas) {
  const ops = [];
  const agora = Date.now();
  for (const t of V.TEMAS) {
    const a = atuais[t] || null, n = novas[t] || null;
    if (promoIgual(a, n)) continue;
    if (!n) {
      ops.push([`DELETE FROM promocoes WHERE produto_id = $1 AND campanha_id = $2`, [prod.id, t]]);
      ops.push(registroHistorico(usuario, 'promocao_removida', 'produto', prod.id, `Promoção removida (${NOMES_TEMA[t]}): ${prod.nome}`));
      continue;
    }
    ops.push([`INSERT INTO promocoes (produto_id, campanha_id, tipo, valor, checkout_url, ativo, atualizado_em) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (produto_id, campanha_id) DO UPDATE SET tipo = $3, valor = $4, checkout_url = $5, ativo = $6, atualizado_em = $7`,
      [prod.id, t, n.tipo, n.valor, n.checkout_url, n.ativo, agora]]);
    const pr = calcularPreco(prod.preco_cents, { ...n, ativo: true }, null);
    const desc = n.tipo === 'percentual' ? `${n.valor}% (${reais(pr.final)})` : reais(n.valor);
    const acao = !a ? (n.ativo ? 'promocao_ativada' : 'promocao_alterada')
      : (!!a.ativo !== !!n.ativo ? (n.ativo ? 'promocao_ativada' : 'promocao_desativada') : 'promocao_alterada');
    const verbo = { promocao_ativada: 'Promoção ativada', promocao_desativada: 'Promoção desativada', promocao_alterada: 'Promoção alterada' }[acao];
    ops.push(registroHistorico(usuario, acao, 'produto', prod.id, `${verbo} (${NOMES_TEMA[t]}): ${prod.nome} por ${desc}`));
  }
  return ops;
}

async function promocoesDe(db, id) {
  const r = await db.query(`SELECT * FROM promocoes WHERE produto_id = $1`, [id]);
  return Object.fromEntries(r.map((x) => [x.campanha_id, { tipo: x.tipo, valor: Number(x.valor), checkout_url: x.checkout_url || null, ativo: Number(x.ativo) === 1 }]));
}

async function proximoDestaque(db) {
  const [r] = await db.query(`SELECT COALESCE(MAX(destaque), 0) AS m FROM produtos`);
  return Number(r.m) + 1;
}

const imagensLocais = (p) => [...p.imagens, ...p.variantes.map((v) => v.imagem).filter(Boolean)].map(V.idImagemLocal).filter(Boolean);

// Apaga imagens enviadas que nenhum produto usa mais.
async function limparImagens(db, ids) {
  for (const id of ids) {
    const [r] = await db.query(`SELECT COUNT(*) AS n FROM produtos WHERE imagens LIKE $1 OR variantes LIKE $1`, ['%' + id + '%']);
    if (Number(r.n) === 0) await db.query(`DELETE FROM imagens WHERE id = $1`, [id]);
  }
  if (Math.random() < 0.2) {
    const velhas = await db.query(`SELECT id FROM imagens WHERE criado_em < $1 LIMIT 30`, [Date.now() - 24 * 3600 * 1000]);
    for (const { id } of velhas) {
      const [r] = await db.query(`SELECT COUNT(*) AS n FROM produtos WHERE imagens LIKE $1 OR variantes LIKE $1`, ['%' + id + '%']);
      if (Number(r.n) === 0) await db.query(`DELETE FROM imagens WHERE id = $1`, [id]);
    }
  }
}

export async function criarProduto({ db, res, sessao, corpo }) {
  const u = sessao.usuario;
  exigir(u, 'produtos');
  const v = V.produto(corpo);
  if (v.promocoes && Object.keys(v.promocoes).length) exigir(u, 'precos');
  const id = novoId('prd').slice(0, 20);
  const agora = Date.now();
  const destaque = v.destaque ? await proximoDestaque(db) : 0;
  const ordem = v.ordem || (Number((await db.query(`SELECT COALESCE(MAX(ordem), 0) AS m FROM produtos`))[0].m) + 10);
  const ops = [
    [`INSERT INTO produtos (id, nome, descricao, categoria, icone, preco_cents, frete_cents, checkout_url, imagens, variantes, temas, destaque, ordem, ativo, versao, criado_em, atualizado_em, atualizado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,1,$15,$15,$16)`,
      [id, v.nome, v.descricao, v.categoria, v.icone, v.preco_cents, v.frete_cents, v.checkout_url, JSON.stringify(v.imagens),
        JSON.stringify(v.variantes), JSON.stringify(v.temas), destaque, ordem, v.ativo, agora, u.nome]],
    registroHistorico(u, 'produto_criado', 'produto', id, `Produto adicionado: ${v.nome} (${reais(v.preco_cents)})`),
  ];
  if (v.promocoes) ops.push(...opsPromocoes(u, { id, nome: v.nome, preco_cents: v.preco_cents }, {}, v.promocoes));
  await db.transacao(ops);
  enviar(res, 201, { id });
}

const ROTULOS = { nome: 'nome', descricao: 'descrição', categoria: 'categoria', icone: 'ícone', frete_cents: 'frete', checkout_url: 'link de checkout', imagens: 'imagens', variantes: 'variações', temas: 'temas', ordem: 'ordem' };

export async function editarProduto({ db, res, sessao, corpo, params }) {
  const u = sessao.usuario;
  exigir(u, 'produtos');
  const atual = await buscarProduto(db, params.id);
  if (corpo.versao !== atual.versao) throw erro(409, 'Este produto foi alterado por outra pessoa enquanto você editava. Recarregue para ver a versão mais nova.');
  const v = V.produto(corpo);
  const promosAtuais = await promocoesDe(db, atual.id);
  const mudouPreco = v.preco_cents !== atual.preco_cents;
  const mudouPromo = v.promocoes && V.TEMAS.some((t) => !promoIgual(promosAtuais[t], v.promocoes[t]));
  if (mudouPreco || mudouPromo) exigir(u, 'precos');

  const destaque = v.destaque ? (atual.destaque > 0 ? atual.destaque : await proximoDestaque(db)) : 0;
  const agora = Date.now();
  const ops = [[
    `UPDATE produtos SET nome=$1, descricao=$2, categoria=$3, icone=$4, preco_cents=$5, frete_cents=$6, checkout_url=$7, imagens=$8, variantes=$9,
      temas=$10, destaque=$11, ordem=$12, ativo=$13, versao=versao+1, atualizado_em=$14, atualizado_por=$15 WHERE id=$16 AND versao=$17 RETURNING id`,
    [v.nome, v.descricao, v.categoria, v.icone, v.preco_cents, v.frete_cents, v.checkout_url, JSON.stringify(v.imagens), JSON.stringify(v.variantes),
      JSON.stringify(v.temas), destaque, v.ordem, v.ativo, agora, u.nome, atual.id, atual.versao]]];

  const campos = Object.keys(ROTULOS).filter((k) => !mesmo(v[k], atual[k])).map((k) => ROTULOS[k]);
  if (campos.length) ops.push(registroHistorico(u, 'produto_editado', 'produto', atual.id, `Produto editado: ${v.nome} — ${campos.join(', ')}`));
  if (mudouPreco) ops.push(registroHistorico(u, 'preco_alterado', 'produto', atual.id, `Preço alterado: ${v.nome} de ${reais(atual.preco_cents)} para ${reais(v.preco_cents)}`));
  if (!!v.ativo !== atual.ativo) ops.push(registroHistorico(u, v.ativo ? 'produto_ativado' : 'produto_desativado', 'produto', atual.id, `Produto ${v.ativo ? 'ativado' : 'desativado'}: ${v.nome}`));
  if (!!destaque !== atual.destaque > 0) ops.push(registroHistorico(u, 'destaque_alterado', 'produto', atual.id, `${destaque ? 'Colocado em' : 'Removido do'} destaque: ${v.nome}`));
  if (v.promocoes) ops.push(...opsPromocoes(u, { id: atual.id, nome: v.nome, preco_cents: v.preco_cents }, promosAtuais, v.promocoes));

  const r = await db.transacao(ops);
  if (!r[0] || !r[0].length) throw erro(409, 'Este produto foi alterado por outra pessoa. Recarregue e tente de novo.');
  const removidas = imagensLocais(atual).filter((id) => !imagensLocais(v).includes(id));
  await limparImagens(db, removidas);
  enviar(res, 200, { ok: true });
}

export async function alterarStatus({ db, res, sessao, corpo, params }) {
  const u = sessao.usuario;
  exigir(u, 'produtos');
  const p = await buscarProduto(db, params.id);
  const ativo = V.booleano(corpo.ativo, 'Ativo');
  if (ativo === (p.ativo ? 1 : 0)) return enviar(res, 200, { ok: true });
  await db.transacao([
    [`UPDATE produtos SET ativo=$1, versao=versao+1, atualizado_em=$2, atualizado_por=$3 WHERE id=$4`, [ativo, Date.now(), u.nome, p.id]],
    registroHistorico(u, ativo ? 'produto_ativado' : 'produto_desativado', 'produto', p.id, `Produto ${ativo ? 'ativado' : 'desativado'}: ${p.nome}`),
  ]);
  enviar(res, 200, { ok: true });
}

export async function alterarDestaque({ db, res, sessao, corpo, params }) {
  const u = sessao.usuario;
  exigir(u, 'produtos');
  const p = await buscarProduto(db, params.id);
  const quer = V.booleano(corpo.destaque, 'Destaque');
  if (quer === (p.destaque > 0 ? 1 : 0)) return enviar(res, 200, { ok: true });
  const valor = quer ? await proximoDestaque(db) : 0;
  await db.transacao([
    [`UPDATE produtos SET destaque=$1, versao=versao+1, atualizado_em=$2, atualizado_por=$3 WHERE id=$4`, [valor, Date.now(), u.nome, p.id]],
    registroHistorico(u, 'destaque_alterado', 'produto', p.id, `${quer ? 'Colocado em' : 'Removido do'} destaque: ${p.nome}`),
  ]);
  enviar(res, 200, { ok: true });
}

export async function excluirProduto({ db, res, sessao, params, corpo }) {
  const u = sessao.usuario;
  exigir(u, 'excluir');
  const p = await buscarProduto(db, params.id);
  if (corpo.confirmar !== p.id) throw erro(400, 'Confirmação de exclusão ausente.');
  await db.transacao([
    [`DELETE FROM promocoes WHERE produto_id = $1`, [p.id]],
    [`DELETE FROM produtos WHERE id = $1`, [p.id]],
    registroHistorico(u, 'produto_excluido', 'produto', p.id, `Produto excluído: ${p.nome}`, { nome: p.nome, preco_cents: p.preco_cents, checkout_url: p.checkout_url }),
  ]);
  await limparImagens(db, imagensLocais(p));
  enviar(res, 200, { ok: true });
}

// ---------- Promoções (tela própria) ----------
export async function salvarPromocao({ db, res, sessao, corpo, params }) {
  const u = sessao.usuario;
  exigir(u, 'precos');
  const p = await buscarProduto(db, params.id);
  const t = V.tema(params.tema);
  const atuais = await promocoesDe(db, p.id);
  const nova = corpo.remover === true ? null : V.promocao(corpo, 'Promoção');
  const ops = opsPromocoes(u, p, { [t]: atuais[t] }, { [t]: nova });
  if (ops.length) await db.transacao(ops);
  enviar(res, 200, { ok: true });
}

// ---------- Temas e campanhas ----------
export async function listarCampanhas({ db, res }) {
  const dados = await carregarTudo(db);
  const atual = temaAtual(dados.campanhas, dados.modo);
  enviar(res, 200, {
    modo: dados.modo,
    temaAtual: atual.id,
    campanhas: dados.campanhas.map((c) => ({
      ...c,
      participantes: dados.produtos.filter((p) => p.temas.includes(c.id)).map((p) => p.id),
      promocoes: dados.promocoes.filter((x) => x.campanha_id === c.id && x.ativo).length,
    })),
    produtos: dados.produtos.map((p) => ({ id: p.id, nome: p.nome, categoria: p.categoria, ativo: p.ativo, imagem: p.imagens[0] || '', icone: p.icone })),
  });
}

export async function alterarModoTema({ db, res, sessao, corpo }) {
  const u = sessao.usuario;
  exigir(u, 'temas');
  const modo = corpo.modo === 'auto' ? 'auto' : V.tema(corpo.modo);
  const desc = modo === 'auto' ? 'Automático (pelas datas das campanhas)' : `Forçado: ${NOMES_TEMA[modo]}`;
  await db.transacao([
    [`INSERT INTO config (chave, valor) VALUES ('tema_modo', $1) ON CONFLICT (chave) DO UPDATE SET valor = $1`, [modo]],
    registroHistorico(u, 'tema_alterado', 'tema', modo, `Tema do site alterado para ${desc}`),
  ]);
  enviar(res, 200, { ok: true });
}

export async function editarCampanha({ db, res, sessao, corpo, params }) {
  const u = sessao.usuario;
  exigir(u, 'temas');
  const id = V.tema(params.id);
  const desconto = V.inteiro(corpo.desconto_pct ?? 0, 'Desconto da campanha', { min: 0, max: 90 });
  let ativo = 1, inicio = null, fim = null, dia = null;
  if (id !== 'normal') {
    ativo = V.booleano(corpo.ativo, 'Ativa');
    const data = (v, campo, opcional) => {
      if ((v === null || v === undefined || v === '') && opcional) return null;
      return V.inteiro(v, campo, { min: Date.UTC(2020, 0, 1), max: Date.UTC(2100, 0, 1) });
    };
    inicio = data(corpo.inicio, 'Data de início');
    fim = data(corpo.fim, 'Data de encerramento');
    dia = data(corpo.dia_evento, 'Dia do evento', true);
    if (fim <= inicio) throw erro(400, 'A data de encerramento precisa ser depois do início.');
  }
  await db.transacao([
    [`UPDATE campanhas SET ativo=$1, inicio=$2, fim=$3, dia_evento=$4, desconto_pct=$5, atualizado_em=$6 WHERE id=$7`, [ativo, inicio, fim, dia, desconto, Date.now(), id]],
    registroHistorico(u, 'campanha_alterada', 'tema', id, `Campanha ${NOMES_TEMA[id]} alterada${id !== 'normal' ? (ativo ? ' (ativa)' : ' (desligada)') : ''}${desconto ? `, desconto geral de ${desconto}%` : ''}`),
  ]);
  enviar(res, 200, { ok: true });
}

export async function participantesCampanha({ db, res, sessao, corpo, params }) {
  const u = sessao.usuario;
  exigir(u, 'temas');
  const t = V.tema(params.id);
  if (!Array.isArray(corpo.produtos) || corpo.produtos.length > 5000) throw erro(400, 'Lista de produtos inválida.');
  const quer = new Set(corpo.produtos.map((x) => String(x)));
  const todos = (await db.query(`SELECT id, nome, temas FROM produtos`)).map((r) => ({ ...r, temas: JSON.parse(r.temas || '[]') }));
  const ops = [];
  let ent = 0, sai = 0;
  for (const p of todos) {
    const tem = p.temas.includes(t), deve = quer.has(p.id);
    if (tem === deve) continue;
    const novos = deve ? [...p.temas, t] : p.temas.filter((x) => x !== t);
    deve ? ent++ : sai++;
    ops.push([`UPDATE produtos SET temas=$1, versao=versao+1, atualizado_em=$2, atualizado_por=$3 WHERE id=$4`, [JSON.stringify(V.TEMAS.filter((x) => novos.includes(x))), Date.now(), u.nome, p.id]]);
  }
  if (ops.length) {
    ops.push(registroHistorico(u, 'campanha_alterada', 'tema', t, `Produtos da campanha ${NOMES_TEMA[t]}: ${ent} adicionados, ${sai} retirados`));
    await db.transacao(ops);
  }
  enviar(res, 200, { ok: true, adicionados: ent, retirados: sai });
}

// ---------- Imagens ----------
const TIPOS = [
  { mime: 'image/jpeg', ok: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ok: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', ok: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
];
const MAX_IMAGEM = 2 * 1024 * 1024;

export async function enviarImagem({ db, res, sessao, corpo }) {
  const u = sessao.usuario;
  exigir(u, 'produtos');
  if (typeof corpo.dados !== 'string' || corpo.dados.length > Math.ceil(MAX_IMAGEM * 4 / 3) + 8) throw erro(413, 'Imagem grande demais (máximo 2 MB).');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(corpo.dados)) throw erro(400, 'Arquivo de imagem inválido.');
  const buf = Buffer.from(corpo.dados, 'base64');
  if (buf.length > MAX_IMAGEM) throw erro(413, 'Imagem grande demais (máximo 2 MB).');
  if (buf.length < 64) throw erro(415, 'Arquivo de imagem inválido.');
  const tipo = TIPOS.find((t) => t.ok(buf));
  if (!tipo) throw erro(415, 'Formato não aceito. Envie JPG, PNG ou WEBP.');
  const [{ n }] = await db.query(`SELECT COUNT(*) AS n FROM imagens WHERE criado_por = $1 AND criado_em > $2`, [u.id, Date.now() - 3600 * 1000]);
  if (Number(n) >= 150) throw erro(429, 'Limite de envios por hora atingido. Tente mais tarde.');
  const id = 'img_' + novoId('x').slice(2, 18);
  await db.query(`INSERT INTO imagens (id, mime, dados, tamanho, criado_em, criado_por) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, tipo.mime, buf.toString('base64'), buf.length, Date.now(), u.id]);
  enviar(res, 201, { url: `/api/img/${id}` });
}

// ---------- Funcionários (só administrador) ----------
const linhaUsuario = (r) => ({
  id: r.id, usuario: r.usuario, nome: r.nome, papel: r.papel, permissoes: JSON.parse(r.permissoes || '[]'),
  ativo: Number(r.ativo) === 1, criado_em: Number(r.criado_em), ultimo_login: r.ultimo_login ? Number(r.ultimo_login) : null,
});

function lerPermissoes(papel, lista) {
  if (papel === 'admin') return [];
  if (!Array.isArray(lista)) throw erro(400, 'Permissões inválidas.');
  return [...new Set(lista.filter((p) => Object.hasOwn(PERMISSOES, p)))];
}
const lerPapel = (v) => { if (v !== 'admin' && v !== 'funcionario') throw erro(400, 'Função inválida.'); return v; };

export async function listarUsuarios({ db, res, sessao }) {
  exigir(sessao.usuario, 'funcionarios');
  const r = await db.query(`SELECT * FROM usuarios ORDER BY ativo DESC, nome`);
  enviar(res, 200, { usuarios: r.map(linhaUsuario), permissoes: PERMISSOES });
}

export async function criarUsuario({ db, res, sessao, corpo }) {
  const u = sessao.usuario;
  exigir(u, 'funcionarios');
  const usuario = V.usuarioLogin(corpo.usuario);
  const nome = V.texto(corpo.nome, 'Nome', { min: 2, max: 60 });
  const papel = lerPapel(corpo.papel);
  const permissoes = lerPermissoes(papel, corpo.permissoes);
  const senha = V.senhaNova(corpo.senha, usuario);
  const existe = await db.query(`SELECT 1 AS x FROM usuarios WHERE usuario = $1`, [usuario]);
  if (existe.length) throw erro(409, 'Já existe um funcionário com esse usuário.');
  const id = novoId('usr');
  const agora = Date.now();
  await db.transacao([
    [`INSERT INTO usuarios (id, usuario, nome, senha_hash, papel, permissoes, ativo, criado_em, atualizado_em) VALUES ($1,$2,$3,$4,$5,$6,1,$7,$7)`,
      [id, usuario, nome, await gerarHash(senha), papel, JSON.stringify(permissoes), agora]],
    registroHistorico(u, 'funcionario_criado', 'usuario', id, `Funcionário criado: ${nome} (${usuario}) — ${papel === 'admin' ? 'administrador' : 'funcionário'}`),
  ]);
  enviar(res, 201, { id });
}

async function buscarUsuario(db, id) {
  V.idValido(id, 'usr');
  const r = await db.query(`SELECT * FROM usuarios WHERE id = $1`, [id]);
  if (!r.length) throw erro(404, 'Funcionário não encontrado.');
  return linhaUsuario(r[0]);
}

export async function editarUsuario({ db, res, sessao, corpo, params }) {
  const u = sessao.usuario;
  exigir(u, 'funcionarios');
  const alvo = await buscarUsuario(db, params.id);
  const nome = V.texto(corpo.nome, 'Nome', { min: 2, max: 60 });
  const papel = lerPapel(corpo.papel);
  const permissoes = lerPermissoes(papel, corpo.permissoes);
  const ativo = V.booleano(corpo.ativo, 'Ativo');
  if (alvo.id === u.id && (papel !== 'admin' || !ativo)) throw erro(400, 'Você não pode tirar o seu próprio acesso de administrador nem desativar a sua conta.');
  if (alvo.papel === 'admin' && alvo.ativo && (papel !== 'admin' || !ativo)) {
    const [{ n }] = await db.query(`SELECT COUNT(*) AS n FROM usuarios WHERE papel = 'admin' AND ativo = 1`);
    if (Number(n) <= 1) throw erro(400, 'É preciso manter pelo menos um administrador ativo.');
  }
  const ops = [[`UPDATE usuarios SET nome=$1, papel=$2, permissoes=$3, ativo=$4, atualizado_em=$5 WHERE id=$6`,
    [nome, papel, JSON.stringify(permissoes), ativo, Date.now(), alvo.id]]];
  if (alvo.ativo && !ativo) ops.push(registroHistorico(u, 'funcionario_desativado', 'usuario', alvo.id, `Conta desativada: ${alvo.nome} (${alvo.usuario})`));
  else if (!alvo.ativo && ativo) ops.push(registroHistorico(u, 'funcionario_reativado', 'usuario', alvo.id, `Conta reativada: ${alvo.nome} (${alvo.usuario})`));
  if (nome !== alvo.nome || papel !== alvo.papel || !mesmo(permissoes, alvo.permissoes)) {
    ops.push(registroHistorico(u, 'funcionario_editado', 'usuario', alvo.id, `Funcionário editado: ${nome} (${alvo.usuario}) — ${papel === 'admin' ? 'administrador' : 'permissões: ' + (permissoes.join(', ') || 'nenhuma')}`));
  }
  await db.transacao(ops);
  if (!ativo || papel !== alvo.papel || !mesmo(permissoes, alvo.permissoes)) await encerrarSessoesDoUsuario(db, alvo.id, alvo.id === u.id ? sessao.sessaoId : '');
  enviar(res, 200, { ok: true });
}

export async function redefinirSenha({ db, res, sessao, corpo, params }) {
  const u = sessao.usuario;
  exigir(u, 'funcionarios');
  const alvo = await buscarUsuario(db, params.id);
  const senha = V.senhaNova(corpo.senha, alvo.usuario);
  await db.transacao([
    [`UPDATE usuarios SET senha_hash=$1, atualizado_em=$2 WHERE id=$3`, [await gerarHash(senha), Date.now(), alvo.id]],
    registroHistorico(u, 'senha_redefinida', 'usuario', alvo.id, `Senha redefinida: ${alvo.nome} (${alvo.usuario})`),
  ]);
  await encerrarSessoesDoUsuario(db, alvo.id, alvo.id === u.id ? sessao.sessaoId : '');
  await db.query(`DELETE FROM tentativas_login WHERE chave = $1`, ['u:' + alvo.usuario]);
  enviar(res, 200, { ok: true });
}

// ---------- Histórico ----------
const GRUPOS = {
  produtos: ['produto_criado', 'produto_editado', 'produto_excluido', 'produto_ativado', 'produto_desativado', 'preco_alterado', 'destaque_alterado'],
  promocoes: ['promocao_ativada', 'promocao_desativada', 'promocao_alterada', 'promocao_removida'],
  temas: ['tema_alterado', 'campanha_alterada'],
  funcionarios: ['funcionario_criado', 'funcionario_editado', 'funcionario_desativado', 'funcionario_reativado', 'senha_redefinida', 'senha_alterada'],
  acessos: ['login'],
};

export async function historico({ db, res, query }) {
  const filtros = [], params = [];
  const add = (sql, v) => { params.push(v); filtros.push(sql.replace('?', '$' + params.length)); };
  const antes = Number(query.get('antes'));
  if (Number.isFinite(antes) && antes > 0) add('quando < ?', antes);
  const grupo = query.get('grupo');
  if (grupo && GRUPOS[grupo]) {
    const marcas = GRUPOS[grupo].map((a) => { params.push(a); return '$' + params.length; });
    filtros.push(`acao IN (${marcas.join(',')})`);
  }
  const usr = query.get('usuario');
  if (usr && /^usr_[A-Za-z0-9_-]{4,32}$/.test(usr)) add('usuario_id = ?', usr);
  const busca = (query.get('q') || '').slice(0, 60);
  if (busca) add('LOWER(resumo) LIKE ?', '%' + busca.toLowerCase().replace(/[%_\\]/g, '') + '%');
  const where = filtros.length ? 'WHERE ' + filtros.join(' AND ') : '';
  const r = await db.query(`SELECT * FROM historico ${where} ORDER BY quando DESC LIMIT 51`, params);
  const usuarios = await db.query(`SELECT id, nome FROM usuarios ORDER BY nome`);
  enviar(res, 200, { itens: r.slice(0, 50).map(linhaHistorico), temMais: r.length > 50, usuarios });
}

export { pode };
