// POST /api/jogo/validar  { codigo, deviceId }  ->  { ok, jogadorId, adm, farm_ate, agora }  ou  { ok:false, banido, motivo }
// O jogo chama ao abrir para conferir se a chave segue valendo e se o jogador não foi banido.
import { cabecalhos, ipDe, texto, normalizarCodigo } from "../_lib/http.js";
import { supabase } from "../_lib/supabase.js";
import { limitar } from "../_lib/rate-limit.js";
import { banDoAparelho } from "../_lib/banimento.js";
import { prazoOuNada } from "../_lib/jogador.js";

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });

  if (!(await limitar(`validar:ip:${ipDe(req)}`, 120, 600)))
    return res.status(429).json({ ok: false, erro: "Muitas tentativas." });

  try {
    const corpo = req.body || {};
    const codigo = normalizarCodigo(corpo.codigo);
    const deviceId = texto(corpo.deviceId, 128);
    if (!codigo || !deviceId) return res.status(400).json({ ok: false, erro: "Dados inválidos." });

    const sb = supabase();
    // Aparelho banido (com esta ou com outra chave): bloqueia antes de olhar a chave.
    const ban = await banDoAparelho(sb, deviceId);
    if (ban) return res.status(200).json({ ok: false, banido: true, motivo: ban.motivo });

    const { data: chave } = await sb.from("chaves").select("id, status, adm").eq("codigo", codigo).maybeSingle();
    if (!chave) return res.status(200).json({ ok: false, erro: "Chave não encontrada." });
    if (chave.status === "banida") return res.status(200).json({ ok: false, banido: true, motivo: "Chave banida." });

    const { data: jogador } = await sb.from("jogadores")
      .select("id, banido, motivo_ban").eq("chave_id", chave.id).eq("device_id", deviceId).maybeSingle();
    if (!jogador) return res.status(200).json({ ok: false, erro: "Aparelho não ativado. Cole a chave no painel." });
    if (jogador.banido) return res.status(200).json({ ok: false, banido: true, motivo: jogador.motivo_ban || "Você foi banido." });

    await sb.from("jogadores").update({ ultimo_acesso: new Date().toISOString() }).eq("id", jogador.id);
    // O prazo da Coleta Automática desta chave (farm_ate e agora, em UTC com "Z").
    return res.status(200).json({ ok: true, jogadorId: jogador.id, adm: !!chave.adm, ...(await prazoOuNada(sb, chave.id)) });
  } catch (e) {
    console.error("jogo/validar", e);
    return res.status(500).json({ ok: false, erro: "Erro ao validar." });
  }
}
