/* ==========================================================================
   Rusting Raids — site (sem biblioteca, sem build)
   ========================================================================== */
(() => {
  "use strict";

  const CFG = window.RR_CONFIG || {};
  const DADOS = window.RR_DADOS || { galeria: [], devblog: [], roadmap: [], faq: [] };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const movimentoReduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ponteiroFino = matchMedia("(pointer: fine)").matches;
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const dataLonga = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  /* armazenamento que nunca derruba a página (aba anônima, bloqueio de cookies…) */
  const guardar = {
    ler(chave, tipo = localStorage) { try { return JSON.parse(tipo.getItem(chave)); } catch { return null; } },
    gravar(chave, valor, tipo = localStorage) { try { tipo.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento */ } },
    apagar(chave, tipo = localStorage) { try { tipo.removeItem(chave); } catch { /* idem */ } },
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ------------------------------------------------------------ toast */
  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("mostrar");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("mostrar"), 2600);
  }

  async function copiar(texto, ok = "Copiado!") {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const t = document.createElement("textarea");
      t.value = texto;
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      try { document.execCommand("copy"); } catch { /* nada */ }
      t.remove();
    }
    toast(ok);
  }

  /* ------------------------------------------------------------ topo e menu */
  const topo = $("#topo");
  const menu = $("#menu");
  const hamburguer = $("#hamburguer");
  const barraMovel = $("#barra-movel");

  function aoRolar() {
    const y = window.scrollY;
    topo.classList.toggle("rolou", y > 24);
    barraMovel.classList.toggle("visivel", y > window.innerHeight * 0.6);
  }
  addEventListener("scroll", aoRolar, { passive: true });
  aoRolar();

  function fecharMenu() {
    menu.classList.remove("aberto");
    hamburguer.setAttribute("aria-expanded", "false");
    hamburguer.setAttribute("aria-label", "Abrir menu");
    document.body.style.overflow = "";
  }
  hamburguer.addEventListener("click", () => {
    const abrir = !menu.classList.contains("aberto");
    menu.classList.toggle("aberto", abrir);
    hamburguer.setAttribute("aria-expanded", String(abrir));
    hamburguer.setAttribute("aria-label", abrir ? "Fechar menu" : "Abrir menu");
    document.body.style.overflow = abrir ? "hidden" : "";
  });
  $$(".menu__link").forEach((a) => a.addEventListener("click", fecharMenu));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.classList.contains("aberto")) fecharMenu(); });

  /* link ativo conforme a seção na tela */
  const links = new Map($$(".menu__link").map((a) => [a.getAttribute("href").slice(1), a]));
  const obsSecao = new IntersectionObserver((ents) => {
    ents.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.classList.remove("ativo"));
      links.get(e.target.id)?.classList.add("ativo");
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) obsSecao.observe(s); });

  /* ------------------------------------------------------------ redes */
  const REDES = [
    ["discord", "Discord", "#i-discord"],
    ["whatsappGrupo", "Grupo", "#i-whatsapp"],
    ["whatsappCanal", "Canal", "#i-whatsapp"],
    ["tiktok", "TikTok", "#i-tiktok"],
  ];
  const htmlRedes = REDES.filter(([k]) => CFG.redes?.[k])
    .map(([k, nome, ic]) => `<a class="rede" href="${esc(CFG.redes[k])}" target="_blank" rel="noopener"><svg class="ic"><use href="${ic}"/></svg>${nome}</a>`)
    .join("");
  $$("[data-redes]").forEach((el) => { el.innerHTML = htmlRedes; el.hidden = !htmlRedes; });

  /* ------------------------------------------------------------ download */
  $$("[data-versao]").forEach((el) => { el.textContent = [CFG.versao, CFG.tamanhoApk].filter(Boolean).join(" · "); });
  $$("[data-baixar]").forEach((a) => {
    if (CFG.linkDownload) {
      a.href = CFG.linkDownload;
      a.target = "_blank";
      a.rel = "noopener";
    } else {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        toast("O link do APK sai em breve. Apoie e garanta sua chave!");
      });
    }
  });
  $$("[data-ano]").forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ------------------------------------------------------------ brasas (canvas) */
  (function brasas() {
    const cv = $("#brasas");
    if (!cv || movimentoReduzido) return;
    const ctx = cv.getContext("2d");
    let w, h, dpr, parts = [], rodando = true, raf;
    const QTD = innerWidth < 700 ? 36 : 70;

    function tamanho() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function nova(inicio) {
      return {
        x: Math.random() * w,
        y: inicio ? Math.random() * h : h + 10,
        r: Math.random() * 1.8 + .6,
        vy: -(Math.random() * .6 + .25),
        vx: (Math.random() - .5) * .3,
        vida: 0,
        max: Math.random() * 500 + 300,
        fase: Math.random() * Math.PI * 2,
        cor: Math.random() < .7 ? "255,140,40" : "255,70,40",
      };
    }
    function passo() {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const p of parts) {
        p.vida++;
        p.fase += .03;
        p.x += p.vx + Math.sin(p.fase) * .25;
        p.y += p.vy;
        const t = p.vida / p.max;
        const a = Math.max(0, Math.sin(Math.PI * Math.min(t, 1))) * (.55 + Math.sin(p.fase * 3) * .25);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `rgba(255,230,190,${a})`);
        g.addColorStop(.3, `rgba(${p.cor},${a * .8})`);
        g.addColorStop(1, `rgba(${p.cor},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
        if (t >= 1 || p.y < -20) Object.assign(p, nova(false));
      }
      if (rodando) raf = requestAnimationFrame(passo);
    }
    tamanho();
    parts = Array.from({ length: QTD }, () => nova(true));
    addEventListener("resize", tamanho);
    const obs = new IntersectionObserver(([e]) => {
      rodando = e.isIntersecting && !document.hidden;
      cancelAnimationFrame(raf);
      if (rodando) raf = requestAnimationFrame(passo);
    });
    obs.observe(cv);
    document.addEventListener("visibilitychange", () => {
      rodando = !document.hidden;
      cancelAnimationFrame(raf);
      if (rodando) raf = requestAnimationFrame(passo);
    });
    raf = requestAnimationFrame(passo);
  })();

  /* ------------------------------------------------------------ revelar e contadores */
  const obsRevelar = new IntersectionObserver((ents) => {
    ents.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("visivel");
      obsRevelar.unobserve(e.target);
    });
  }, { threshold: .12, rootMargin: "0px 0px -40px 0px" });
  function observarRevelar(raiz = document) { $$(".revelar:not(.visivel)", raiz).forEach((el) => obsRevelar.observe(el)); }
  observarRevelar();

  const obsContar = new IntersectionObserver((ents) => {
    ents.forEach((e) => {
      if (!e.isIntersecting) return;
      obsContar.unobserve(e.target);
      const alvo = parseFloat(e.target.dataset.contar);
      const casas = parseInt(e.target.dataset.casas || "0", 10);
      const fmt = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
      if (movimentoReduzido || alvo === 0) { e.target.textContent = fmt(alvo); return; }
      const t0 = performance.now(), dur = 1600;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        e.target.textContent = fmt(alvo * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: .6 });
  // o HTML já traz o número final (sem JS continua certo); só zera o que ainda vai animar
  $$("[data-contar]").forEach((el) => {
    if (!movimentoReduzido && parseFloat(el.dataset.contar) > 0 && el.getBoundingClientRect().top > innerHeight) el.textContent = "0";
    obsContar.observe(el);
  });

  /* ------------------------------------------------------------ inclinação dos cards (mouse) */
  if (ponteiroFino && !movimentoReduzido) {
    $$("[data-inclinar]").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.transform = `perspective(900px) rotateX(${(.5 - y) * 7}deg) rotateY(${(x - .5) * 9}deg) translateY(-4px)`;
        card.style.setProperty("--mx", `${x * 100}%`);
        card.style.setProperty("--my", `${y * 100}%`);
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    });
  }

  /* ------------------------------------------------------------ galeria */
  const galeria = (function montarGaleria() {
    const palco = $("#galeria-palco");
    const trilho = $("[data-trilho]", palco);
    const minis = $("[data-miniaturas]");
    const barra = $("[data-progresso]", palco);
    const itens = DADOS.galeria || [];
    if (!itens.length) { palco.closest("section").hidden = true; return null; }

    const src = (i) => `assets/img/galeria/${i.img}`;
    const mini = (i) => `assets/img/galeria/mini/${i.img}`;
    trilho.innerHTML = itens.map((it, n) => `
      <figure class="slide" role="group" aria-roledescription="imagem" aria-label="${n + 1} de ${itens.length}: ${esc(it.titulo)}" data-n="${n}">
        <img src="${src(it)}" alt="${esc(it.titulo)} — ${esc(it.texto)}" ${n > 1 ? 'loading="lazy"' : ""} decoding="async">
        <figcaption class="slide__legenda"><strong>${esc(it.titulo)}</strong><span>${esc(it.texto)}</span></figcaption>
        <span class="slide__ampliar" aria-hidden="true"><svg class="ic"><use href="#i-expandir"/></svg></span>
      </figure>`).join("");
    minis.innerHTML = itens.map((it, n) => `
      <button class="miniatura" type="button" role="tab" aria-selected="false" aria-label="${esc(it.titulo)}" data-n="${n}">
        <img alt="" decoding="async" data-mini="${n}">
      </button>`).join("");
    // Sem handler inline (o CSP proíbe): a miniatura tenta a versão pequena e cai na grande.
    $$("img[data-mini]", minis).forEach((img) => {
      const it = itens[+img.dataset.mini];
      img.addEventListener("error", function cai() { img.removeEventListener("error", cai); img.src = src(it); });
      img.src = mini(it);
    });

    let atual = 0, timer, t0 = 0, pausado = false;
    const DUR = 6000;

    function ir(n, usuario = false) {
      atual = (n + itens.length) % itens.length;
      trilho.style.transform = `translateX(${-atual * 100}%)`;
      $$(".miniatura", minis).forEach((b, i) => b.setAttribute("aria-selected", String(i === atual)));
      const ativa = $(`.miniatura[data-n="${atual}"]`, minis);
      if (ativa) minis.scrollTo({ left: ativa.offsetLeft - minis.clientWidth / 2 + ativa.clientWidth / 2, behavior: movimentoReduzido ? "auto" : "smooth" });
      if (usuario) reiniciar();
    }
    function reiniciar() { t0 = performance.now(); }
    function loop(t) {
      if (!pausado && !movimentoReduzido) {
        const k = (t - t0) / DUR;
        barra.style.width = `${Math.min(1, k) * 100}%`;
        if (k >= 1) { ir(atual + 1); reiniciar(); }
      }
      timer = requestAnimationFrame(loop);
    }

    $("[data-ant]", palco).addEventListener("click", () => ir(atual - 1, true));
    $("[data-prox]", palco).addEventListener("click", () => ir(atual + 1, true));
    minis.addEventListener("click", (e) => { const b = e.target.closest(".miniatura"); if (b) ir(+b.dataset.n, true); });
    palco.addEventListener("pointerenter", () => { pausado = true; });
    palco.addEventListener("pointerleave", () => { pausado = false; reiniciar(); });
    palco.tabIndex = 0;
    palco.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") ir(atual - 1, true);
      if (e.key === "ArrowRight") ir(atual + 1, true);
      if (e.key === "Enter") abrirLightbox(atual);
    });

    /* arrastar / deslizar */
    let xIni = null, dx = 0, arrastou = false;
    palco.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      xIni = e.clientX; dx = 0; arrastou = false;
      trilho.classList.add("arrastando");
    });
    addEventListener("pointermove", (e) => {
      if (xIni === null) return;
      dx = e.clientX - xIni;
      if (Math.abs(dx) > 6) arrastou = true;
      trilho.style.transform = `translateX(calc(${-atual * 100}% + ${dx}px))`;
    });
    addEventListener("pointerup", () => {
      if (xIni === null) return;
      trilho.classList.remove("arrastando");
      const limite = palco.clientWidth * .15;
      if (dx > limite) ir(atual - 1, true);
      else if (dx < -limite) ir(atual + 1, true);
      else ir(atual);
      xIni = null;
    });
    palco.addEventListener("click", (e) => {
      if (arrastou || e.target.closest("button")) return;
      const s = e.target.closest(".slide");
      if (s) abrirLightbox(+s.dataset.n);
    });

    /* lightbox */
    const lb = $("#lightbox");
    const lbImg = $("[data-lb-img]", lb), lbLeg = $("[data-lb-legenda]", lb);
    let lbN = 0;
    function mostrarLb(n) {
      lbN = (n + itens.length) % itens.length;
      const it = itens[lbN];
      lbImg.src = src(it);
      lbImg.alt = it.titulo;
      lbLeg.innerHTML = `${esc(it.titulo)}<span>${esc(it.texto)}</span>`;
    }
    function abrirLightbox(n) { mostrarLb(n); pausado = true; lb.showModal(); }
    $("[data-lb-ant]", lb).addEventListener("click", () => mostrarLb(lbN - 1));
    $("[data-lb-prox]", lb).addEventListener("click", () => mostrarLb(lbN + 1));
    lb.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") mostrarLb(lbN - 1);
      if (e.key === "ArrowRight") mostrarLb(lbN + 1);
    });
    lb.addEventListener("close", () => { pausado = false; ir(lbN); reiniciar(); });
    let lbX = null;
    lb.addEventListener("pointerdown", (e) => { lbX = e.clientX; });
    lb.addEventListener("pointerup", (e) => {
      if (lbX === null) return;
      const d = e.clientX - lbX; lbX = null;
      if (d > 50) mostrarLb(lbN - 1); else if (d < -50) mostrarLb(lbN + 1);
    });

    ir(0);
    reiniciar();
    timer = requestAnimationFrame(loop);
    return { ir };
  })();

  /* ------------------------------------------------------------ devblog */
  (function montarDevblog() {
    const posts = [...(DADOS.devblog || [])];
    const abas = $("[data-abas]");
    const grade = $("[data-blog]");
    const TIPOS = { todos: "Todos", devblog: "Devblog", atualizacao: "Atualização", patch: "Patch", noticia: "Notícia" };
    const cont = posts.reduce((m, p) => ((m[p.tipo] = (m[p.tipo] || 0) + 1), m), {});
    const usados = ["todos", ...Object.keys(TIPOS).filter((t) => t !== "todos" && cont[t])];
    abas.innerHTML = usados.map((t, i) => `<button class="aba" type="button" role="tab" aria-selected="${i === 0}" data-tipo="${t}">${TIPOS[t]}<sup>${t === "todos" ? posts.length : cont[t]}</sup></button>`).join("");

    const fmtData = (d) => dataLonga.format(new Date(`${d}T12:00:00`)).replace(/\./g, "");
    function cartao(p, destaque) {
      return `
        <button class="post ${destaque ? "post--destaque" : ""}" type="button" data-post="${esc(p.id)}">
          <div class="post__img">
            <img src="assets/img/galeria/${esc(p.img)}" alt="" ${destaque ? "" : 'loading="lazy"'}>
          </div>
          <div class="post__corpo">
            <div class="post__meta"><span class="post__data">${fmtData(p.data)}</span><span class="etiqueta etiqueta--${p.tipo}">${TIPOS[p.tipo] || p.tipo}</span></div>
            <h3>${esc(p.titulo)}${p.sub ? ` <small>${esc(p.sub)}</small>` : ""}</h3>
            <p class="post__resumo">${esc(p.resumo)}</p>
            <span class="post__mais">Ler mais <svg class="ic"><use href="#i-seta"/></svg></span>
          </div>
        </button>`;
    }
    function filtrar(tipo) {
      const lista = tipo === "todos" ? posts : posts.filter((p) => p.tipo === tipo);
      grade.innerHTML = lista.map((p, i) => cartao(p, i === 0)).join("") || `<p>Nada por aqui ainda.</p>`;
    }
    abas.addEventListener("click", (e) => {
      const b = e.target.closest(".aba");
      if (!b) return;
      $$(".aba", abas).forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      filtrar(b.dataset.tipo);
    });
    filtrar("todos");

    const modal = $("#modal-post");
    const corpo = $("[data-post]", modal);
    grade.addEventListener("click", (e) => {
      const b = e.target.closest("[data-post]");
      if (!b) return;
      const p = posts.find((x) => x.id === b.dataset.post);
      if (!p) return;
      const blocos = (p.conteudo || []).map((c) => {
        if (c.h) return `<h4>${esc(c.h)}</h4>`;
        if (c.p) return `<p>${esc(c.p)}</p>`;
        if (c.ul) return `<ul>${c.ul.map((li) => `<li>${esc(li)}</li>`).join("")}</ul>`;
        return "";
      }).join("");
      corpo.innerHTML = `
        <article class="artigo">
          <div class="artigo__capa"><img src="assets/img/galeria/${esc(p.img)}" alt=""></div>
          <div class="artigo__meta"><span class="post__data">${fmtData(p.data)}</span><span class="etiqueta etiqueta--${p.tipo}">${TIPOS[p.tipo] || p.tipo}</span></div>
          <h2 id="post-titulo">${esc(p.titulo)}${p.sub ? `<small>${esc(p.sub)}</small>` : ""}</h2>
          ${blocos}
        </article>`;
      modal.showModal();
      $(".modal__caixa", modal).scrollTop = 0;
    });
  })();

  /* ------------------------------------------------------------ roadmap e FAQ */
  (function montarRoadmap() {
    const ol = $("[data-roadmap]");
    const NOMES = { feito: "Feito", fazendo: "Em andamento", proximo: "Próximo" };
    ol.innerHTML = (DADOS.roadmap || []).map((m) => `
      <li class="marco marco--${m.estado} revelar">
        <div class="marco__topo"><h3>${esc(m.titulo)}</h3><span class="estado estado--${m.estado}">${NOMES[m.estado] || m.estado}</span></div>
        <p>${esc(m.texto)}</p>
      </li>`).join("");
    const faq = $("[data-faq]");
    faq.innerHTML = (DADOS.faq || []).map((f) => `<details class="revelar"><summary>${esc(f.p)}</summary><div>${esc(f.r)}</div></details>`).join("");
    observarRevelar();
  })();

  /* fechar modais pelo X, pelo fundo e mantendo o rolar da página parado */
  $$("dialog").forEach((d) => {
    d.addEventListener("click", (e) => {
      if (e.target.closest("[data-fechar]")) { d.close(); return; }
      if (e.target === d) d.close();   // clique fora da caixa
    });
    d.addEventListener("close", () => { if (!$$("dialog[open]").length) document.documentElement.style.overflow = ""; });
    const abrir = d.showModal.bind(d);
    d.showModal = () => { document.documentElement.style.overflow = "hidden"; abrir(); };
  });

  /* ------------------------------------------------------------ meta do apoio */
  (function meta() {
    const m = CFG.meta || { arrecadado: 0, objetivo: 1 };
    const pct = Math.max(0, Math.min(100, (m.arrecadado / (m.objetivo || 1)) * 100));
    $$("[data-meta-titulo]").forEach((el) => { el.textContent = m.titulo || "Meta do mês"; });
    $$("[data-meta-pct]").forEach((el) => { el.textContent = `${pct.toFixed(pct < 10 && pct > 0 ? 1 : 0).replace(".", ",")}%`; });
    $$("[data-meta-valor]").forEach((el) => {
      el.textContent = m.arrecadado > 0 ? `${brl.format(m.arrecadado)} arrecadados` : "Seja o primeiro a apoiar";
    });
    $$("[data-meta-objetivo]").forEach((el) => { el.textContent = `meta ${brl.format(m.objetivo)}`; });
    const obs = new IntersectionObserver((ents) => ents.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.style.width = `${Math.max(pct, pct > 0 ? 2 : 0)}%`;
      obs.unobserve(e.target);
    }), { threshold: .5 });
    $$("[data-meta-barra]").forEach((el) => obs.observe(el));
  })();

  /* ------------------------------------------------------------ APOIO (Pix) */
  const apoio = (function montarApoio() {
    const A = CFG.apoio || {};
    const MIN = A.minimo ?? 5, MAX = A.maximo ?? 100;
    const modal = $("#modal-apoio");
    const slider = $("#valor-slider");
    const saida = $("#valor-saida b");
    const patente = $("[data-patente]", modal);
    const email = $("#apoio-email");
    const erro = $("[data-erro]", modal);
    const botaoValor = $("[data-valor-botao]", modal);
    const demo = !A.api;
    const ATIVO = "rr_pedido_ativo", MINHA = "rr_minha_chave";
    let valor = Math.min(MAX, Math.max(MIN, A.inicial ?? 10));
    let pedido = null, timerStatus, timerRelogio;

    slider.min = MIN; slider.max = MAX; slider.value = valor;
    $(".deslizante__marcas", modal).innerHTML = `<span>${brl.format(MIN).replace(",00", "")}</span><span>${brl.format(Math.round((MIN + MAX) / 2)).replace(",00", "")}</span><span>${brl.format(MAX).replace(",00", "")}</span>`;

    function nomePatente(v) {
      let nome = "";
      for (const p of A.patentes || []) if (v >= p.de) nome = p.nome;
      return nome;
    }
    function mostrarValor(v) {
      valor = Math.min(MAX, Math.max(MIN, Math.round(v)));
      slider.value = valor;
      const pct = ((valor - MIN) / (MAX - MIN)) * 100;
      slider.style.setProperty("--pct", `${pct}%`);
      saida.textContent = valor;
      botaoValor.textContent = brl.format(valor);
      const nome = nomePatente(valor);
      if (patente.textContent !== nome) {
        patente.textContent = nome;
        patente.animate?.([{ transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 250 });
      }
      $$("[data-rapidos] button", modal).forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.valor === valor)));
    }
    slider.addEventListener("input", () => mostrarValor(+slider.value));
    $("[data-rapidos]", modal).addEventListener("click", (e) => {
      const b = e.target.closest("button[data-valor]");
      if (b) mostrarValor(+b.dataset.valor);
    });
    mostrarValor(valor);
    email.value = guardar.ler("rr_email") || "";

    function etapa(nome) {
      $$(".etapa", modal).forEach((el) => { el.hidden = el.dataset.etapa !== nome; });
      $(".modal__caixa", modal).scrollTop = 0;
      if (nome === "valor") setTimeout(() => slider.focus({ preventScroll: true }), 60);
    }
    function abrir(qual) {
      const ativo = guardar.ler(ATIVO);
      if (!qual && ativo && new Date(ativo.expiraEm) > new Date()) {
        mostrarPix(ativo);
        qual = "pix";
      }
      etapa(qual || "valor");
      if (!modal.open) modal.showModal();
    }
    modal.addEventListener("click", (e) => {
      const ir = e.target.closest("[data-ir]");
      if (ir) etapa(ir.dataset.ir);
      if (e.target.closest("[data-mais-tarde]")) guardar.gravar("rr_convite_visto", true, sessionStorage);
    });
    modal.addEventListener("close", () => { clearInterval(timerRelogio); clearTimeout(timerStatus); });
    $$("[data-abrir-apoio]").forEach((b) => b.addEventListener("click", () => { fecharMenu(); abrir(); }));

    /* --- gerar o Pix */
    const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
    $("[data-gerar-pix]", modal).addEventListener("click", async (e) => {
      const b = e.currentTarget;
      const em = email.value.trim();
      if (!emailOk(em)) {
        email.classList.add("invalido");
        erro.textContent = "Digite um e-mail válido — é por ele que a gente acha a sua chave.";
        erro.hidden = false;
        email.focus();
        return;
      }
      email.classList.remove("invalido");
      erro.hidden = true;
      guardar.gravar("rr_email", em);
      b.disabled = true;
      try {
        const p = demo ? await pixDeDemonstracao(valor) : await pixDeVerdade(valor, em);
        guardar.gravar(ATIVO, p);
        mostrarPix(p);
        etapa("pix");
      } catch (err) {
        $("[data-erro-texto]", modal).textContent = err?.message || "Tente de novo em instantes.";
        etapa("erro");
      } finally {
        b.disabled = false;
      }
    });
    email.addEventListener("input", () => { email.classList.remove("invalido"); erro.hidden = true; });

    async function pixDeVerdade(v, em) {
      const r = await fetch(`${A.api}/criar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: v, email: em }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || "Não foi possível gerar o Pix agora.");
      return j;
    }
    async function pixDeDemonstracao(v) {
      await new Promise((r) => setTimeout(r, 700));
      return {
        pedidoId: `demo-${Date.now()}`,
        valor: v,
        qrBase64: null,
        copiaECola: "00020126DEMONSTRACAO-RUSTING-RAIDS-ESTE-CODIGO-NAO-E-UM-PIX-DE-VERDADE6304DEMO",
        expiraEm: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        demo: true,
      };
    }

    function mostrarPix(p) {
      pedido = p;
      $("[data-pix-valor]", modal).textContent = brl.format(p.valor);
      $("[data-pix-codigo]", modal).value = p.copiaECola || "";
      $("[data-aviso-demo]", modal).hidden = !p.demo;
      $("[data-simular]", modal).hidden = !p.demo;
      const qr = $("[data-qr]", modal);
      if (p.qrBase64) qr.innerHTML = `<img src="data:image/png;base64,${p.qrBase64}" alt="QR Code do Pix">`;
      else { qr.innerHTML = ""; qr.appendChild(qrDeDemonstracao(p.pedidoId)); }
      relogio(p.expiraEm);
      if (!p.demo) consultar();
    }

    function relogio(ate) {
      clearInterval(timerRelogio);
      const el = $("[data-pix-tempo]", modal);
      const tick = () => {
        const s = Math.max(0, Math.round((new Date(ate) - Date.now()) / 1000));
        el.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
        if (s <= 0) {
          clearInterval(timerRelogio);
          guardar.apagar(ATIVO);
          $("[data-erro-texto]", modal).textContent = "O Pix expirou. Gere um novo — leva um segundo.";
          etapa("erro");
        }
      };
      tick();
      timerRelogio = setInterval(tick, 1000);
    }

    async function consultar() {
      clearTimeout(timerStatus);
      if (!pedido || pedido.demo || !modal.open) return;
      try {
        const r = await fetch(`${A.api}/status?pedido=${encodeURIComponent(pedido.pedidoId)}`);
        const j = await r.json();
        if (j.status === "aprovado" && j.chave) { aprovado(j.chave); return; }
        if (j.status === "expirado") { guardar.apagar(ATIVO); etapa("erro"); return; }
      } catch { /* rede instável: segue tentando */ }
      timerStatus = setTimeout(consultar, A.intervaloDeConsulta || 4000);
    }

    // Só existe no modo demonstração: no Pix real o botão não faz nada, mesmo que alguém o revele.
    $("[data-simular]", modal).addEventListener("click", () => {
      if (!pedido?.demo) return;
      aprovado(chaveDeDemonstracao());
    });
    $("[data-copiar-pix]", modal).addEventListener("click", () => copiar($("[data-pix-codigo]", modal).value, "Código Pix copiado!"));
    $("[data-copiar-chave]", modal).addEventListener("click", () => copiar($("[data-chave]", modal).textContent, "Chave copiada!"));

    function aprovado(chave) {
      clearInterval(timerRelogio);
      guardar.apagar(ATIVO);
      guardar.gravar(MINHA, { chave, em: new Date().toISOString(), demo: !!pedido?.demo });
      $("[data-chave]", modal).textContent = chave;
      etapa("chave");
      explodir($(".explosao", modal));
      mostrarMinhaChave();
    }

    function explodir(el) {
      if (!el || movimentoReduzido) return;
      el.innerHTML = "";
      for (let i = 0; i < 26; i++) {
        const s = document.createElement("i");
        const ang = Math.random() * Math.PI * 2, dist = 80 + Math.random() * 180;
        s.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
        s.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
        s.style.animationDelay = `${Math.random() * .12}s`;
        el.appendChild(s);
      }
    }

    function chaveDeDemonstracao() {
      const ALF = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const r = new Uint32Array(8);
      crypto.getRandomValues(r);
      const s = [...r].map((n) => ALF[n % ALF.length]).join("");
      return `RR-${s.slice(0, 4)}-${s.slice(4)}`;
    }

    /* QR de mentira para a demonstração (não é Pix e diz isso) */
    function qrDeDemonstracao(semente) {
      const N = 29, cv = document.createElement("canvas"), px = 8;
      cv.width = cv.height = N * px;
      const c = cv.getContext("2d");
      let h = 0;
      for (const ch of String(semente)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const rnd = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296);
      c.fillStyle = "#fff"; c.fillRect(0, 0, cv.width, cv.height);
      c.fillStyle = "#111";
      const olho = (x, y) => {
        c.fillRect(x * px, y * px, 7 * px, 7 * px);
        c.fillStyle = "#fff"; c.fillRect((x + 1) * px, (y + 1) * px, 5 * px, 5 * px);
        c.fillStyle = "#111"; c.fillRect((x + 2) * px, (y + 2) * px, 3 * px, 3 * px);
      };
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const noOlho = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
        if (!noOlho && rnd() < .47) c.fillRect(x * px, y * px, px, px);
      }
      olho(0, 0); olho(N - 7, 0); olho(0, N - 7);
      c.fillStyle = "rgba(214,35,28,.92)";
      c.fillRect(0, cv.height / 2 - 18, cv.width, 36);
      c.fillStyle = "#fff";
      c.font = "700 22px 'Barlow Condensed', sans-serif";
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("DEMONSTRAÇÃO", cv.width / 2, cv.height / 2 + 1);
      cv.setAttribute("role", "img");
      cv.setAttribute("aria-label", "QR de demonstração — não é um Pix de verdade");
      return cv;
    }

    function mostrarMinhaChave() {
      const minha = guardar.ler(MINHA);
      const el = $("[data-minha-chave]");
      if (!el) return;
      if (minha?.chave) {
        el.innerHTML = `Sua chave neste aparelho: <code>${esc(minha.chave)}</code>${minha.demo ? " (demonstração)" : ""}`;
        el.hidden = false;
      }
    }
    mostrarMinhaChave();

    /* convite ao abrir (uma vez por sessão) */
    const semConvite = /[?&]semconvite\b/.test(location.search);
    if (CFG.conviteAoAbrir && !semConvite && !guardar.ler("rr_convite_visto", sessionStorage)) {
      setTimeout(() => {
        if ($$("dialog[open]").length) return;
        guardar.gravar("rr_convite_visto", true, sessionStorage);
        etapa("convite");
        modal.showModal();
      }, CFG.atrasoDoConvite ?? 1400);
    }

    return { abrir };
  })();

  void galeria; void apoio;
})();
