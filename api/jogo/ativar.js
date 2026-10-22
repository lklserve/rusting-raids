// POST /api/jogo/ativar  { codigo, deviceId, nome }
// O painel de chaves DENTRO do jogo chama isto quando o jogador cola a chave.
// Valida a chave, cria/liga a conta do jogador ao aparelho e devolve o id do jogador e se a chave é ADM
// do jogo (adm, dado no painel de chaves). Com a chave cheia, o aparelho novo toma o lugar do aparelho parado há mais
// de 24 h (trocado: true; ver _lib/aparelhos.js).
import { cabecalhos, ipDe, texto, normalizarCodigo } from "../_lib/http.js";
import { supabase } from "../_lib/supabase.js";
import { limitar } from "../_lib/rate-limit.js";
import { banDoAparelho } from "../_lib/banimento.js";
import { prazoOuNada } from "../_lib/jogador.js";
import { MAX_DISPOSITIVOS, CHAVE_CHEIA, aparelhosDaChave, trocarAparelho } from "../_lib/aparelhos.js";

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

    const { data: chave } = await sb.from("chaves").select("id, status, adm").eq("codigo", codigo).maybeSingle();
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
      return res.status(200).json({ ok: true, jogadorId: existente.id, adm: !!chave.adm, ...(await prazoOuNada(sb, chave.id)) });
    }

    // Aparelho novo com a chave cheia: troca o aparelho parado há mais tempo, se ele está parado há 24 h.
    const aparelhos = await aparelhosDaChave(sb, chave.id);
    if (aparelhos.length >= MAX_DISPOSITIVOS) {
      const trocado = await trocarAparelho(sb, aparelhos, deviceId, { nome });
      if (!trocado) return res.status(409).json({ ok: false, erro: CHAVE_CHEIA });
      await sb.from("chaves").update({ ultimo_uso: new Date().toISOString() }).eq("id", chave.id);
      return res.status(200).json({ ok: true, jogadorId: trocado.id, adm: !!chave.adm, trocado: true, ...(await prazoOuNada(sb, chave.id)) });
    }

    const { data: novo, error } = await sb.from("jogadores").insert({
      chave_id: chave.id, device_id: deviceId, nome,
      criado_em: new Date().toISOString(), ultimo_acesso: new Date().toISOString(),
    }).select("id").single();
    if (error || !novo) throw new Error("Falha ao criar o jogador");

    await sb.from("chaves").update({ ultimo_uso: new Date().toISOString() }).eq("id", chave.id);
    return res.status(200).json({ ok: true, jogadorId: novo.id, adm: !!chave.adm, ...(await prazoOuNada(sb, chave.id)) });
  } catch (e) {
    console.error("jogo/ativar", e);
    return res.status(500).json({ ok: false, erro: "Erro ao ativar a chave." });
  }
}
