// Senhas (scrypt), sessões, limite de tentativas, permissões e histórico.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { erro, lerCookies, ehHttps, ipDe } from './http.js';

const scrypt = promisify(crypto.scrypt);
const N = 32768, R = 8, P = 1, TAM = 64; // ~32 MB de memória por hash
const MAXMEM = 128 * N * R * 2;

export async function gerarHash(senha) {
  const sal = crypto.randomBytes(16);
  const h = await scrypt(senha.normalize('NFKC'), sal, TAM, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${h.toString('base64')}`;
}

export async function conferirSenha(senha, armazenado) {
  const [alg, n, r, p, salB64, hB64] = String(armazenado).split('$');
  if (alg !== 'scrypt') return false;
  const esperado = Buffer.from(hB64 || '', 'base64');
  const h = await scrypt(senha.normalize('NFKC'), Buffer.from(salB64 || '', 'base64'), esperado.length || TAM,
    { N: +n, r: +r, p: +p, maxmem: 128 * +n * +r * 2 });
  return esperado.length > 0 && crypto.timingSafeEqual(h, esperado);
}

// Hash "falso" usado quando o usuário não existe, para o tempo de resposta não revelar isso.
let hashFalso;
export async function gastarTempo(senha) {
  hashFalso ||= await gerarHash('senha-inexistente-' + crypto.randomBytes(8).toString('hex'));
  await conferirSenha(senha, hashFalso);
}

export const novoId = (prefixo) => `${prefixo}_${crypto.randomBytes(12).toString('base64url')}`;
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');

export function iguais(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------- Sessões ----------
const INATIVIDADE = 2 * 60 * 60 * 1000;   // 2 h sem uso → sai
const DURACAO_MAX = 12 * 60 * 60 * 1000;  // 12 h no máximo

export const nomeCookie = (req) => (ehHttps(req) ? '__Host-fc_admin' : 'fc_admin');

function cookieSessao(req, valor, maxAge) {
  return `${nomeCookie(req)}=${valor}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${ehHttps(req) ? '; Secure' : ''}`;
}

export async function criarSessao(db, req, usuarioId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  const agora = Date.now();
  await db.query(`INSERT INTO sessoes (id_hash, usuario_id, csrf, criado_em, ultimo_uso, expira_em, ip, agente) VALUES ($1,$2,$3,$4,$4,$5,$6,$7)`,
    [sha256(token), usuarioId, csrf, agora, agora + DURACAO_MAX, ipDe(req), String(req.headers['user-agent'] || '').slice(0, 200)]);
  // Limpeza de sessões vencidas (barato, de vez em quando).
  if (Math.random() < 0.1) await db.query(`DELETE FROM sessoes WHERE expira_em < $1 OR ultimo_uso < $2`, [agora, agora - INATIVIDADE]);
  return cookieSessao(req, token, DURACAO_MAX / 1000);
}

export const cookieSaida = (req) => cookieSessao(req, '', 0);

export async function sessaoAtual(db, req) {
  const token = lerCookies(req)[nomeCookie(req)];
  if (!token || token.length > 100) return null;
  const agora = Date.now();
  const rows = await db.query(
    `SELECT s.id_hash, s.csrf, s.ultimo_uso, u.id, u.usuario, u.nome, u.papel, u.permissoes
       FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.id_hash = $1 AND s.expira_em > $2 AND s.ultimo_uso > $3 AND u.ativo = 1`,
    [sha256(token), agora, agora - INATIVIDADE]);
  if (!rows.length) return null;
  const s = rows[0];
  if (agora - Number(s.ultimo_uso) > 5 * 60 * 1000) {
    await db.query(`UPDATE sessoes SET ultimo_uso = $1 WHERE id_hash = $2`, [agora, s.id_hash]);
  }
  let permissoes = [];
  try { permissoes = JSON.parse(s.permissoes); } catch { /* vazio */ }
  return { sessaoId: s.id_hash, csrf: s.csrf, usuario: { id: s.id, usuario: s.usuario, nome: s.nome, papel: s.papel, permissoes } };
}

export async function encerrarSessao(db, sessaoId) {
  await db.query(`DELETE FROM sessoes WHERE id_hash = $1`, [sessaoId]);
}
export async function encerrarSessoesDoUsuario(db, usuarioId, excetoSessao = '') {
  await db.query(`DELETE FROM sessoes WHERE usuario_id = $1 AND id_hash <> $2`, [usuarioId, excetoSessao]);
}

// ---------- Limite de tentativas de login ----------
const JANELA = 15 * 60 * 1000;
const MAX_POR_USUARIO = 5, MAX_POR_IP = 20;

export async function checarBloqueio(db, ip, usuario) {
  const desde = Date.now() - JANELA;
  const [u] = await db.query(`SELECT COUNT(*) AS n FROM tentativas_login WHERE chave = $1 AND quando > $2`, ['u:' + usuario, desde]);
  const [i] = await db.query(`SELECT COUNT(*) AS n FROM tentativas_login WHERE chave = $1 AND quando > $2`, ['ip:' + ip, desde]);
  if (Number(u.n) >= MAX_POR_USUARIO || Number(i.n) >= MAX_POR_IP) {
    throw erro(429, 'Muitas tentativas de login. Aguarde 15 minutos e tente de novo.');
  }
}
export async function registrarFalha(db, ip, usuario) {
  const agora = Date.now();
  await db.transacao([
    [`INSERT INTO tentativas_login (chave, quando) VALUES ($1,$2)`, ['u:' + usuario, agora]],
    [`INSERT INTO tentativas_login (chave, quando) VALUES ($1,$2)`, ['ip:' + ip, agora]],
    [`DELETE FROM tentativas_login WHERE quando < $1`, [agora - 24 * 60 * 60 * 1000]],
  ]);
}
export async function limparFalhas(db, usuario) {
  await db.query(`DELETE FROM tentativas_login WHERE chave = $1`, ['u:' + usuario]);
}

// ---------- Permissões ----------
// admin: tudo. funcionario: só o que foi marcado.
export const PERMISSOES = {
  produtos: 'Cadastrar e editar produtos (textos, imagens, ativar/desativar, destaque)',
  precos: 'Alterar preços e promoções',
  excluir: 'Excluir produtos',
  temas: 'Temas e campanhas',
};

export function pode(usuario, permissao) {
  if (usuario.papel === 'admin') return true;
  if (permissao === 'funcionarios') return false;
  return usuario.permissoes.includes(permissao);
}
export function exigir(usuario, permissao) {
  if (!pode(usuario, permissao)) throw erro(403, 'Você não tem permissão para esta ação.');
}

// ---------- Histórico ----------
export function registroHistorico(usuario, acao, alvoTipo, alvoId, resumo, detalhes) {
  return [`INSERT INTO historico (id, quando, usuario_id, usuario_nome, acao, alvo_tipo, alvo_id, resumo, detalhes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [novoId('h'), Date.now(), usuario?.id || null, usuario?.nome || 'Sistema', acao, alvoTipo, alvoId,
      String(resumo).slice(0, 300), detalhes ? JSON.stringify(detalhes).slice(0, 4000) : null]];
}
