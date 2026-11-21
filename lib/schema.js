// Criação das tabelas e carga inicial. SQL escrito para funcionar igual no Postgres e no SQLite.
import { PRODUTOS_INICIAIS } from './seed-data.js';

const VERSAO = '1';

const TABELAS = [
  `CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY, usuario TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, senha_hash TEXT NOT NULL,
    papel TEXT NOT NULL, permissoes TEXT NOT NULL DEFAULT '[]', ativo INTEGER NOT NULL DEFAULT 1,
    criado_em BIGINT NOT NULL, atualizado_em BIGINT NOT NULL, ultimo_login BIGINT)`,
  `CREATE TABLE IF NOT EXISTS sessoes (
    id_hash TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, csrf TEXT NOT NULL,
    criado_em BIGINT NOT NULL, ultimo_uso BIGINT NOT NULL, expira_em BIGINT NOT NULL, ip TEXT, agente TEXT)`,
  `CREATE INDEX IF NOT EXISTS sessoes_usuario ON sessoes (usuario_id)`,
  `CREATE TABLE IF NOT EXISTS tentativas_login (chave TEXT NOT NULL, quando BIGINT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS tentativas_chave ON tentativas_login (chave, quando)`,
  `CREATE TABLE IF NOT EXISTS produtos (
    id TEXT PRIMARY KEY, nome TEXT NOT NULL, descricao TEXT NOT NULL DEFAULT '', categoria TEXT NOT NULL,
    icone TEXT NOT NULL DEFAULT '', preco_cents INTEGER NOT NULL, frete_cents INTEGER NOT NULL DEFAULT 0,
    checkout_url TEXT NOT NULL, imagens TEXT NOT NULL DEFAULT '[]', variantes TEXT NOT NULL DEFAULT '[]',
    temas TEXT NOT NULL DEFAULT '["normal","natal","blackfriday"]', destaque INTEGER NOT NULL DEFAULT 0,
    ordem INTEGER NOT NULL DEFAULT 0, ativo INTEGER NOT NULL DEFAULT 1, versao INTEGER NOT NULL DEFAULT 1,
    criado_em BIGINT NOT NULL, atualizado_em BIGINT NOT NULL, atualizado_por TEXT)`,
  `CREATE TABLE IF NOT EXISTS campanhas (
    id TEXT PRIMARY KEY, nome TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1, inicio BIGINT, fim BIGINT,
    dia_evento BIGINT, desconto_pct INTEGER NOT NULL DEFAULT 0, atualizado_em BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS promocoes (
    produto_id TEXT NOT NULL, campanha_id TEXT NOT NULL, tipo TEXT NOT NULL, valor INTEGER NOT NULL,
    checkout_url TEXT, ativo INTEGER NOT NULL DEFAULT 1, atualizado_em BIGINT NOT NULL,
    PRIMARY KEY (produto_id, campanha_id))`,
  `CREATE TABLE IF NOT EXISTS imagens (
    id TEXT PRIMARY KEY, mime TEXT NOT NULL, dados TEXT NOT NULL, tamanho INTEGER NOT NULL,
    criado_em BIGINT NOT NULL, criado_por TEXT)`,
  `CREATE TABLE IF NOT EXISTS historico (
    id TEXT PRIMARY KEY, quando BIGINT NOT NULL, usuario_id TEXT, usuario_nome TEXT, acao TEXT NOT NULL,
    alvo_tipo TEXT, alvo_id TEXT, resumo TEXT NOT NULL, detalhes TEXT)`,
  `CREATE INDEX IF NOT EXISTS historico_quando ON historico (quando)`,
];

// Datas no horário de Brasília (UTC-3, sem horário de verão desde 2019).
const brt = (y, m0, d) => Date.UTC(y, m0, d, 3, 0, 0);
function sextaBlackFriday(ano) {
  const d = new Date(Date.UTC(ano, 10, 30));
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() - 1);
  return d.getUTCDate();
}

async function popular(db) {
  const agora = Date.now();
  // "Reserva" a carga inicial: só uma instância consegue inserir esta linha.
  const r = await db.query(
    `INSERT INTO config (chave, valor) VALUES ('carga_inicial', $1) ON CONFLICT (chave) DO NOTHING RETURNING chave`,
    [String(agora)]);
  if (!r.length) return;

  const ano = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(agora));
  const bf = sextaBlackFriday(ano);
  const ops = [
    [`INSERT INTO config (chave, valor) VALUES ('tema_modo', 'auto') ON CONFLICT (chave) DO NOTHING`],
    [`INSERT INTO campanhas (id, nome, ativo, inicio, fim, dia_evento, desconto_pct, atualizado_em) VALUES ($1,$2,1,NULL,NULL,NULL,0,$3) ON CONFLICT (id) DO NOTHING`, ['normal', 'Normal', agora]],
    [`INSERT INTO campanhas (id, nome, ativo, inicio, fim, dia_evento, desconto_pct, atualizado_em) VALUES ($1,$2,1,$3,$4,$5,0,$6) ON CONFLICT (id) DO NOTHING`,
      ['blackfriday', 'Black Friday', brt(ano, 10, 10), brt(ano, 10, bf + 4), brt(ano, 10, bf), agora]],
    [`INSERT INTO campanhas (id, nome, ativo, inicio, fim, dia_evento, desconto_pct, atualizado_em) VALUES ($1,$2,1,$3,$4,$5,0,$6) ON CONFLICT (id) DO NOTHING`,
      ['natal', 'Natal', brt(ano, 11, 1), brt(ano, 11, 26), brt(ano, 11, 25), agora]],
  ];
  for (const p of PRODUTOS_INICIAIS) {
    ops.push([`INSERT INTO produtos (id, nome, descricao, categoria, icone, preco_cents, frete_cents, checkout_url, imagens, variantes, destaque, ordem, ativo, criado_em, atualizado_em, atualizado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14,'sistema') ON CONFLICT (id) DO NOTHING`,
      [p.id, p.nome, p.descricao, p.categoria, p.icone, p.preco, p.frete, p.checkout, JSON.stringify(p.imagens),
        JSON.stringify(p.variantes), p.destaque, p.ordem, p.ativo ? 1 : 0, agora]]);
    if (p.bf) ops.push([`INSERT INTO promocoes (produto_id, campanha_id, tipo, valor, checkout_url, ativo, atualizado_em) VALUES ($1,'blackfriday','preco',$2,NULL,1,$3) ON CONFLICT DO NOTHING`, [p.id, p.bf, agora]]);
  }
  ops.push([`INSERT INTO historico (id, quando, usuario_id, usuario_nome, acao, alvo_tipo, alvo_id, resumo, detalhes) VALUES ($1,$2,NULL,'Sistema','sistema',NULL,NULL,$3,NULL)`,
    ['h_inicial', agora, `Catálogo importado do site: ${PRODUTOS_INICIAIS.length} produtos`]]);
  await db.transacao(ops);
}

export async function migrar(db) {
  try {
    const v = await db.query(`SELECT valor FROM config WHERE chave = 'schema'`);
    if (v.length && v[0].valor === VERSAO) return;
  } catch { /* tabelas ainda não existem */ }
  for (const t of TABELAS) await db.query(t);
  await popular(db);
  await db.query(`INSERT INTO config (chave, valor) VALUES ('schema', $1) ON CONFLICT (chave) DO UPDATE SET valor = $1`, [VERSAO]);
}
