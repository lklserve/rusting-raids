/* Página /recarga: chave (vem no #chave=… quando o botão Recarregar do jogo abre a página), pacote e
   e-mail → Pix → os cupons entram na chave. O preço sai do servidor; aqui só se escolhe o pacote. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const num = new Intl.NumberFormat("pt-BR");

  const etapas = { pedido: $('[data-etapa="pedido"]'), pix: $('[data-etapa="pix"]'), pronto: $('[data-etapa="pronto"]') };
  const campoChave = $("[data-chave]");
  const campoEmail = $("[data-email]");
  const caixaErro = $("[data-erro]");
  const botaoGerar = $("[data-gerar]");
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

  // Pacotes do servidor.
  const grade = $("[data-pacotes]");
  fetch("/api/loja/pacotes", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((j) => {
      const lista = j.pacotes || [];
      grade.querySelector(".carregando")?.remove();
      const g = document.createElement("div"); g.className = "pacotes__grade";
      lista.forEach((p, i) => {
        const total = p.cupons + p.bonus;
        const rotulo = document.createElement("label"); rotulo.className = "pacote";
        rotulo.innerHTML = `<input type="radio" name="pacote" value="${p.id}" ${i === 0 ? "checked" : ""}>
          <span class="pacote__cartao">
            <span class="pacote__cupons">${num.format(total)} <small>cupons</small></span>
            <span class="pacote__bonus">${p.bonus ? `+${num.format(p.bonus)} de bônus` : ""}</span>
            <span class="pacote__preco">${brl.format(p.reais)}</span>
          </span>`;
        g.appendChild(rotulo);
      });
      grade.appendChild(g);
    })
    .catch(() => { grade.querySelector(".carregando")?.remove(); erro("Não foi possível carregar os pacotes. Recarregue a página."); });

  etapas.pedido.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    erro("");
    const chave = normalizar(campoChave.value);
    const email = campoEmail.value.trim();
    const pacote = $('input[name="pacote"]:checked')?.value;
    campoChave.classList.toggle("invalido", !chave);
    if (!chave) return erro("Digite sua chave no formato RR-XXXX-XXXX.");
    if (!pacote) return erro("Escolha um pacote.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erro("Digite um e-mail válido.");
    campoChave.value = chave;
    try { localStorage.setItem("rr_recarga_email", email); } catch { /* sem armazenamento */ }

    botaoGerar.disabled = true;
    try {
      const r = await fetch("/api/pix/recarga", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ chave, pacote, email }),
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
    $("[data-pix-cupons]").textContent = num.format(pedido.cupons);
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
})();
