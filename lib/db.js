// Acesso ao banco. Toda consulta usa parâmetros ($1, $2...) — nunca concatenar valores no SQL.
// Produção (Vercel): Postgres da Neon via DATABASE_URL.
// Local (sem DATABASE_URL): SQLite em arquivo, só para desenvolvimento/testes.
import { migrar } from './schema.js';

let pronto = null;

async function criarNeon(url) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  return {
    tipo: 'postgres',
    query: (texto, params = []) => sql.query(texto, params),
    transacao: (lista) => sql.transaction(lista.map(([t, p]) => sql.query(t, p || []))),
  };
}

async function criarSqlite(arquivo) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(arquivo);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  // Converte $1, $2 para ?1, ?2 (sintaxe do SQLite) — continua parametrizado.
  const conv = (t) => t.replace(/\$(\d+)/g, '?$1');
  const run = (t, p = []) => {
    const st = db.prepare(conv(t));
    return /^\s*(select|with)|returning/i.test(t) ? st.all(...p) : (st.run(...p), []);
  };
  return {
    tipo: 'sqlite',
    query: async (t, p) => run(t, p),
    transacao: async (lista) => {
      db.exec('BEGIN');
      try { const r = lista.map(([t, p]) => run(t, p)); db.exec('COMMIT'); return r; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

export function db() {
  if (!pronto) {
    pronto = (async () => {
      const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      let banco;
      if (url) banco = await criarNeon(url);
      else if (process.env.VERCEL) throw new Error('DATABASE_URL não configurada na Vercel');
      else banco = await criarSqlite(process.env.SQLITE_FILE || 'dev.sqlite');
      await migrar(banco);
      return banco;
    })().catch((e) => { pronto = null; throw e; });
  }
  return pronto;
}
