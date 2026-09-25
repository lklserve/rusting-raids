/* ==========================================================================
   Rusting Raids — CONTEÚDO DO SITE
   Para postar no devblog, pôr foto na galeria ou mexer no roadmap, edite só este arquivo.
   ========================================================================== */
window.RR_DADOS = {

  /* ------------------------------------------------------------ GALERIA
     img: arquivo em assets/img/galeria/ (1920×1080 em .webp) — miniatura em .../mini/ com o mesmo nome. */
  galeria: [
    { img: "01.webp", titulo: "A ilha", texto: "Mundo aberto: floresta, praia, deserto e cidades abandonadas." },
    { img: "02.webp", titulo: "Noites de verdade", texto: "Sem luz, você não enxerga um palmo. A tocha é sua melhor amiga." },
    { img: "03.webp", titulo: "A horda", texto: "Zumbis andam em bando, e alguns cospem ácido. Mire bem." },
    { img: "04.webp", titulo: "A pirâmide do Anúbis", texto: "O chefe mais perigoso da ilha guarda o melhor loot." },
    { img: "05.webp", titulo: "Cavalos selvagens", texto: "Chegue devagar, dome e saia galopando." },
    { img: "06.webp", titulo: "O trem", texto: "24,6 km de trilhos e 14 estações. Suba no carrinho e atravesse o mapa." },
    { img: "07.webp", titulo: "Airdrop", texto: "Atire o sinalizador e dispute o caixote com quem estiver por perto." },
    { img: "08.webp", titulo: "Raid", texto: "C4 na porta. O resto é história." },
    { img: "09.webp", titulo: "De perto", texto: "Soldado, enfermeira, turista — cada zumbi tem um jeito de te pegar." },
    { img: "10.webp", titulo: "Sua base", texto: "Fundação, paredes e teto de pedra. Tranque bem — alguém sempre tenta entrar." },
  ],

  /* ------------------------------------------------------------ DEVBLOG
     tipo: "devblog" | "atualizacao" | "patch" | "noticia"
     O primeiro da lista aparece em destaque. */
  devblog: [
    {
      id: "site-no-ar",
      data: "2026-09-25",
      tipo: "noticia",
      titulo: "O site está no ar",
      sub: "E o apoio via Pix também",
      img: "08.webp",
      resumo: "Agora o Rusting Raids tem casa: download, devblog, galeria e o apoio que vai pagar o servidor.",
      conteudo: [
        { p: "Este é o lugar oficial do Rusting Raids. Daqui sai o link do APK, as novidades de cada dia e o apoio para manter o servidor ligado." },
        { h: "Por que apoiar?" },
        { p: "O jogo é feito por um dev só, sem investidor e sem loja paga dentro do jogo. Todo apoio a partir de R$ 5 vira servidor, correção e conteúdo — e libera a sua chave de acesso." },
        { h: "O que vem agora" },
        { ul: ["Pix de verdade pelo Mercado Pago, com a chave entregue na hora.", "Painel de chaves com a sua conta e o ID do seu sobrevivente.", "Banimento de quem for pego usando hack."] },
      ],
    },
    {
      id: "devblog-5",
      data: "2026-09-25",
      tipo: "devblog",
      titulo: "Devblog 5",
      sub: "Zumbis, primeira pessoa e o primeiro APK",
      img: "03.webp",
      resumo: "A horda chegou, a câmera foi para os olhos do sobrevivente e o jogo rodou pela primeira vez num celular.",
      conteudo: [
        { h: "Zumbis" },
        { ul: ["Hordas de zumbis comuns espalhadas pelo mapa.", "Elites, a Banshee e o Tirano.", "A pirâmide do Anúbis, com o chefe mais perigoso da ilha."] },
        { h: "Primeira pessoa" },
        { ul: ["Câmera em primeira pessoa com braços e animações de verdade.", "Efeitos de tiro novos e número de dano ao lado da mira.", "Lança que golpeia, levanta e é arremessada."] },
        { h: "Arsenal" },
        { ul: ["Dezenas de armas de fogo e brancas novas, com acessórios.", "Carga de demolição e explosivo com temporizador.", "Armas fortes são raras no loot: nada apelão."] },
        { h: "E mais" },
        { ul: ["Primeiro APK Android rodando num celular intermediário.", "Lobby com a logo do Rusting Raids e o servidor de 7 dias.", "Bicicleta: pedalar, pedalar forte, pular e tocar a campainha.", "Noite nova: céu escuro, estrelas girando e lua grande com halo.", "Pistola de sinalização que chama o airdrop.", "Botões no baú: organizar, guardar tudo e pegar tudo."] },
      ],
    },
    {
      id: "devblog-4",
      data: "2026-09-24",
      tipo: "devblog",
      titulo: "Devblog 4",
      sub: "Raid, trem e um mundo vivo",
      img: "06.webp",
      resumo: "Explosivos que derrubam bases, um trem que dá a volta na ilha, cavalos, chefes de guerra e noites iluminadas de verdade.",
      conteudo: [
        { h: "Raid" },
        { ul: ["C4, pacote explosivo, barril, foguetes e granadas.", "Explosivos detonam em cadeia; minas explodem com o impacto.", "Acessórios de arma: miras, luneta, silenciador e mais."] },
        { h: "Mundo" },
        { ul: ["Sistema de trem: trilhos pelo mapa inteiro e 14 paradas.", "Cavalos selvagens em manadas — dome, monte e use a bolsa.", "Tanque e helicóptero de guerra patrulhando o mapa.", "Chuva a cada 7 dias de jogo, com feixes de sol entre as nuvens."] },
        { h: "Sobrevivência" },
        { ul: ["Progresso salvo.", "Luzes que iluminam de verdade: lampião, tocha, capacete e lanterna.", "Trilha sonora que muda com o momento do jogo.", "Loja da rodada com limite diário — sem pay-to-win."] },
      ],
    },
    {
      id: "devblog-3",
      data: "2026-09-23",
      tipo: "devblog",
      titulo: "Devblog 3",
      sub: "O mapa inteiro",
      img: "10.webp",
      resumo: "Construção com encaixes, o mapa completo, loot pelas estradas, radiação, infectados, animais e veículos.",
      conteudo: [
        { h: "Construção" },
        { ul: ["Peças com encaixe: fundação, parede, porta, janela, escada.", "Fechadura de código e gabinete territorial.", "Bancada para desenvolver, reparar e melhorar."] },
        { h: "O mapa" },
        { ul: ["Terreno, mar, cidades, abrigos, laboratório e túneis.", "Barris e caixas pela beira da estrada.", "Airdrop do cargueiro.", "Zonas radioativas — só com a máscara."] },
        { h: "Vida (e morte)" },
        { ul: ["Infectados e animais com IA.", "Veículos e soldados armados.", "Jogador caído: segunda chance, arrastar e auto-ajuda.", "Tela de morte, saco de dormir e cama."] },
      ],
    },
    {
      id: "devblog-2",
      data: "2026-09-20",
      tipo: "devblog",
      titulo: "Devblog 2",
      sub: "Combate, mochila e som",
      img: "02.webp",
      resumo: "Tiro saindo do cano, barra de armas, mochila, coleta com números de verdade e mais de mil sons ligados ao jogo.",
      conteudo: [
        { ul: ["Locomoção completa: correr, agachar, nadar e escalar.", "Tiro saindo do cano, mira e barras de vida.", "Mochila, coleta e fabricação.", "Céu e atmosfera, minimapa e HUD de combate.", "Mais de mil sons ligados às ações."] },
      ],
    },
    {
      id: "devblog-1",
      data: "2026-09-19",
      tipo: "devblog",
      titulo: "Devblog 1",
      sub: "O primeiro passo",
      img: "01.webp",
      resumo: "O mundo aberto nasce: recursos para coletar, grama ao vento, morte com loot no chão e renascimento.",
      conteudo: [
        { ul: ["Cena do mundo aberto montada e jogável.", "Árvores, pedras e minérios para coletar.", "Grama densa com vento.", "Morte com loot no chão e renascimento.", "Personagem com esqueleto e animações."] },
      ],
    },
  ],

  /* ------------------------------------------------------------ ROADMAP
     estado: "feito" | "fazendo" | "proximo" */
  roadmap: [
    { estado: "feito", titulo: "Alpha no Android", texto: "O mundo inteiro rodando no celular: construção, raid, zumbis, veículos e o ciclo de dia e noite." },
    { estado: "feito", titulo: "Primeira pessoa", texto: "Câmera nos olhos do sobrevivente, com braços e animações de arma." },
    { estado: "fazendo", titulo: "Site e apoio via Pix", texto: "Download oficial, devblog e o apoio que paga o servidor — com a chave entregue na hora." },
    { estado: "proximo", titulo: "Painel de chaves e contas", texto: "Sua chave ligada à sua conta e ao ID do seu sobrevivente. Banimento de quem usar hack." },
    { estado: "proximo", titulo: "Multiplayer e equipes", texto: "Jogar com os amigos em equipes de até 4, com a base e a mochila guardadas no servidor." },
    { estado: "proximo", titulo: "Servidor online de 7 dias", texto: "Temporadas de 168 horas. No fim, o mundo acaba — e quem segurar a medalha na base leva a glória." },
    { estado: "proximo", titulo: "Versão para PC", texto: "Mouse, teclado e tela grande, no mesmo servidor." },
  ],

  /* ------------------------------------------------------------ DÚVIDAS */
  faq: [
    { p: "Quanto custa para jogar?", r: "O download é livre. Para jogar, você ativa uma chave de acesso, que recebe ao apoiar o projeto com qualquer valor a partir de R$ 5. O dinheiro paga a hospedagem do servidor." },
    { p: "Em qual celular roda?", r: "Android 6.0 ou mais novo. O jogo foi testado num celular intermediário (Galaxy A05s). Por enquanto não há versão para iPhone." },
    { p: "Já dá para jogar online com os amigos?", r: "Ainda não. O alpha atual é para explorar e testar. O multiplayer com equipes está em desenvolvimento — e é exatamente isso que o seu apoio financia." },
    { p: "Tem pay-to-win?", r: "Não. Nada que dá vantagem em combate é vendido. Sem talentos, sem pets voadores, sem mechas. O apoio paga o servidor, não compra poder." },
    { p: "Como recebo minha chave?", r: "Na hora, na tela, assim que o Pix é confirmado. Ela também fica guardada neste aparelho. Anote num lugar seguro." },
    { p: "Perdi minha chave. E agora?", r: "Chame a gente no Discord ou no grupo do WhatsApp com o e-mail que você usou no Pix. A gente encontra." },
    { p: "Vi alguém usando hack.", r: "Grave a tela e mande no Discord. Cada conta tem um ID, e quem for pego é banido pelo painel de chaves." },
    { p: "O que acontece no fim da temporada?", r: "No servidor online, cada temporada dura 7 dias reais (168 horas). No fim, o mundo reinicia e todo mundo começa do zero — igual para todos." },
  ],
};
