// Validação de tudo que chega do navegador. O servidor nunca confia no front-end.
import { erro } from './http.js';

export const TEMAS = ['normal', 'natal', 'blackfriday'];

// Remove caracteres de controle e espaços extras.
const limpar = (v) => String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g, '').trim();

export function texto(v, campo, { min = 0, max = 200, multilinha = false } = {}) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string' && typeof v !== 'number') throw erro(400, `${campo}: valor inválido.`);
  let s = limpar(v);
  if (!multilinha) s = s.replace(/\s+/g, ' ');
  if (s.length < min) throw erro(400, min <= 1 ? `${campo} é obrigatório.` : `${campo} precisa ter pelo menos ${min} caracteres.`);
  if (s.length > max) throw erro(400, `${campo} pode ter no máximo ${max} caracteres.`);
  return s;
}

export function inteiro(v, campo, { min = 0, max = 1e9 } = {}) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) throw erro(400, `${campo}: número inválido.`);
  return n;
}

export const booleano = (v, campo) => {
  if (v === true || v === 1) return 1;
  if (v === false || v === 0) return 0;
  throw erro(400, `${campo}: valor inválido.`);
};

const RE_IMG_LOCAL = /^\/api\/img\/img_[A-Za-z0-9_-]{16}$/;

export function urlHttps(v, campo, { opcional = false } = {}) {
  const s = texto(v, campo, { max: 500 });
  if (!s) { if (opcional) return null; throw erro(400, `${campo} é obrigatório.`); }
  let u;
  try { u = new URL(s); } catch { throw erro(400, `${campo}: link inválido.`); }
  if (u.protocol !== 'https:' || u.username || u.password) throw erro(400, `${campo}: use um link que comece com https://`);
  return u.href;
}

export function urlImagem(v, campo) {
  const s = texto(v, campo, { max: 500 });
  if (RE_IMG_LOCAL.test(s)) return s;
  return urlHttps(s, campo);
}

export const idImagemLocal = (url) => (RE_IMG_LOCAL.test(url) ? url.split('/').pop() : null);

export function idValido(v, prefixo) {
  const s = String(v || '');
  if (!new RegExp(`^${prefixo}_[A-Za-z0-9_-]{4,32}$`).test(s)) throw erro(404, 'Não encontrado.');
  return s;
}

export function tema(v) {
  if (!TEMAS.includes(v)) throw erro(400, 'Tema inválido.');
  return v;
}

const RE_COR = /^(#[0-9a-fA-F]{6}|multicolor)$/;

function variantes(lista) {
  if (lista === undefined || lista === null) return [];
  if (!Array.isArray(lista) || lista.length > 10) throw erro(400, 'Variações: máximo de 10.');
  return lista.map((v, i) => {
    if (!v || typeof v !== 'object') throw erro(400, `Variação ${i + 1}: inválida.`);
    const cor = texto(v.cor || '#888888', `Cor da variação ${i + 1}`, { max: 10 });
    if (!RE_COR.test(cor)) throw erro(400, `Cor da variação ${i + 1}: inválida.`);
    return {
      nome: texto(v.nome, `Nome da variação ${i + 1}`, { min: 1, max: 30 }),
      cor,
      imagem: v.imagem ? urlImagem(v.imagem, `Imagem da variação ${i + 1}`) : null,
      checkout: urlHttps(v.checkout, `Link de checkout da variação ${i + 1}`),
    };
  });
}

export function promocao(p, campo) {
  if (!p || typeof p !== 'object') throw erro(400, `${campo}: inválida.`);
  const tipo = p.tipo === 'percentual' ? 'percentual' : p.tipo === 'preco' ? 'preco' : null;
  if (!tipo) throw erro(400, `${campo}: escolha preço fixo ou porcentagem.`);
  return {
    tipo,
    valor: tipo === 'percentual' ? inteiro(p.valor, `${campo}: desconto (%)`, { min: 1, max: 95 })
      : inteiro(p.valor, `${campo}: preço promocional`, { min: 1, max: 10_000_000 }),
    ativo: booleano(p.ativo ?? true, `${campo}: ativo`),
    checkout_url: urlHttps(p.checkout_url, `${campo}: link de checkout`, { opcional: true }),
  };
}

export function produto(b) {
  const imagens = b.imagens ?? [];
  if (!Array.isArray(imagens) || imagens.length > 12) throw erro(400, 'Imagens: máximo de 12.');
  const temas = b.temas ?? TEMAS;
  if (!Array.isArray(temas) || temas.some((t) => !TEMAS.includes(t))) throw erro(400, 'Temas inválidos.');
  let promocoes = null;
  if (b.promocoes !== undefined) {
    if (!b.promocoes || typeof b.promocoes !== 'object' || Array.isArray(b.promocoes)) throw erro(400, 'Promoções inválidas.');
    promocoes = {};
    for (const t of TEMAS) if (b.promocoes[t]) promocoes[t] = promocao(b.promocoes[t], `Promoção (${t})`);
  }
  return {
    nome: texto(b.nome, 'Nome', { min: 2, max: 120 }),
    descricao: texto(b.descricao, 'Descrição', { max: 600, multilinha: true }),
    categoria: texto(b.categoria, 'Categoria', { min: 2, max: 40 }),
    icone: texto(b.icone, 'Ícone', { max: 8 }),
    preco_cents: inteiro(b.preco_cents, 'Preço original', { min: 1, max: 10_000_000 }),
    frete_cents: inteiro(b.frete_cents ?? 0, 'Frete', { min: 0, max: 100_000 }),
    checkout_url: urlHttps(b.checkout_url, 'Link de checkout'),
    imagens: [...new Set(imagens.map((u, i) => urlImagem(u, `Imagem ${i + 1}`)))],
    variantes: variantes(b.variantes),
    temas: [...new Set(temas)],
    destaque: booleano(b.destaque ?? false, 'Destaque'),
    ativo: booleano(b.ativo ?? true, 'Ativo'),
    ordem: inteiro(b.ordem ?? 0, 'Ordem', { min: 0, max: 1_000_000 }),
    promocoes,
  };
}

export function usuarioLogin(v) {
  const s = texto(v, 'Usuário', { min: 3, max: 32 }).toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(s)) throw erro(400, 'Usuário: use só letras minúsculas, números, ponto, hífen ou _.');
  return s;
}

export function senhaNova(v, usuario) {
  if (typeof v !== 'string') throw erro(400, 'Senha inválida.');
  if (v.length < 10) throw erro(400, 'A senha precisa ter pelo menos 10 caracteres.');
  if (v.length > 128) throw erro(400, 'A senha pode ter no máximo 128 caracteres.');
  if (usuario && v.toLowerCase().includes(usuario.toLowerCase())) throw erro(400, 'A senha não pode conter o nome de usuário.');
  if (/^(.)\1+$/.test(v) || /^(0123456789|1234567890|senha|password)/i.test(v)) throw erro(400, 'Essa senha é fácil demais de adivinhar.');
  return v;
}
