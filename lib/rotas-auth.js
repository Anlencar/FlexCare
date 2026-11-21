// Login, primeiro acesso, sair e troca da própria senha.
import { erro, enviar, ipDe } from './http.js';
import {
  gerarHash, conferirSenha, gastarTempo, novoId, iguais, criarSessao, cookieSaida, encerrarSessao,
  encerrarSessoesDoUsuario, checarBloqueio, registrarFalha, limparFalhas, registroHistorico, PERMISSOES,
} from './seguranca.js';
import { texto, usuarioLogin, senhaNova } from './validacao.js';

async function existeUsuario(db) {
  const r = await db.query(`SELECT 1 AS x FROM usuarios LIMIT 1`);
  return r.length > 0;
}

export async function estado({ db, res }) {
  enviar(res, 200, { precisaConfigurar: !(await existeUsuario(db)) });
}

// Cria o primeiro administrador. Só funciona enquanto não existe nenhum usuário
// e exige o SETUP_TOKEN configurado nas variáveis de ambiente da Vercel.
export async function configurar({ db, req, res, corpo }) {
  const ip = ipDe(req);
  await checarBloqueio(db, ip, '#setup');
  if (await existeUsuario(db)) throw erro(403, 'O painel já foi configurado. Entre com seu usuário e senha.');
  const segredo = process.env.SETUP_TOKEN || '';
  if (segredo.length < 16) throw erro(503, 'Configure a variável SETUP_TOKEN (mínimo 16 caracteres) na Vercel antes de criar o primeiro administrador.');
  if (typeof corpo.token !== 'string' || !iguais(corpo.token, segredo)) {
    await registrarFalha(db, ip, '#setup');
    throw erro(403, 'Código de configuração incorreto.');
  }
  const usuario = usuarioLogin(corpo.usuario);
  const nome = texto(corpo.nome, 'Nome', { min: 2, max: 60 });
  const senha = senhaNova(corpo.senha, usuario);
  const id = novoId('usr');
  const agora = Date.now();
  const hash = await gerarHash(senha);
  const r = await db.query(
    `INSERT INTO usuarios (id, usuario, nome, senha_hash, papel, permissoes, ativo, criado_em, atualizado_em)
     SELECT $1,$2,$3,$4,'admin','[]',1,$5,$5 WHERE NOT EXISTS (SELECT 1 FROM usuarios) RETURNING id`,
    [id, usuario, nome, hash, agora]);
  if (!r.length) throw erro(403, 'O painel já foi configurado.');
  const quem = { id, nome };
  const [t, p] = registroHistorico(quem, 'funcionario_criado', 'usuario', id, `Primeiro administrador criado: ${nome} (${usuario})`);
  await db.query(t, p);
  const cookie = await criarSessao(db, req, id);
  enviar(res, 201, { ok: true }, { 'Set-Cookie': cookie });
}

export async function entrar({ db, req, res, corpo }) {
  const ip = ipDe(req);
  const usuario = typeof corpo.usuario === 'string' ? corpo.usuario.trim().toLowerCase().slice(0, 64) : '';
  const senha = typeof corpo.senha === 'string' ? corpo.senha.slice(0, 200) : '';
  if (!usuario || !senha) throw erro(400, 'Informe usuário e senha.');
  await checarBloqueio(db, ip, usuario);
  const rows = await db.query(`SELECT id, nome, senha_hash, ativo FROM usuarios WHERE usuario = $1`, [usuario]);
  const u = rows[0];
  let ok = false;
  if (u && Number(u.ativo) === 1) ok = await conferirSenha(senha, u.senha_hash);
  else await gastarTempo(senha);
  if (!ok) {
    await registrarFalha(db, ip, usuario);
    throw erro(401, 'Usuário ou senha inválidos.');
  }
  await limparFalhas(db, usuario);
  const agora = Date.now();
  await db.transacao([
    [`UPDATE usuarios SET ultimo_login = $1 WHERE id = $2`, [agora, u.id]],
    registroHistorico({ id: u.id, nome: u.nome }, 'login', 'usuario', u.id, `${u.nome} entrou no painel`, { ip }),
  ]);
  const cookie = await criarSessao(db, req, u.id);
  enviar(res, 200, { ok: true }, { 'Set-Cookie': cookie });
}

export async function sair({ db, req, res, sessao }) {
  if (sessao) await encerrarSessao(db, sessao.sessaoId);
  enviar(res, 200, { ok: true }, { 'Set-Cookie': cookieSaida(req) });
}

export async function eu({ res, sessao }) {
  enviar(res, 200, { usuario: sessao.usuario, csrf: sessao.csrf, permissoesDisponiveis: PERMISSOES });
}

export async function trocarSenha({ db, res, sessao, corpo }) {
  const u = sessao.usuario;
  const [linha] = await db.query(`SELECT senha_hash FROM usuarios WHERE id = $1`, [u.id]);
  if (typeof corpo.atual !== 'string' || !(await conferirSenha(corpo.atual.slice(0, 200), linha.senha_hash))) {
    throw erro(400, 'A senha atual está incorreta.');
  }
  const nova = senhaNova(corpo.nova, u.usuario);
  await db.transacao([
    [`UPDATE usuarios SET senha_hash = $1, atualizado_em = $2 WHERE id = $3`, [await gerarHash(nova), Date.now(), u.id]],
    registroHistorico(u, 'senha_alterada', 'usuario', u.id, `${u.nome} alterou a própria senha`),
  ]);
  await encerrarSessoesDoUsuario(db, u.id, sessao.sessaoId);
  enviar(res, 200, { ok: true });
}
