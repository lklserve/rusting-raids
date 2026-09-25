# Site do Rusting Raids

Landing page do jogo: download do APK, galeria, devblog, roadmap, dúvidas e o apoio via Pix com o
deslizante de R$ 5 a R$ 100. É HTML, CSS e JavaScript puros: sem build, sem biblioteca. Abrir o
`index.html` no navegador já funciona.

## O que editar no dia a dia

| Arquivo | O que tem |
|---|---|
| `assets/js/config.js` | **Link do Mediafire** (`linkDownload`), versão, redes (Discord, WhatsApp, TikTok), meta do mês, limites do apoio |
| `assets/js/dados.js` | **Posts do devblog**, fotos da galeria, roadmap e dúvidas |
| `assets/img/galeria/` | Fotos 1920×1080 em `.webp`, com miniatura 480×270 de mesmo nome em `mini/` |

- **Post novo no devblog:** acrescentar no começo da lista `devblog` do `dados.js`. O primeiro aparece em destaque.
- **Redes sociais:** enquanto o endereço estiver vazio, o botão fica escondido.
- **Meta do mês:** enquanto a API não existir, `arrecadado` é trocado à mão.
- **Testar sem o convite de apoio abrindo sozinho:** `index.html?semconvite`.

## Hospedagem (Vercel + GitHub)

1. Criar um repositório no GitHub só com esta pasta.
2. Na Vercel: **Add New → Project → Import** do repositório.
   - Framework: **Other**.
   - Sem comando de build.
   - Pasta de saída: a raiz.
3. Cada `git push` publica sozinho. O `vercel.json` já tem o cache e os cabeçalhos de segurança.

## Próxima etapa: Pix de verdade e painel de chaves

Hoje o apoio roda em **modo de demonstração** (`apoio.api: null` no `config.js`): o QR é falso e
avisa que é falso, e há um botão para simular a aprovação. Para ligar o Pix real, no mesmo
esquema da lkl-shop:

- **Funções na Vercel**, em `api/`:
  - `POST /api/pix/criar {valor, email}`: cria o pagamento no Mercado Pago (`payment_method_id:
    "pix"`, validade de 30 min, `X-Idempotency-Key`, `notification_url`) e devolve
    `{pedidoId, valor, qrBase64, copiaECola, expiraEm}`;
  - `GET /api/pix/status?pedido=ID`: devolve `{status, chave}`. Se o webhook não tiver chegado,
    pergunta direto ao Mercado Pago;
  - `POST /api/webhooks/mercadopago`: aprova o pedido e emite a chave. Tem de ser idempotente:
    webhook repetido não gera outra chave.
- **Segredos só em variável de ambiente da Vercel:** `MERCADO_PAGO_ACCESS_TOKEN` e a chave do
  banco. Nunca no código do site.
- **Valor:** o servidor valida o valor de novo (mínimo R$ 5, máximo R$ 100). O navegador não
  decide preço.
- **Banco** (Supabase, por exemplo): `pedidos`, `chaves`, `jogadores` (ID da conta do jogo) e
  `banimentos`. O painel de chaves lê e escreve nessas tabelas, e o jogo valida a chave nele.
- **Chave:** gerada com gerador criptográfico (`crypto.randomBytes`), nunca com `Math.random`.

A tela já está pronta para esse contrato: a consulta de status roda a cada 4 s, o pedido pendente
volta se a pessoa fechar e reabrir o site, e a chave fica guardada no aparelho.
