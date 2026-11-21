# FlexCare — loja + painel administrativo

A loja continua sendo o mesmo `index.html`, com o mesmo visual e o mesmo comportamento. A diferença é que agora os produtos, preços, promoções e temas ficam num banco de dados, e esse banco é controlado pelo painel em **/admin**.

## Estrutura

```
public/                  → arquivos que a Vercel publica
  index.html             → a loja (lê os produtos de /api/catalogo)
  assets/                → logo e mascote da Black Friday
  admin/login.html       → tela de login do painel
  admin/assets/          → visual e código do painel
api/app.js               → o servidor (função da Vercel): todas as rotas /api e /admin
lib/                     → regras do servidor: banco, segurança, validação, produtos, temas
vercel.json              → rotas e cabeçalhos de segurança
scripts/dev-server.js    → servidor para testar no seu computador
```

## Como publicar na Vercel (uma vez só)

1. **Substitua os arquivos do projeto atual** por estes, mantendo a pasta `public/`. O `index.html` antigo da raiz sai, porque a versão nova está em `public/index.html`.
2. **Crie o banco de dados.** Na Vercel, abra o projeto e vá em **Storage → Create Database → Neon (Postgres)**. Escolha o plano grátis e conecte ao projeto. A Vercel cria sozinha a variável `DATABASE_URL`.
3. **Crie o código do primeiro acesso.** Vá em **Settings → Environment Variables** e adicione:
   - Nome: `SETUP_TOKEN`
   - Valor: um código longo e aleatório, com pelo menos 16 caracteres. Por exemplo, uma senha de 32 caracteres criada num gerador de senhas. Não use o mesmo código da sua senha.
4. **Faça o deploy** (Deployments → Redeploy, ou envie para o GitHub).
5. **Abra `https://seusite/admin`.** Na primeira vez aparece a tela **Primeiro acesso**. Informe o `SETUP_TOKEN`, seu nome, um usuário e uma senha. Essa será a conta de administrador principal. Depois disso, a tela de primeiro acesso não aparece mais.
6. Se quiser, apague a variável `SETUP_TOKEN` depois. Mesmo que ela continue lá, ninguém consegue criar outro administrador por essa tela, porque o cadastro já foi feito.

Na primeira vez que o site rodar, o banco é preenchido sozinho com os 24 produtos que estavam no `index.html`, junto com os preços, as promoções da Black Friday e a bolsa com a opção azul. O projetor natalino entra desativado.

## Endereços do painel

`/admin`, `/painel` e `/login` levam ao mesmo painel. Nenhum link da loja aponta para eles, e o painel avisa aos buscadores para não indexar essas páginas.

## Segurança

- **Senhas:** são guardadas com hash `scrypt` e um sal aleatório. Nenhuma senha fica no código nem no navegador, e não existe senha fixa.
- **Sessões:**
  - O login gera um cookie com as proteções `HttpOnly`, `Secure`, `SameSite=Strict` e prefixo `__Host-`. O banco guarda apenas o hash desse token.
  - A sessão expira depois de 2 h sem uso e dura no máximo 12 h.
  - Desativar uma conta ou trocar a senha derruba as sessões abertas dela.
- **Proteção de rotas:**
  - Só quem está logado recebe o HTML do painel. Quem não está é mandado para o login.
  - O servidor confere o login e a permissão em todas as rotas `/api/admin/*`.
- **CSRF (ataques vindos de outros sites):** toda alteração exige três coisas ao mesmo tempo:
  - que o pedido venha do próprio domínio (cabeçalho `Origin`);
  - o token CSRF da sessão;
  - dados enviados em JSON.
- **Força bruta:** depois de 5 senhas erradas para o mesmo usuário, ou 20 erradas vindas do mesmo IP, em 15 minutos, o login fica bloqueado por 15 minutos. A mensagem de erro não diz se o usuário existe.
- **SQL injection:** todas as consultas usam parâmetros (`$1`, `$2`…). Nenhum valor é colado direto no SQL.
- **XSS:**
  - Tudo que vem do banco aparece na tela como texto (`textContent`), nunca como HTML.
  - O painel tem uma Content-Security-Policy rígida, sem nenhum script inline.
  - Links só são aceitos se começarem com `https://`.
- **Uploads:**
  - Só são aceitos JPG, PNG ou WEBP, e o servidor confere o tipo pelos bytes do arquivo, não pelo nome.
  - O limite é 2 MB por imagem. O painel reduz as fotos do celular antes de enviar.
  - SVG é recusado.
  - As imagens são servidas com `nosniff` e com uma CSP `sandbox`.
- **Permissões por função:**
  - O **administrador** pode tudo.
  - O **funcionário** só faz o que estiver marcado: produtos, preços/promoções, excluir ou temas.
  - Só o administrador gerencia funcionários.
  - O sistema não deixa ninguém tirar o próprio acesso, nem desativar o último administrador.
- **Edições ao mesmo tempo:** se duas pessoas editarem o mesmo produto juntas, a segunda recebe um aviso em vez de apagar o que a primeira salvou.

## Lembretes importantes

- **Preço cobrado:** quem cobra o cliente é a Kaiross. Quando mudar um preço ou criar uma promoção no painel, mude também no checkout da Kaiross.
- **Atualização da loja:** a loja leva uns 15 segundos para mostrar as alterações, por causa do cache da Vercel.
- **Datas das campanhas:** a Black Friday e o Natal agora têm datas fixas, que você controla no painel. No ano que vem, é só atualizar as datas em **Temas e campanhas**.

## Testar no seu computador

```
npm install
SETUP_TOKEN=um-codigo-de-teste-bem-grande npm run dev
```

Depois abra http://localhost:3000. Sem `DATABASE_URL`, o teste usa um banco local (`dev.sqlite`) e não mexe no banco de verdade. Precisa do Node 22.5 ou mais novo.
