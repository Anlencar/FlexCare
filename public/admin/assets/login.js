// Tela de login e de primeiro acesso. Nenhuma senha fica guardada no navegador.
const $ = (id) => document.getElementById(id);

async function post(url, dados) {
  const r = await fetch(url, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(dados),
  });
  let corpo = {};
  try { corpo = await r.json(); } catch { /* sem corpo */ }
  if (!r.ok) throw new Error(corpo.erro || 'Não foi possível concluir. Tente de novo.');
  return corpo;
}

function mostrarErro(el, msg) { el.textContent = msg; el.hidden = !msg; }

document.querySelectorAll('.ver-senha').forEach((b) => {
  b.addEventListener('click', () => {
    const i = b.parentElement.querySelector('input');
    const ver = i.type === 'password';
    i.type = ver ? 'text' : 'password';
    b.setAttribute('aria-label', ver ? 'Esconder senha' : 'Mostrar senha');
  });
});

$('formEntrar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const usuario = $('usuario').value.trim().toLowerCase();
  const senha = $('senha').value;
  mostrarErro($('erroEntrar'), '');
  if (!usuario || !senha) return mostrarErro($('erroEntrar'), 'Preencha usuário e senha.');
  const bt = $('btEntrar');
  bt.disabled = true; bt.textContent = 'Entrando…';
  try {
    await post('/api/auth/login', { usuario, senha });
    location.replace('/admin');
  } catch (err) {
    $('senha').value = '';
    mostrarErro($('erroEntrar'), err.message);
    $('senha').focus();
  } finally { bt.disabled = false; bt.textContent = 'Entrar'; }
});

$('formSetup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const erro = $('erroSetup');
  mostrarErro(erro, '');
  const dados = { token: $('sToken').value, nome: $('sNome').value.trim(), usuario: $('sUsuario').value.trim().toLowerCase(), senha: $('sSenha').value };
  if (!dados.token || !dados.nome || !dados.usuario || !dados.senha) return mostrarErro(erro, 'Preencha todos os campos.');
  if (!/^[a-z0-9._-]{3,32}$/.test(dados.usuario)) return mostrarErro(erro, 'Usuário: 3 a 32 caracteres, só letras minúsculas, números, ponto, hífen ou _.');
  if (dados.senha.length < 10) return mostrarErro(erro, 'A senha precisa ter pelo menos 10 caracteres.');
  if (dados.senha !== $('sSenha2').value) return mostrarErro(erro, 'As senhas não são iguais.');
  const bt = $('btSetup');
  bt.disabled = true;
  try {
    await post('/api/auth/setup', dados);
    location.replace('/admin');
  } catch (err) { mostrarErro(erro, err.message); }
  finally { bt.disabled = false; }
});

(async () => {
  const p = new URLSearchParams(location.search);
  if (p.has('saiu')) { $('infoEntrar').textContent = 'Você saiu do painel.'; $('infoEntrar').hidden = false; }
  if (p.has('expirou')) { $('infoEntrar').textContent = 'Sua sessão expirou. Entre novamente.'; $('infoEntrar').hidden = false; }
  // Já está logado? Vai direto para o painel.
  try { const eu = await fetch('/api/auth/eu', { credentials: 'same-origin' }); if (eu.ok) return location.replace('/admin'); } catch { /* segue */ }
  let configurar = false;
  try {
    const r = await fetch('/api/auth/estado', { credentials: 'same-origin' });
    configurar = (await r.json()).precisaConfigurar === true;
  } catch { /* mostra o login */ }
  $('carregando').hidden = true;
  $(configurar ? 'configurar' : 'entrar').hidden = false;
  $(configurar ? 'sToken' : 'usuario').focus();
})();
