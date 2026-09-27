// POST /api/servidor/estado  (Authorization: Bearer <SERVIDOR_SEGREDO>)
//   { servidor, versao, jogadores:[{jogador, roleId, nome}], memoriaMB, ligadoS, horaDoMundo, temporadaFim }
//   -> { ok, expulsar:[{jogador, motivo}], adm:[jogador] }
// O servidor do jogo na VPS (M7) avisa a cada 30 s: o painel de chaves mostra na aba "Servidor". A resposta diz
// quem está dentro e foi banido depois de entrar (o servidor expulsa) e quem é ADM agora (o painel pode tirar o
// ADM de quem está jogando). O segredo mora só na variável SERVIDOR_SEGREDO (Vercel) e RR_SERVIDOR_SEGREDO (VPS).
import { createHash, timingSafeEqual } from "node:crypto";
import { cabecalhos, ipDe, texto } from "../_lib/http.js";
import { supabase } from "../_lib/supabase.js";
import { aparelhoConfiavel } from "../_lib/banimento.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_JOGADORES = 500;
const HISTORICO_A_CADA_S = 300;   // uma linha de histórico a cada 5 min (o estado atual é a cada aviso)
const HISTORICO_DIAS = 14;

function segredoConfere(req) {
  const esperado = process.env.SERVIDOR_SEGREDO || "";
  const veio = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (esperado.length < 32 || !veio) return false;
  const h = (s) => createHash("sha256").update(s, "utf8").digest();
  return timingSafeEqual(h(esperado), h(veio));
}

const inteiro = (v, max) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(max, Math.floor(Number(v)))) : null);
const data = (s) => { const d = new Date(s); return typeof s === "string" && !isNaN(d) ? d.toISOString() : null; };

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });
  if (!segredoConfere(req)) return res.status(401).json({ ok: false, erro: "Não autorizado." });

  try {
    const c = req.body || {};
    const servidor = texto(c.servidor, 40) || "principal";
    const lista = (Array.isArray(c.jogadores) ? c.jogadores : []).slice(0, MAX_JOGADORES)
      .filter((j) => j && UUID.test(j.jogador || ""))
      .map((j) => ({ jogador: String(j.jogador).toLowerCase(), roleId: String(j.roleId ?? "").slice(0, 20), nome: texto(j.nome, 40) || "" }));
    const ids = [...new Set(lista.map((j) => j.jogador))];
    const sb = supabase();

    // Quem está dentro: ban do jogador, da chave ou do aparelho, e o ADM da chave agora.
    const expulsar = [], adm = [];
    if (ids.length) {
      const { data: js, error } = await sb.from("jogadores")
        .select("id, banido, motivo_ban, device_id, chaves(status, adm)").in("id", ids);
      if (error) throw error;
      const aparelhos = [...new Set((js || []).map((j) => j.device_id).filter(aparelhoConfiavel))];
      const banidos = new Map();
      if (aparelhos.length) {
        const { data: bs } = await sb.from("jogadores").select("device_id, motivo_ban").in("device_id", aparelhos).eq("banido", true);
        for (const b of bs || []) banidos.set(b.device_id, b.motivo_ban || "Banido pelo administrador.");
      }
      const conhecidos = new Set();
      for (const j of js || []) {
        conhecidos.add(j.id);
        if (j.banido) expulsar.push({ jogador: j.id, motivo: j.motivo_ban || "Você foi banido." });
        else if (j.chaves?.status === "banida") expulsar.push({ jogador: j.id, motivo: "Chave banida." });
        else if (banidos.has(j.device_id)) expulsar.push({ jogador: j.id, motivo: banidos.get(j.device_id) });
        else if (j.chaves?.adm) adm.push(j.id);
      }
      // Apagado no painel (o aparelho foi desligado da chave): fora também.
      for (const id of ids) if (!conhecidos.has(id)) expulsar.push({ jogador: id, motivo: "A chave não vale mais neste aparelho." });
    }
    const admSet = new Set(adm);

    const agora = new Date();
    const estado = {
      servidor,
      visto_em: agora.toISOString(),
      versao: texto(c.versao, 40) || null,
      online: lista.length,
      jogadores: lista.map((j) => ({ ...j, adm: admSet.has(j.jogador) })),
      memoria_mb: inteiro(c.memoriaMB, 1e6),
      ligado_s: inteiro(c.ligadoS, 1e10),
      hora_do_mundo: texto(c.horaDoMundo, 10) || null,
      temporada_fim: data(c.temporadaFim),
      ip: ipDe(req),
    };
    const { error: e1 } = await sb.from("servidor_estado").upsert(estado);
    if (e1) throw e1;

    // O histórico (gráfico de jogadores) só de 5 em 5 min, e o velho sai.
    const { data: ult } = await sb.from("servidor_historico").select("em").eq("servidor", servidor)
      .order("em", { ascending: false }).limit(1).maybeSingle();
    if (!ult || (agora - new Date(ult.em)) / 1000 >= HISTORICO_A_CADA_S) {
      await sb.from("servidor_historico").insert({ servidor, online: estado.online, memoria_mb: estado.memoria_mb });
      await sb.from("servidor_historico").delete().lt("em", new Date(agora - HISTORICO_DIAS * 864e5).toISOString());
    }

    return res.status(200).json({ ok: true, expulsar, adm });
  } catch (e) {
    console.error("servidor/estado", e?.message || e);
    return res.status(500).json({ ok: false, erro: "Erro ao registrar o estado." });
  }
}
