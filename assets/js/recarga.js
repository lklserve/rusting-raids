/* Página /recarga: chave (vem no #chave=… quando o botão Recarregar do jogo abre a página), pacote e
   e-mail → Pix → os cupons entram na chave. O preço sai do servidor; aqui só se escolhe o pacote.
   OUTRO VALOR (29/10): o último cartão abre o campo do valor (R$ 5 a R$ 500, reais inteiros) e a conta ao vivo dos
   cupons com o bônus, que sobe de 5% a 80%. A conta é a mesma do servidor (api/_lib/recarga.js), com os números que o
   /api/loja/pacotes manda em "livre"; o Pix sai com os cupons que o SERVIDOR calcular. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const brlInteiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat("pt-BR");
  const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

  const etapas = { pedido: $('[data-etapa="pedido"]'), pix: $('[data-etapa="pix"]'), pronto: $('[data-etapa="pronto"]') };
  const campoChave = $("[data-chave]");
  const campoEmail = $("[data-email]");
  const caixaErro = $("[data-erro]");
  const botaoGerar = $("[data-gerar]");
  const campoAceite = $("[data-aceite]");   // value = a versão dos Termos aceita (vai no pedido como prova)
  let pedido = null, consulta = null, relogio = null;

  function mostrar(nome) {
    Object.entries(etapas).forEach(([k, el]) => { el.hidden = k !== nome; });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function erro(msg) { caixaErro.textContent = msg || ""; caixaErro.hidden = !msg; }

  // RR-XXXX-XXXX a partir do que a pessoa digitou (ou do #chave=).
  function normalizar(s) {
    const limpo = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return limpo.length === 10 && limpo.startsWith("RR") ? `RR-${limpo.slice(2, 6)}-${limpo.slice(6)}` : "";
  }

  // A chave vem no # (o navegador não manda o # a servidor nenhum) e some da barra de endereço.
  const doHash = new URLSearchParams(location.hash.slice(1)).get("chave");
  if (doHash) {
    campoChave.value = normalizar(doHash) || doHash;
    history.replaceState(null, "", location.pathname);
  }
  try { const e = localStorage.getItem("rr_recarga_email"); if (e) campoEmail.value = e; } catch { /* sem armazenamento */ }

  // Pacotes do servidor. Com a chave digitada, o servidor diz se ela ainda tem a RECARGA EM DOBRO: aí o aviso
  // aparece e cada pacote mostra o dobro (quem dá o dobro é o banco, na hora do crédito; aqui é só o que se vê).
  const grade = $("[data-pacotes]");
  const aviso = $("[data-dobro]");
  const escada = $("[data-escada]");
  const caixaLivre = $("[data-livre]");
  const campoLivre = $("[data-livre-valor]");
  const contaLivre = $("[data-livre-conta]");
  let chavePedida = null;
  let livre = null;          // { minimo, maximo, cuponsPorReal, bonusMinimo, bonusMaximo } do servidor
  let emDobroAgora = false;

  // A conta do servidor (api/_lib/recarga.js, bonusDaRecarga), inteira, para o número daqui ser o mesmo de lá.
  function bonusDe(v) {
    const { minimo, maximo, cuponsPorReal, bonusMinimo, bonusMaximo } = livre;
    const faixa = maximo - minimo;
    return Math.floor(v * cuponsPorReal * (bonusMinimo * faixa + (bonusMaximo - bonusMinimo) * (v - minimo)) / (100 * faixa));
  }
  const porcentoDe = (v) => livre.bonusMinimo + (livre.bonusMaximo - livre.bonusMinimo) * (v - livre.minimo) / (livre.maximo - livre.minimo);
  // Reais inteiros dentro da faixa ("12" e "12,00" valem), senão null.
  function valorDigitado() {
    const s = String(campoLivre.value || "").trim().replace(",", ".");
    if (!livre || !/^\d{1,4}(\.0{1,2})?$/.test(s)) return null;
    const n = Number(s);
    return Number.isInteger(n) && n >= livre.minimo && n <= livre.maximo ? n : null;
  }
  function faixaTexto() { return `de ${brlInteiro.format(livre.minimo)} a ${brlInteiro.format(livre.maximo)}`; }

  function atualizarLivre() {
    const escolhido = $('input[name="pacote"]:checked')?.value === "livre";
    caixaLivre.hidden = !escolhido || !livre;
    if (caixaLivre.hidden) return;
    const v = valorDigitado();
    campoLivre.classList.remove("invalido");
    campoLivre.setAttribute("aria-invalid", "false");
    if (v === null) {
      const vazio = !String(campoLivre.value || "").trim();
      contaLivre.className = "livre__conta" + (vazio ? "" : " livre__conta--erro");
      contaLivre.textContent = vazio ? `Digite quanto quer recarregar, ${faixaTexto()}.`
                                     : `Use reais inteiros, ${faixaTexto()}.`;
      return;
    }
    const base = v * livre.cuponsPorReal, bonus = bonusDe(v), total = base + bonus;
    contaLivre.className = "livre__conta";
    contaLivre.innerHTML = `<span>${num.format(base)} cupons + <b>${num.format(bonus)} de bônus</b> (${pct.format(porcentoDe(v))}%)</span>
      <strong>= ${num.format(total)} cupons</strong>` +
      (emDobroAgora ? `<span class="livre__dobro">Com a recarga em dobro: <b>${num.format(total * 2)} cupons</b></span>` : "");
  }

  function desenhar(lista, emDobro) {
    const marcado = $('input[name="pacote"]:checked')?.value;
    emDobroAgora = emDobro;
    grade.querySelector(".pacotes__grade")?.remove();
    const g = document.createElement("div"); g.className = "pacotes__grade";
    lista.forEach((p, i) => {
      const total = p.cupons + p.bonus;
      const recebe = emDobro ? total * 2 : total;
      const rotulo = document.createElement("label"); rotulo.className = "pacote" + (emDobro ? " pacote--dobro" : "");
      const escolhido = marcado ? marcado === p.id : i === 0;
      rotulo.innerHTML = `<input type="radio" name="pacote" value="${p.id}" ${escolhido ? "checked" : ""}>
        <span class="pacote__cartao">
          ${emDobro ? `<span class="pacote__antes">${num.format(total)}</span>` : ""}
          <span class="pacote__cupons">${num.format(recebe)} <small>cupons</small></span>
          <span class="pacote__bonus">${emDobro ? "em dobro nesta recarga" : p.bonus ? `+${num.format(p.bonus)} de bônus` : ""}</span>
          <span class="pacote__preco">${brl.format(p.reais)}</span>
        </span>`;
      g.appendChild(rotulo);
    });
    if (livre) {
      // O cartão "Outro valor": abre o campo e a conta logo abaixo da grade.
      const rotulo = document.createElement("label"); rotulo.className = "pacote pacote--livre";
      rotulo.innerHTML = `<input type="radio" name="pacote" value="livre" ${marcado === "livre" ? "checked" : ""}>
        <span class="pacote__cartao">
          <span class="pacote__cupons">Outro <small>valor</small></span>
          <span class="pacote__bonus">até ${num.format(livre.bonusMaximo)}% de bônus</span>
          <span class="pacote__preco">${faixaTexto()}</span>
        </span>`;
      g.appendChild(rotulo);
      escada.textContent = `Quanto maior a recarga, maior o bônus: ${num.format(livre.bonusMinimo)}% em ${brlInteiro.format(livre.minimo)}, ` +
                           `subindo até ${num.format(livre.bonusMaximo)}% em ${brlInteiro.format(livre.maximo)}.`;
      $("[data-livre-faixa]").textContent = `(${faixaTexto()}, em reais inteiros)`;
    }
    escada.hidden = !livre;
    grade.appendChild(g);
    aviso.hidden = !emDobro;
    atualizarLivre();
  }
  grade.addEventListener("change", (ev) => {
    if (ev.target.name !== "pacote") return;
    erro("");
    atualizarLivre();
    if (ev.target.value === "livre") campoLivre.focus();
  });
  // Mexer no valor apaga o erro de antes (o "Digite o valor…" de uma tentativa com valor fora da faixa).
  campoLivre.addEventListener("input", () => { erro(""); atualizarLivre(); });
  function carregarPacotes(chave) {
    chavePedida = chave || "";
    const pedidoDaVez = chavePedida;
    const url = chave ? `/api/loja/pacotes?chave=${encodeURIComponent(chave)}` : "/api/loja/pacotes";
    return fetch(url, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        if (pedidoDaVez !== chavePedida) return;   // a pessoa já trocou a chave
        grade.querySelector(".carregando")?.remove();
        livre = j.livre && j.livre.maximo > j.livre.minimo ? j.livre : null;
        desenhar(j.pacotes || [], !!j.emDobro);
      })
      .catch(() => { grade.querySelector(".carregando")?.remove(); erro("Não foi possível carregar os pacotes. Recarregue a página."); });
  }
  carregarPacotes(normalizar(campoChave.value));
  let espera = null;
  campoChave.addEventListener("input", () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      const c = normalizar(campoChave.value);
      if (c !== chavePedida) carregarPacotes(c);
    }, 400);
  });

  etapas.pedido.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    erro("");
    const chave = normalizar(campoChave.value);
    const email = campoEmail.value.trim();
    const pacote = $('input[name="pacote"]:checked')?.value;
    campoChave.classList.toggle("invalido", !chave);
    campoChave.setAttribute("aria-invalid", String(!chave));
    if (!chave) { campoChave.focus(); return erro("Digite sua chave no formato RR-XXXX-XXXX."); }
    if (!pacote) return erro("Escolha um pacote.");
    const valor = pacote === "livre" ? valorDigitado() : null;
    if (pacote === "livre" && valor === null) {
      campoLivre.classList.add("invalido");
      campoLivre.setAttribute("aria-invalid", "true");
      campoLivre.focus();
      return erro(livre ? `Digite o valor da recarga em reais inteiros, ${faixaTexto()}.` : "Escolha um pacote.");
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    campoEmail.setAttribute("aria-invalid", String(!emailOk));
    if (!emailOk) { campoEmail.focus(); return erro("Digite um e-mail válido."); }
    // Decreto 7.962/2013, art. 4º: o comprador vê e aceita as condições antes de pagar.
    if (campoAceite && !campoAceite.checked) {
      campoAceite.closest(".aceite")?.classList.add("invalido");
      campoAceite.setAttribute("aria-invalid", "true");
      campoAceite.focus();
      return erro("Para gerar o Pix, marque que leu e aceita os Termos de Serviço e a Política de Reembolso.");
    }
    campoChave.value = chave;
    try { localStorage.setItem("rr_recarga_email", email); } catch { /* sem armazenamento */ }

    botaoGerar.disabled = true;
    try {
      const r = await fetch("/api/pix/recarga", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ chave, pacote, ...(valor !== null ? { valor } : {}), email, aceite: campoAceite?.value || "" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.pedidoId) throw new Error(j.erro || "Não foi possível gerar o Pix.");
      pedido = { ...j, chave };
      abrirPix();
    } catch (e) {
      erro(e.message);
    } finally {
      botaoGerar.disabled = false;
    }
  });

  function abrirPix() {
    $("[data-pix-valor]").textContent = brl.format(pedido.valor);
    $("[data-pix-cupons]").textContent = num.format(pedido.cupons) + (pedido.emDobro ? " (recarga em dobro)" : "");
    $("[data-pix-codigo]").value = pedido.copiaECola || "";
    const qr = $("[data-qr]");
    qr.innerHTML = "";
    if (pedido.qrBase64) {
      const img = new Image(); img.alt = "QR Code do Pix"; img.width = 220; img.height = 220;
      img.src = `data:image/png;base64,${pedido.qrBase64}`;
      qr.appendChild(img);
    }
    mostrar("pix");
    iniciarRelogio();
    pararConsulta();
    consulta = setInterval(consultar, 4000);
  }

  function iniciarRelogio() {
    clearInterval(relogio);
    const fim = pedido.expiraEm ? new Date(pedido.expiraEm).getTime() : Date.now() + 30 * 60 * 1000;
    const tick = () => {
      const s = Math.max(0, Math.round((fim - Date.now()) / 1000));
      $("[data-pix-tempo]").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
      if (s === 0) clearInterval(relogio);
    };
    tick(); relogio = setInterval(tick, 1000);
  }

  function pararConsulta() { clearInterval(consulta); consulta = null; }

  async function consultar() {
    if (!pedido) return;
    try {
      const r = await fetch(`/api/pix/status?pedido=${encodeURIComponent(pedido.pedidoId)}`, { headers: { Accept: "application/json" } });
      const j = await r.json();
      if (j.status === "aprovado") {
        pararConsulta(); clearInterval(relogio);
        $("[data-pronto-cupons]").textContent = num.format(j.cupons ?? pedido.cupons);
        $("[data-pronto-chave]").textContent = pedido.chave;
        $("[data-pronto-saldo]").textContent = num.format(j.saldo ?? 0);
        mostrar("pronto");
      } else if (j.status === "expirado") {
        pararConsulta();
        mostrar("pedido");
        erro("O Pix expirou. Gere outro quando quiser.");
      }
    } catch { /* segue tentando */ }
  }

  $("[data-copiar]").addEventListener("click", async () => {
    const c = $("[data-pix-codigo]");
    try { await navigator.clipboard.writeText(c.value); } catch { c.select(); document.execCommand("copy"); }
    const t = $("[data-copiar] span"); t.textContent = "Copiado!"; setTimeout(() => { t.textContent = "Copiar"; }, 1800);
  });

  $("[data-voltar]").addEventListener("click", () => { pararConsulta(); clearInterval(relogio); pedido = null; mostrar("pedido"); });
  campoAceite?.addEventListener("change", () => {
    campoAceite.closest(".aceite")?.classList.remove("invalido");
    campoAceite.setAttribute("aria-invalid", "false");
    erro("");
  });
})();
