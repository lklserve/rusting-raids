# Site do Rusting Raids

Landing page do jogo + apoio via Pix + chaves de acesso. O site (frente) é HTML, CSS e
JavaScript puros, sem build. O backend são **funções serverless na Vercel** (pasta `api/`),
com banco no **Supabase**. Tudo é **próprio e isolado do jogo** — nenhuma ligação com outro sistema.

## Estrutura

```
index.html, assets/            → o site (estático)
api/pix/criar.js               → cria a cobrança Pix (valida o valor no servidor)
api/pix/status.js              → a tela pergunta aqui de 4 em 4 s
api/webhooks/mercadopago.js    → o Mercado Pago avisa aqui quando o pagamento cai
api/jogo/ativar.js             → o painel de chaves DO JOGO ativa a chave num aparelho
api/jogo/validar.js            → o jogo confere a chave ao abrir (e o banimento)
api/_lib/                      → supabase, mercadopago, keygen, rate-limit, emitir, http
supabase/schema.sql            → o banco (rode uma vez no projeto novo)
```

## O que editar no dia a dia

| Arquivo | O que tem |
|---|---|
| `assets/js/config.js` | link do Mediafire, versão, redes e o **liga/desliga do Pix real** |
| `assets/js/dados.js` | posts do devblog, galeria, roadmap e dúvidas |
| `assets/img/galeria/` | fotos 1920×1080 `.webp`, com miniatura de mesmo nome em `mini/` |

- **Testar sem o convite de apoio abrindo sozinho:** `index.html?semconvite`.

## Segurança (o que já está feito)

- **Segredos só em variável de ambiente** da Vercel; `.env` está no `.gitignore` e nunca vai para o git.
- **Chave do Supabase `service_role` só no servidor** — nunca chega ao navegador. O banco fica
  trancado por **RLS sem policies**: só as funções acessam.
- **O preço é validado no servidor** (R$ 5 a R$ 100). O navegador não decide valor.
- **Chave gerada por CSPRNG** (`crypto`), nunca `Math.random()`.
- **Idempotência:** o webhook e a consulta de status nunca emitem duas chaves para o mesmo pedido
  (trava `pedido_id` único no banco).
- **Webhook à prova de falsificação:** a chave só sai depois de a função **perguntar ao próprio
  Mercado Pago** se o pagamento está aprovado. Um webhook forjado não libera nada. (Há ainda a
  conferência opcional da assinatura, se `MERCADO_PAGO_WEBHOOK_SECRET` estiver definido.)
- **Limite de requisições** por e-mail e por IP na cobrança, e por IP nas rotas do jogo.
- **Cabeçalhos de segurança + CSP estrito** no `vercel.json`: `script-src 'self'` (nenhum script
  de terceiro), HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`. Testado sem violações.
- **Limite de aparelhos por chave** (3) e **banimento** por chave e por jogador.

## Como ligar o Pix de verdade (quando quiser cobrar)

1. **Supabase** — criar um projeto NOVO só do jogo, abrir o SQL Editor e rodar `supabase/schema.sql`.
2. **Mercado Pago** — pegar o *Access Token de produção* (`APP_USR-...`) e, em Webhooks, apontar
   para `https://SEU-SITE/api/webhooks/mercadopago` (guardar o segredo do webhook, opcional).
3. **Vercel → Project → Settings → Environment Variables** — preencher (ver `.env.example`):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADO_PAGO_ACCESS_TOKEN`,
   `MERCADO_PAGO_WEBHOOK_SECRET` (opcional), `SITE_URL`, `SITE_ORIGEM`.
4. Em `assets/js/config.js`, trocar `api: null` por `api: "/api/pix"` e publicar.

Enquanto `api` for `null`, o site fica em **modo de demonstração** (QR falso e botão de simular) —
ninguém paga de verdade. Nada de segredo é necessário nesse modo.

## O jogo (painel de chaves)

- Ao colar a chave no painel dentro do jogo: `POST /api/jogo/ativar { codigo, deviceId, nome }`.
- Ao abrir o jogo: `POST /api/jogo/validar { codigo, deviceId }` → `{ ok, banido, motivo }`.
- O ID do jogador e o aparelho ficam na tabela `jogadores`, que o painel de administração usa para
  banir.

## Privacidade, termos e acessibilidade (24/10)

- **Páginas legais:** `privacidade.html`, `termos.html` e `reembolso.html` (estilo em `assets/css/legal.css`), com links no
  rodapé de todas as páginas. Os dados de quem vende (Decreto 7.962/2013) e da Política estão marcados com
  `<span class="preencher">[PREENCHER: …]</span>`, que aparece em destaque laranja na página.
- **Aviso de privacidade** (`assets/js/consentimento.js`, em todas as páginas antes do app.js): o site não usa cookies nem
  rastreamento, só o armazenamento necessário (lista na Política, seção 8). Script de estatística ou anúncio, se um dia
  entrar, só roda com `RR_CONSENTIMENTO.permitido("<categoria>")` e ganha o interruptor no aviso.
- **Fontes servidas pelo site** (`assets/fonts`, OFL 1.1 em `assets/fonts/OFL.txt`; `assets/css/fontes.css`): sem Google
  Fonts, o navegador do visitante não fala com terceiros. O CSP do `vercel.json` não libera mais o Google.
- **Aceite dos Termos antes do Pix:** a caixa de aceite na janela de apoio e na recarga; o `value` dela é a versão dos Termos
  (trocar junto com a data do `termos.html`). As rotas guardam `termos_versao`/`termos_aceitos_em` no pedido
  (`api/_lib/pedido.js`; sem as colunas, o pedido entra sem elas).
- **Limite de tentativas sem IP e e-mail em claro:** `api/_lib/rate-limit.js` guarda o identificador cifrado (HMAC com
  `RATE_LIMIT_SEGREDO`, ou a service role se ela faltar) e apaga as linhas com mais de 1 dia.
- **Prazos de guarda:** `supabase/conformidade.sql` (colunas do aceite + `limpar_dados_vencidos()` + o agendamento no
  pg_cron, comentado no fim).
- **Galeria:** foto com personagem, marca ou logotipo de terceiros não entra (comentário no `dados.js`).
- **Acessibilidade:** auditoria axe-core WCAG 2.1 AA sem violações em todas as páginas (celular e PC), Tab por todo o site,
  botões "Pausar animações" e "Pausar imagens" (WCAG 2.2.2). Ferramentas no repositório do jogo, em
  `_Placeholder/site/ferramentas/conformidade/`.

### Antes de publicar esta parte

1. Trocar todos os `[PREENCHER…]` (nome ou razão social, CPF/CNPJ, endereço, encarregado, classificação indicativa):
   `grep -n "PREENCHER" *.html` tem de sair vazio.
2. Rodar `supabase/conformidade.sql` no banco do jogo e agendar a faxina no pg_cron (instruções no fim do arquivo). Sem
   isso, os prazos da Política (90 dias, 2 dias, 1 dia) não se cumprem.
3. Pôr `RATE_LIMIT_SEGREDO` (32+ caracteres aleatórios) nas variáveis da Vercel (opcional; sem ela vale a service role).
4. Na VPS do jogo, o journald guardando até 6 meses (`MaxRetentionSec=6month`), como diz a Política.

## Falta (próxima etapa)

- **Painel de administração** (página protegida por senha): ver chaves, jogadores, quanto
  arrecadou, e **banir**. A visão `painel_resumo` no banco já entrega os números.

## Hospedagem

GitHub → Vercel (Framework: Other, sem comando de build). Cada `git push` publica.
