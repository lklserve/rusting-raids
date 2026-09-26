// POST /api/jogo/ativar  { codigo, deviceId, nome }
// O painel de chaves DENTRO do jogo chama isto quando o jogador cola a chave.
// Valida a chave, cria/liga a conta do jogador ao aparelho e devolve o id do jogador.
import { cabecalhos, ipDe, texto, normalizarCodigo } from "../_lib/http.js";
import { supabase } from "../_lib/supabase.js";
import { limitar } from "../_lib/rate-limit.js";
import { banDoAparelho } from "../_lib/banimento.js";

const MAX_DISPOSITIVOS = 3; // um jogador pode trocar de aparelho algumas vezes

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });

  // Barreira leve contra quem fica testando chaves no atacado.
  if (!(await limitar(`ativar:ip:${ipDe(req)}`, 30, 600)))
    return res.status(429).json({ ok: false, erro: "Muitas tentativas. Espere um pouco." });

  try {
    const corpo = req.body || {};
    const codigo = normalizarCodigo(corpo.codigo);
    const deviceId = texto(corpo.deviceId, 128);
    const nome = texto(corpo.nome, 40) || null;
    if (!codigo) return res.status(400).json({ ok: false, erro: "Chave inválida." });
    if (!deviceId) return res.status(400).json({ ok: false, erro: "Aparelho não identificado." });

    const sb = supabase();
    // Aparelho banido (com esta ou com outra chave): nenhuma chave abre o jogo nele.
    const ban = await banDoAparelho(sb, deviceId);
    if (ban) return res.status(403).json({ ok: false, banido: true, erro: `Este aparelho foi banido: ${ban.motivo}`, motivo: ban.motivo });

    const { data: chave } = await sb.from("chaves").select("id, status").eq("codigo", codigo).maybeSingle();
    if (!chave) return res.status(404).json({ ok: false, erro: "Chave não encontrada." });
    if (chave.status === "banida") return res.status(403).json({ ok: false, erro: "Esta chave foi banida." });

    // Já existe este jogador (esta chave neste aparelho)?
    const { data: existente } = await sb.from("jogadores")
      .select("id, banido, motivo_ban").eq("chave_id", chave.id).eq("device_id", deviceId).maybeSingle();

    if (existente) {
      if (existente.banido) return res.status(403).json({ ok: false, erro: existente.motivo_ban || "Você foi banido." });
      await sb.from("jogadores").update({
        ultimo_acesso: new Date().toISOString(),
        ...(nome ? { nome } : {}),
      }).eq("id", existente.id);
      await sb.from("chaves").update({ ultimo_uso: new Date().toISOString() }).eq("id", chave.id);
      return res.status(200).json({ ok: true, jogadorId: existente.id });
    }

    // Aparelho novo: respeita o limite de dispositivos por chave.
    const { count } = await sb.from("jogadores")
      .select("id", { count: "exact", head: true }).eq("chave_id", chave.id);
    if ((count ?? 0) >= MAX_DISPOSITIVOS)
      return res.status(409).json({ ok: false, erro: "Esta chave já está em uso no número máximo de aparelhos." });

    const { data: novo, error } = await sb.from("jogadores").insert({
      chave_id: chave.id, device_id: deviceId, nome,
      criado_em: new Date().toISOString(), ultimo_acesso: new Date().toISOString(),
    }).select("id").single();
    if (error || !novo) throw new Error("Falha ao criar o jogador");

    await sb.from("chaves").update({ ultimo_uso: new Date().toISOString() }).eq("id", chave.id);
    return res.status(200).json({ ok: true, jogadorId: novo.id });
  } catch (e) {
    console.error("jogo/ativar", e);
    return res.status(500).json({ ok: false, erro: "Erro ao ativar a chave." });
  }
}
