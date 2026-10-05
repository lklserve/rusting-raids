/* ==========================================================================
   Rusting Raids — CONTEÚDO DO SITE
   Para postar no devblog, pôr foto na galeria ou mexer no roadmap, edite só este arquivo.
   ========================================================================== */
window.RR_DADOS = {

  /* ------------------------------------------------------------ GALERIA
     img: arquivo em assets/img/galeria/ (1920×1080 em .webp) — miniatura em .../mini/ com o mesmo nome. */
  galeria: [
    { img: "11.webp", titulo: "Plataforma de petróleo", texto: "No meio do mar, longe de tudo. Sala de cartão, caixas de loot e muito aço para escalar." },
    { img: "12.webp", titulo: "Céu vigiado", texto: "O helicóptero de guerra ronda a plataforma. Ele não ataca à toa — mas, se você mexer com ele, revida." },
    { img: "13.webp", titulo: "A guarda do convés", texto: "Soldados de escopeta vigiam a plataforma. Suba preparado." },
    { img: "14.webp", titulo: "Ao anoitecer", texto: "Quando o sol some, a plataforma vira uma silhueta no céu vermelho." },
    { img: "15.webp", titulo: "Navio-patrulha", texto: "Metralhadora no convés e mira em quem estiver nadando. Afunde-o e o saque fica boiando." },
    { img: "16.webp", titulo: "Tanque de guerra", texto: "Canhão e metralhadora. Ele aparece pelo deserto do Aeroporto — junte a equipe antes de encarar." },
    { img: "17.webp", titulo: "Chefes de guerra", texto: "Tanque em terra, helicóptero no ar. Quem derruba um deles leva o saque da carcaça." },
    { img: "18.webp", titulo: "O Tirano", texto: "O gigante da horda. Bate forte, aguenta muito e não desiste." },
    { img: "19.webp", titulo: "A Banshee", texto: "Ela chora dormindo no meio da floresta. Não acorde." },
    { img: "20.webp", titulo: "Lago Kahar", texto: "No norte gelado, a Máquina de Mineração trabalha sobre o lago congelado. Leve roupa quente." },
    { img: "21.webp", titulo: "Por baixo do aço", texto: "Chegue de caiaque, suba pela escada do mar e escale as vigas até o convés." },
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
      id: "devblog-6",
      data: "2026-10-05",
      tipo: "atualizacao",
      titulo: "Devblog 6",
      sub: "O servidor está no ar",
      img: "11.webp",
      resumo: "O Brasil 1 está online 24 horas, o jogo se atualiza sozinho e o mapa ganhou o mar: plataforma de petróleo, navio-patrulha e chefes de guerra.",
      conteudo: [
        { h: "Servidor oficial" },
        { ul: ["Brasil 1 (oficial) no ar 24 horas, com vaga para até 100 sobreviventes.", "Entre com a sua chave: a sua base e a sua mochila ficam guardadas no servidor.", "Equipes de até 4, chat e chat de voz.", "Construção, raid, saque, airdrop e chefes conferidos pelo servidor — quem tenta trapacear é corrigido e pode ser banido.", "Temporadas de 7 dias (168 horas)."] },
        { h: "Atualização automática" },
        { ul: ["Quando sai versão nova, o jogo avisa, baixa só o que mudou e o Android pede para instalar por cima.", "Versão 1.8: a fornalha e a fechadura de código funcionando online."] },
        { h: "O mar" },
        { ul: ["Plataforma de petróleo em alto-mar, com sala de cartão, soldados e o helicóptero rondando.", "Navio-patrulha armado perto do Porto e da Base Militar.", "Caiaque para chegar lá — e escada do mar para subir."] },
        { h: "Mais mundo" },
        { ul: ["O norte gelado: neve, frio e fogueira para se aquecer.", "Máquina de Mineração no Lago Kahar.", "Sede de volta: água doce de lago e rio, e o cantil.", "Algemas, resgate e escolta.", "Bicicleta, cavalos e o trem que dá a volta na ilha."] },
      ],
    },
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
    { estado: "feito", titulo: "Site, apoio via Pix e painel de chaves", texto: "Download oficial, devblog e a chave entregue na hora. Banimento de quem usar hack." },
    { estado: "feito", titulo: "Servidor online", texto: "O Brasil 1 no ar 24 horas, com temporadas de 7 dias, equipes de até 4, chat e voz." },
    { estado: "feito", titulo: "Atualização automática", texto: "O jogo baixa só o que mudou, sem precisar baixar o APK inteiro de novo." },
    { estado: "fazendo", titulo: "Versão completa", texto: "Tudo o que funciona no modo solo funcionando igual online: bancada, armadilhas, eletricidade e mais." },
    { estado: "proximo", titulo: "Lista de amigos", texto: "Adicione os amigos dentro do jogo e veja quem está online." },
    { estado: "proximo", titulo: "Versão para PC", texto: "Mouse, teclado e tela grande, no mesmo servidor." },
  ],

  /* ------------------------------------------------------------ DÚVIDAS */
  faq: [
    { p: "Quanto custa para jogar?", r: "O download é livre. Para jogar, você ativa uma chave de acesso, que recebe ao apoiar o projeto com qualquer valor a partir de R$ 5. O dinheiro paga a hospedagem do servidor." },
    { p: "Em qual celular roda?", r: "Android 6.0 ou mais novo. O jogo foi testado num celular intermediário (Galaxy A05s). Por enquanto não há versão para iPhone." },
    { p: "Já dá para jogar online com os amigos?", r: "Dá! O servidor oficial Brasil 1 está no ar 24 horas. Ative a sua chave, escolha Online no lobby e entre. Lá dentro, monte uma equipe de até 4 com os amigos." },
    { p: "O jogo pediu para atualizar. E agora?", r: "É normal. Quando sai versão nova, o jogo baixa só o que mudou e o Android pede para instalar por cima — não precisa baixar o APK inteiro de novo. O que é seu no servidor continua lá." },
    { p: "Tem pay-to-win?", r: "Não. Nada que dá vantagem em combate é vendido. Sem talentos, sem pets voadores, sem mechas. O apoio paga o servidor, não compra poder." },
    { p: "Como recebo minha chave?", r: "Na hora, na tela, assim que o Pix é confirmado. Ela também fica guardada neste aparelho. Anote num lugar seguro." },
    { p: "Posso comprar mais de uma chave com o mesmo e-mail?", r: "Pode, quantas quiser — para um amigo ou para outro celular. Cada Pix pago gera uma chave nova, e todas ficam ligadas ao seu e-mail. Cada chave abre o jogo em até 3 aparelhos." },
    { p: "Perdi minha chave. E agora?", r: "Chame a gente no Discord, no grupo do WhatsApp ou no Telegram com o e-mail que você usou no Pix. A gente encontra." },
    { p: "Vi alguém usando hack.", r: "Grave a tela e mande no Discord, no grupo do WhatsApp ou no Telegram. Cada conta tem um ID, e quem for pego é banido pelo painel de chaves." },
    { p: "O que acontece no fim da temporada?", r: "No servidor online, cada temporada dura 7 dias reais (168 horas). No fim, o mundo reinicia e todo mundo começa do zero — igual para todos." },
  ],
};
