/* ==========================================================================
   Rusting Raids — CONFIGURAÇÃO DO SITE
   Tudo o que muda com frequência fica aqui: links, versão, meta do apoio.
   ========================================================================== */
window.RR_CONFIG = {
  /* Link do APK no Mediafire. Enquanto estiver vazio, o botão "Baixar" avisa que o link sai em breve. */
  linkDownload: "",
  versao: "alpha 0.1",
  tamanhoApk: "",          // ex.: "480 MB" — aparece junto do botão, se preenchido

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

  /* Meta do mês (hospedagem). Troque "arrecadado" à mão até a API ligar. */
  meta: {
    titulo: "Servidor do mês",
    arrecadado: 0,
    objetivo: 1500,
  },

  /* O convite de apoio abre sozinho ao entrar no site (uma vez por sessão). */
  conviteAoAbrir: true,
  atrasoDoConvite: 1400,

  /* Redes. Deixe "" para esconder. */
  redes: {
    discord: "",
    whatsappGrupo: "",
    whatsappCanal: "",
    tiktok: "",
  },
};
