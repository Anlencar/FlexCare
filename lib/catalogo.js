// Regras de preço, tema ativo e montagem do catálogo público. Usado pela loja e pelo painel.
import { TEMAS } from './validacao.js';

const json = (t, padrao) => { try { const v = JSON.parse(t); return v ?? padrao; } catch { return padrao; } };
const n = (v) => (v === null || v === undefined ? null : Number(v));

export function linhaProduto(r) {
  return {
    id: r.id, nome: r.nome, descricao: r.descricao, categoria: r.categoria, icone: r.icone,
    preco_cents: Number(r.preco_cents), frete_cents: Number(r.frete_cents), checkout_url: r.checkout_url,
    imagens: json(r.imagens, []), variantes: json(r.variantes, []), temas: json(r.temas, TEMAS),
    destaque: Number(r.destaque), ordem: Number(r.ordem), ativo: Number(r.ativo) === 1, versao: Number(r.versao),
    criado_em: n(r.criado_em), atualizado_em: n(r.atualizado_em), atualizado_por: r.atualizado_por,
  };
}
export const linhaCampanha = (r) => ({
  id: r.id, nome: r.nome, ativo: Number(r.ativo) === 1, inicio: n(r.inicio), fim: n(r.fim),
  dia_evento: n(r.dia_evento), desconto_pct: Number(r.desconto_pct),
});
export const linhaPromocao = (r) => ({
  produto_id: r.produto_id, campanha_id: r.campanha_id, tipo: r.tipo, valor: Number(r.valor),
  checkout_url: r.checkout_url || null, ativo: Number(r.ativo) === 1,
});

// Preço final de um produto numa campanha. Promoção do produto tem prioridade sobre o desconto geral da campanha.
export function calcularPreco(preco, promo, campanha) {
  let final = null, origem = null;
  if (promo && promo.ativo) {
    final = promo.tipo === 'percentual' ? Math.round(preco * (100 - promo.valor) / 100) : promo.valor;
    origem = 'produto';
  } else if (campanha && campanha.desconto_pct > 0) {
    final = Math.round(preco * (100 - campanha.desconto_pct) / 100);
    origem = 'campanha';
  }
  if (final !== null && final > 0 && final < preco) {
    return { final, original: preco, pct: Math.round((1 - final / preco) * 100), origem, checkout_url: origem === 'produto' ? promo.checkout_url : null };
  }
  return { final: preco, original: preco, pct: 0, origem: null, checkout_url: null };
}

// Qual tema está valendo agora. modo = 'auto' (pelas datas) ou o id de um tema forçado.
export function temaAtual(campanhas, modo, agora = Date.now()) {
  const porId = Object.fromEntries(campanhas.map((c) => [c.id, c]));
  if (modo !== 'auto' && porId[modo]) return porId[modo];
  const ativas = campanhas
    .filter((c) => c.id !== 'normal' && c.ativo && c.inicio && c.fim && agora >= c.inicio && agora < c.fim)
    .sort((a, b) => a.fim - b.fim);
  return ativas[0] || porId.normal || { id: 'normal', nome: 'Normal', desconto_pct: 0 };
}

export async function carregarTudo(db) {
  const [produtos, campanhas, promocoes, modo] = await Promise.all([
    db.query(`SELECT * FROM produtos ORDER BY ordem, criado_em`),
    db.query(`SELECT * FROM campanhas`),
    db.query(`SELECT * FROM promocoes`),
    db.query(`SELECT valor FROM config WHERE chave = 'tema_modo'`),
  ]);
  const camps = campanhas.map(linhaCampanha).sort((a, b) => TEMAS.indexOf(a.id) - TEMAS.indexOf(b.id));
  return {
    produtos: produtos.map(linhaProduto),
    campanhas: camps,
    promocoes: promocoes.map(linhaPromocao),
    modo: modo[0]?.valor || 'auto',
  };
}

const reais = (c) => 'R$ ' + (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Só os campos que a loja precisa. Nada de dados internos.
export function montarCatalogo({ produtos, campanhas, promocoes, modo }, agora = Date.now()) {
  const tema = temaAtual(campanhas, modo, agora);
  const promoDe = new Map(promocoes.filter((p) => p.campanha_id === tema.id).map((p) => [p.produto_id, p]));
  const visiveis = produtos.filter((p) => p.ativo && p.temas.includes(tema.id));
  const lista = visiveis.map((p) => {
    const pr = calcularPreco(p.preco_cents, promoDe.get(p.id), tema);
    return {
      id: p.id, name: p.nome, category: p.categoria, description: p.descricao, icon: p.icone || '✨',
      image: p.imagens[0] || '', price: reais(pr.final), old: pr.pct ? reais(pr.original) : null, pct: pr.pct,
      url: pr.checkout_url || p.checkout_url,
      shipping: p.frete_cents ? 'Frete: ' + reais(p.frete_cents) : 'Frete grátis',
      destaque: p.destaque,
      variants: p.variantes.map((v) => ({ label: v.nome, swatch: v.cor, image: v.imagem || '', url: v.checkout })),
    };
  });
  const destaques = visiveis.filter((p) => p.destaque > 0).sort((a, b) => a.destaque - b.destaque).slice(0, 3).map((p) => p.id);
  // Momento em que o tema muda sozinho (para a página recarregar).
  const proximaTroca = modo === 'auto'
    ? campanhas.filter((c) => c.id !== 'normal' && c.ativo && c.inicio && c.fim)
      .flatMap((c) => [c.inicio, c.fim]).filter((t) => t > agora).sort((a, b) => a - b)[0] || null
    : null;
  return {
    tema: { id: tema.id, nome: tema.nome, fim: tema.id !== 'normal' ? tema.fim : null, dia: tema.id !== 'normal' ? tema.dia_evento : null },
    temPromo: lista.some((p) => p.pct > 0),
    proximaTroca,
    destaques,
    produtos: lista,
  };
}
