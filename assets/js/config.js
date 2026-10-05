/* ==========================================================================
   Rusting Raids — CONFIGURAÇÃO DO SITE
   Tudo o que muda com frequência fica aqui: links, versão, meta do apoio.
   ========================================================================== */
window.RR_CONFIG = {
  /* Link do APK no Mediafire. Enquanto estiver vazio, o botão "Baixar" avisa que o link sai em breve. */
  linkDownload: "https://www.mediafire.com/file/kebgzk9iwi5tpnk/RustingRaids.apk/file",
  versao: "1.8",
  tamanhoApk: "912 MB",    // aparece junto do botão. O APK no Mediafire é a v6 (03/10/2026, 911,76 MB): ao abrir,
                           // ele se atualiza sozinho para a versão do servidor (1.8 em 05/10).

  /* Apoio via Pix (Mercado Pago). */
  apoio: {
    minimo: 5,
    maximo: 100,
    inicial: 10,
    /*
     * Endereço da API de Pix.
     *   null      = MODO DE DEMONSTRAÇÃO (QR falso + botão de simular). Use enquanto os
     *               segredos do Mercado Pago e do Supabase não estiverem na Vercel.
     *   "/api/pix" = PIX DE VERDADE. As funções ficam em /api/pix/criar e /api/pix/status.
     * Contrato:
     *   POST {api}/criar   { valor, email }  -> { pedidoId, valor, qrBase64, copiaECola, expiraEm }
     *   GET  {api}/status?pedido=ID          -> { status: "pendente"|"aprovado"|"expirado", chave? }
     */
    api: "/api/pix",
    intervaloDeConsulta: 4000,   // ms entre as consultas de status
    /* Nomes que aparecem conforme o valor escolhido no deslizante (só enfeite, não dá item no jogo). */
    patentes: [
      { de: 5, nome: "Sobrevivente" },
      { de: 15, nome: "Saqueador" },
      { de: 30, nome: "Raider" },
      { de: 60, nome: "Senhor da Ilha" },
      { de: 100, nome: "Lenda" },
    ],
  },

  /* Meta do mês (hospedagem). A barra enche SOZINHA com a soma dos Pix pagos no mês
     (horário de Brasília), lida do banco pela rota abaixo. "arrecadado" só vale se ela falhar. */
  meta: {
    titulo: "Servidor do mês",
    objetivo: 1500,
    api: "/api/meta",
    arrecadado: 0,
  },

  /* Servidor oficial: o cartão "A ilha está online" lê o status público do painel (no ar, online, vagas) a cada
     "intervalo" ms. O painel só libera a leitura para a origem do site; sem resposta, o cartão diz "sem resposta". */
  servidor: {
    api: "https://rusting-raids-painel.vercel.app/api/servidor?publico=1",
    intervalo: 60000,
  },

  /* O convite de apoio abre sozinho ao entrar no site (uma vez por sessão). */
  conviteAoAbrir: true,
  atrasoDoConvite: 1400,

  /* Redes. Deixe "" para esconder. */
  redes: {
    discord: "https://discord.gg/mpA9GdBx6",
    whatsappGrupo: "https://chat.whatsapp.com/JMx0PnI2XknCrQ0sPaS2fC",
    whatsappCanal: "https://whatsapp.com/channel/0029Vb8nQucFSAt7ZghHSA0F",
    telegram: "https://t.me/RustingRaids",
    tiktok: "",
  },
};
