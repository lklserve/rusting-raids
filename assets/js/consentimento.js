/* ==========================================================================
   Rusting Raids — aviso de privacidade e armazenamento no navegador (24/10)
   O site NÃO usa cookies, anúncios nem rastreamento. Ele guarda neste navegador só o que faz o site funcionar
   (as chaves compradas aqui, os Pix em andamento, o e-mail digitado e as preferências), então o aviso informa
   e não pede permissão para nada: pela LGPD e pelo guia de cookies da ANPD, o armazenamento estritamente
   necessário não depende de consentimento.
   Se um dia entrar estatística ou anúncio, o script dele só pode rodar quando
   RR_CONSENTIMENTO.permitido("<categoria>") for verdadeiro, a categoria entra em OPCIONAIS (desligada) e o aviso
   ganha o interruptor dela, com "Recusar" tão fácil quanto "Aceitar".
   Carregado em todas as páginas, antes do app.js.
   ========================================================================== */
(() => {
  "use strict";

  const CHAVE = "rr_aviso_privacidade";
  const VERSAO = 1;          // subir quando a Política mudar de um jeito que o visitante precise ver o aviso de novo
  const OPCIONAIS = {};      // ex.: { estatisticas: false } — hoje não há nenhuma categoria opcional

  const ler = () => { try { return JSON.parse(localStorage.getItem(CHAVE)); } catch { return null; } };
  const gravar = (v) => { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
  const respondido = () => ler()?.versao === VERSAO;

  // Tudo o que o site guarda começa com "rr_" (lista completa na Política de Privacidade, seção "Armazenamento").
  function esquecerTudo() {
    for (const tipo of [localStorage, sessionStorage]) {
      try {
        Object.keys(tipo).filter((k) => k.startsWith("rr_")).forEach((k) => tipo.removeItem(k));
      } catch { /* sem armazenamento */ }
    }
  }

  window.RR_CONSENTIMENTO = {
    permitido(categoria) {
      if (categoria === "necessario") return true;
      const r = ler();
      return !!(r && r.versao === VERSAO && r.escolhas && r.escolhas[categoria] === true);
    },
    respondido,
    abrir: () => mostrar(true),
    esquecerTudo,
  };

  let aviso = null;
  function criar() {
    const el = document.createElement("section");
    el.className = "aviso-cookies";
    el.setAttribute("aria-labelledby", "aviso-cookies-titulo");
    el.innerHTML = `
      <h2 id="aviso-cookies-titulo">Privacidade neste site</h2>
      <p>Não usamos cookies de publicidade nem de rastreamento. O site guarda neste navegador só o necessário para
        funcionar: as chaves que você comprar aqui, os Pix em andamento, o e-mail que você digitar e as suas preferências.</p>
      <div class="aviso-cookies__acoes">
        <button class="btn btn--tnt btn--peq" type="button" data-aviso-ok>Entendi</button>
        <a class="btn btn--aco btn--peq" href="/privacidade#armazenamento">Ver detalhes</a>
      </div>`;
    el.querySelector("[data-aviso-ok]").addEventListener("click", () => {
      gravar({ versao: VERSAO, em: new Date().toISOString(), escolhas: { ...OPCIONAIS } });
      el.hidden = true;
      document.dispatchEvent(new CustomEvent("rr:aviso-respondido"));
    });
    return el;
  }
  function mostrar(foco) {
    if (!aviso) { aviso = criar(); document.body.appendChild(aviso); }
    aviso.hidden = false;
    if (foco) aviso.querySelector("[data-aviso-ok]").focus();
  }

  // "Cookies e armazenamento" do rodapé reabre o aviso.
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-abrir-aviso-privacidade]");
    if (b) { e.preventDefault(); mostrar(true); }
  });

  // Botão da Política de Privacidade: apaga tudo o que o site guardou neste navegador.
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-esquecer-dados]");
    if (!b) return;
    const ok = window.confirm("Apagar tudo o que o site do Rusting Raids guardou neste navegador?\n\nAs chaves guardadas aqui somem desta tela, mas continuam valendo: anote-as antes ou recupere pelo e-mail do Pix.");
    if (!ok) return;
    esquecerTudo();
    const saida = document.querySelector("[data-esquecer-resultado]");
    if (saida) saida.textContent = "Pronto: os dados do site neste navegador foram apagados.";
  });

  if (!respondido()) mostrar(false);
})();
